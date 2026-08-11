import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { summarizeMotionDoc } from "@/core/motion-doc/application/motionDocAutomation";
import { motionDocSlideSourceRanges } from "@/core/motion-doc/application/motionDocSourceEditor";
import {
  buildMotionDocRasterHtml,
  MOTION_DOC_PNG_HEIGHT,
  MOTION_DOC_PNG_WIDTH
} from "@/core/motion-doc/infrastructure/export/motionDocExport";

import { withSlideXChromiumPage } from "./nodeBrowser";
import { embedSlideXProjectMedia } from "./nodeMedia";

export const slideXQualityIssueCodes = [
  "cjk_orphan",
  "dense_slide",
  "media_unresolved",
  "non_canonical_prop",
  "out_of_canvas",
  "repeated_composition",
  "safe_margin",
  "text_collision",
  "text_overflow",
  "tiny_text"
] as const;

export type SlideXQualityIssueCode = (typeof slideXQualityIssueCodes)[number];

export type SlideXQualityIssue = {
  code: SlideXQualityIssueCode;
  message: string;
  metrics?: Record<string, number | string>;
  nodeIds: string[];
  severity: "error" | "warning";
  slideIndex: number;
};

export type SlideXQualityReport = {
  issues: SlideXQualityIssue[];
  mode: "deck" | "slide";
  passed: boolean;
  score: number;
  slideIndices: number[];
  slides: Array<{
    blockCount: number;
    errorCount: number;
    slideIndex: number;
    textBlockCount: number;
    warningCount: number;
  }>;
  summary: {
    errorCount: number;
    warningCount: number;
  };
  preview?: {
    height: number;
    mode: "montage" | "slide";
    outputPath: string;
    slideIndices: number[];
    width: number;
  };
};

export type AnalyzeSlideXDocumentQualityInput = {
  mode?: "deck" | "slide";
  projectRoot?: string;
  previewOutputPath?: string;
  slideIndex?: number;
  source: string;
  title?: string;
  signal?: AbortSignal;
};

type RectMeasurement = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type BlockMeasurement = {
  blockType: string;
  fontSize: number;
  frame: RectMeasurement;
  lastLine: string;
  lineCount: number;
  mediaUnresolved: boolean;
  nodeId: string;
  text: string;
  textRect?: RectMeasurement;
};

type SlideMeasurement = {
  blocks: BlockMeasurement[];
  compositionSignature: string;
  slide: RectMeasurement;
};

type CachedSlideQuality = {
  image: Buffer;
  measurement: SlideMeasurement;
};

const maximumCachedSlides = 128;
const slideQualityCache = new Map<string, CachedSlideQuality>();
let slideQualityCacheHits = 0;
let slideQualityCacheMisses = 0;

export function getSlideXQualityCacheStats() {
  return {
    hits: slideQualityCacheHits,
    misses: slideQualityCacheMisses,
    slides: slideQualityCache.size
  };
}

export async function analyzeSlideXDocumentQuality(
  input: AnalyzeSlideXDocumentQualityInput
): Promise<SlideXQualityReport> {
  input.signal?.throwIfAborted();
  const validation = summarizeMotionDoc(input.source).validation;
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(`The MotionDoc source is invalid. ${errors.map((issue) => issue.message).join(" ")}`);
  }

  const motionDocument = parseMotionDoc(input.source);
  const mode = input.mode ?? "deck";
  const requestedSlide = input.slideIndex ?? 0;
  if (
    mode === "slide" &&
    (!Number.isInteger(requestedSlide) || requestedSlide < 0 || requestedSlide >= motionDocument.scenes.length)
  ) {
    throw new Error(`slideIndex ${requestedSlide} is outside the slide range.`);
  }
  const slideIndices = mode === "slide"
    ? [requestedSlide]
    : motionDocument.scenes.map((_scene, slideIndex) => slideIndex);
  const portableSource = input.projectRoot
    ? await embedSlideXProjectMedia(input.source, input.projectRoot)
    : input.source;
  const measurements = new Map<number, SlideMeasurement>();
  const images = new Map<number, Buffer>();
  const portableSlides = motionDocSlideSourceRanges(portableSource);
  const cacheKeys = new Map(slideIndices.map((slideIndex) => [
    slideIndex,
    createHash("sha256").update(portableSlides[slideIndex]?.source ?? portableSource).digest("hex")
  ]));
  const missingSlideIndices: number[] = [];
  for (const slideIndex of slideIndices) {
    const cacheKey = cacheKeys.get(slideIndex)!;
    const cached = slideQualityCache.get(cacheKey);
    if (!cached) {
      slideQualityCacheMisses += 1;
      missingSlideIndices.push(slideIndex);
      continue;
    }
    slideQualityCacheHits += 1;
    slideQualityCache.delete(cacheKey);
    slideQualityCache.set(cacheKey, cached);
    measurements.set(slideIndex, cached.measurement);
    images.set(slideIndex, cached.image);
  }

  if (missingSlideIndices.length > 0) await withSlideXChromiumPage({
      viewport: { height: MOTION_DOC_PNG_HEIGHT, width: MOTION_DOC_PNG_WIDTH }
    }, async (page) => {
    for (const slideIndex of missingSlideIndices) {
      input.signal?.throwIfAborted();
      await page.setContent(
        buildMotionDocRasterHtml(portableSource, input.title, [slideIndex]),
        { waitUntil: "networkidle" }
      );
      await page.evaluate("document.fonts.ready.then(() => true)");
      const measurement = await measureRenderedSlide(page);
      const image = await page.screenshot({ type: "png" });
      measurements.set(slideIndex, measurement);
      images.set(slideIndex, image);
      cacheSlideQuality(cacheKeys.get(slideIndex)!, { image, measurement });
    }
  }, input.signal);

  const preview = input.previewOutputPath
    ? await writeQualityPreview(input.previewOutputPath, mode, slideIndices, images, input.signal)
    : undefined;

  const issues: SlideXQualityIssue[] = [];
  const aliasIssues = new Map<string, { aliases: string[]; nodeId: string; slideIndex: number }>();
  for (const issue of validation.issues) {
    if (issue.code !== "non_canonical_prop") continue;
    const slideIndex = Number(issue.path?.match(/^scenes\[(\d+)]/)?.[1] ?? 0);
    if (!slideIndices.includes(slideIndex)) continue;
    const blockIndex = Number(issue.path?.match(/blocks\[(\d+)]/)?.[1] ?? -1);
    const block = motionDocument.scenes[slideIndex]?.blocks[blockIndex];
    const nodeId = block && "props" in block && typeof block.props.id === "string"
      ? block.props.id
      : `block-${blockIndex}`;
    const alias = issue.message.match(/^(\w+).*use (\w+) instead/)?.slice(1).join("→") ?? issue.message;
    const key = `${slideIndex}:${nodeId}`;
    const grouped = aliasIssues.get(key) ?? { aliases: [], nodeId, slideIndex };
    grouped.aliases.push(alias);
    aliasIssues.set(key, grouped);
  }
  for (const grouped of aliasIssues.values()) {
    issues.push({
      code: "non_canonical_prop",
      message: `${grouped.nodeId} uses ignored typography props: ${grouped.aliases.join(", ")}.`,
      metrics: { replacements: grouped.aliases.join(", ") },
      nodeIds: [grouped.nodeId],
      severity: "error",
      slideIndex: grouped.slideIndex
    });
  }

  for (const [slideIndex, measurement] of measurements) {
    issues.push(...qualityIssuesForSlide(slideIndex, measurement));
  }
  if (mode === "deck") issues.push(...repeatedCompositionIssues(measurements));

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const score = Math.max(0, 100 - errorCount * 16 - warningCount * 4);
  return {
    issues,
    mode,
    passed: errorCount === 0,
    score,
    slideIndices,
    slides: slideIndices.map((slideIndex) => {
      const measurement = measurements.get(slideIndex);
      const slideIssues = issues.filter((issue) => issue.slideIndex === slideIndex);
      return {
        blockCount: measurement?.blocks.length ?? 0,
        errorCount: slideIssues.filter((issue) => issue.severity === "error").length,
        slideIndex,
        textBlockCount: measurement?.blocks.filter((block) => block.text).length ?? 0,
        warningCount: slideIssues.filter((issue) => issue.severity === "warning").length
      };
    }),
    summary: { errorCount, warningCount },
    preview
  };
}

function cacheSlideQuality(key: string, value: CachedSlideQuality) {
  slideQualityCache.set(key, value);
  while (slideQualityCache.size > maximumCachedSlides) {
    const oldest = slideQualityCache.keys().next().value;
    if (typeof oldest !== "string") break;
    slideQualityCache.delete(oldest);
  }
}

async function writeQualityPreview(
  outputPath: string,
  mode: "deck" | "slide",
  slideIndices: readonly number[],
  images: ReadonlyMap<number, Buffer>,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (mode === "slide") {
    const image = images.get(slideIndices[0] ?? -1);
    if (!image) throw new Error("The rendered QA preview is unavailable.");
    await writeFile(outputPath, image);
    return {
      height: MOTION_DOC_PNG_HEIGHT,
      mode: "slide" as const,
      outputPath,
      slideIndices: [...slideIndices],
      width: MOTION_DOC_PNG_WIDTH
    };
  }

  const columns = slideIndices.length === 1 ? 1 : 2;
  const thumbWidth = 960;
  const thumbHeight = 540;
  const gap = 32;
  const labelHeight = 44;
  const rows = Math.ceil(slideIndices.length / columns);
  const width = columns * thumbWidth + (columns + 1) * gap;
  const height = rows * (thumbHeight + labelHeight) + (rows + 1) * gap;
  const sources = slideIndices.map((slideIndex) => {
    const image = images.get(slideIndex);
    if (!image) throw new Error(`The rendered QA preview for slide ${slideIndex + 1} is unavailable.`);
    return `data:image/png;base64,${image.toString("base64")}`;
  });
  await withSlideXChromiumPage({ viewport: { height, width } }, async (page) => {
    await page.setContent(buildQualityMontageHtml(sources, columns, thumbWidth, thumbHeight, gap));
    signal?.throwIfAborted();
    await page.screenshot({ path: outputPath, type: "png" });
  }, signal);
  return { height, mode: "montage" as const, outputPath, slideIndices: [...slideIndices], width };
}

function buildQualityMontageHtml(
  images: readonly string[],
  columns: number,
  width: number,
  height: number,
  gap: number
) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;background:#111}main{display:grid;grid-template-columns:repeat(${columns},${width}px);gap:${gap}px;padding:${gap}px}figure{margin:0}img{display:block;width:${width}px;height:${height}px;object-fit:cover}figcaption{color:#fff;font:600 24px/44px system-ui;height:44px}
</style></head><body><main>${images.map((image, index) => `<figure><img alt="Slide ${index + 1}" src="${image}"><figcaption>${index + 1}</figcaption></figure>`).join("")}</main></body></html>`;
}

async function measureRenderedSlide(page: import("playwright-core").Page) {
  return page.evaluate(measureRenderedSlideScript) as Promise<SlideMeasurement>;
}

const measureRenderedSlideScript = String.raw`(() => {
  const rect = (value) => ({
    bottom: value.bottom,
    height: value.height,
    left: value.left,
    right: value.right,
    top: value.top,
    width: value.width
  });
  const unionRects = (values) => {
    if (values.length === 0) return undefined;
    const left = Math.min(...values.map((value) => value.left));
    const top = Math.min(...values.map((value) => value.top));
    const right = Math.max(...values.map((value) => value.right));
    const bottom = Math.max(...values.map((value) => value.bottom));
    return { bottom, height: bottom - top, left, right, top, width: right - left };
  };
  const renderedLines = (element) => {
    const text = element.textContent || "";
    if (!text.trim() || text.length > 800) return [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const characters = [];
    let node = walker.nextNode();
    while (node) {
      const value = node.textContent || "";
      for (let offset = 0; offset < value.length; offset += 1) {
        const char = value[offset] || "";
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        const charRect = range.getBoundingClientRect();
        if (charRect.width > 0 || char.trim()) characters.push({ char, top: charRect.top });
      }
      node = walker.nextNode();
    }
    const lines = [];
    for (const character of characters) {
      const line = lines.find((candidate) => Math.abs(candidate.top - character.top) <= 2);
      if (line) line.text += character.char;
      else lines.push({ text: character.char, top: character.top });
    }
    return lines.sort((left, right) => left.top - right.top).map((line) => line.text.trim());
  };
  const renderedTextRects = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const values = [];
    let node = walker.nextNode();
    while (node) {
      if ((node.textContent || "").trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        values.push(...Array.from(range.getClientRects()).filter((value) => value.width > 0 || value.height > 0));
      }
      node = walker.nextNode();
    }
    return values;
  };
  const slideElement = document.querySelector(".slide");
  if (!slideElement) throw new Error("Rendered slide is unavailable.");
  const slide = rect(slideElement.getBoundingClientRect());
  const blocks = Array.from(slideElement.querySelectorAll(".motion-block--positioned"))
    .map((block, blockIndex) => {
      const content = block.querySelector(".block-title, .block-text") || block.firstElementChild;
      const text = (content?.textContent || "").replace(/\s+/g, " ").trim();
      const lineRects = content
        ? Array.from(content.querySelectorAll(".block-line")).map((line) => line.getBoundingClientRect())
        : [];
      const textRect = lineRects.length
        ? unionRects(lineRects)
        : content && text
          ? unionRects(renderedTextRects(content))
          : undefined;
      const lines = content && text ? renderedLines(content) : [];
      const mediaUnresolved = Array.from(block.querySelectorAll("img"))
        .some((image) => Boolean(image.getAttribute("src")?.trim()) && (
          !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0
        ));
      const x = Number(block.dataset.slidexX || 0);
      const y = Number(block.dataset.slidexY || 0);
      const w = Number(block.dataset.slidexW || 0);
      const h = Number(block.dataset.slidexH || 0);
      return {
        blockType: block.dataset.slidexBlockType || "Unknown",
        fontSize: content ? Number.parseFloat(getComputedStyle(content).fontSize) || 0 : 0,
        frame: rect(block.getBoundingClientRect()),
        lastLine: lines.at(-1) || "",
        lineCount: lines.length,
        mediaUnresolved,
        nodeId: block.dataset.slidexNodeId || "block-" + blockIndex,
        signature: (block.dataset.slidexBlockType || "?") + ":" + Math.round(x / 10) + ":" + Math.round(y / 10) + ":" + Math.round(w / 10) + ":" + Math.round(h / 10),
        text,
        textRect
      };
    });
  return {
    blocks: blocks.map(({ signature, ...block }) => block),
    compositionSignature: blocks.map((block) => block.signature).sort().join("|"),
    slide
  };
})()`;

function qualityIssuesForSlide(slideIndex: number, measurement: SlideMeasurement) {
  const issues: SlideXQualityIssue[] = [];
  const marginX = measurement.slide.width * 0.02;
  const marginY = measurement.slide.height * 0.02;
  let cjkCharacters = 0;
  let totalCharacters = 0;

  for (const block of measurement.blocks) {
    const { frame, nodeId, textRect } = block;
    if (
      frame.left < measurement.slide.left - 1 ||
      frame.top < measurement.slide.top - 1 ||
      frame.right > measurement.slide.right + 1 ||
      frame.bottom > measurement.slide.bottom + 1
    ) {
      issues.push({
        code: "out_of_canvas",
        message: `${nodeId} leaves the 1920×1080 canvas.`,
        metrics: { bottom: round(frame.bottom), left: round(frame.left), right: round(frame.right), top: round(frame.top) },
        nodeIds: [nodeId],
        severity: "error",
        slideIndex
      });
    }

    if (textRect) {
      const overflow = {
        bottom: Math.max(0, textRect.bottom - frame.bottom),
        left: Math.max(0, frame.left - textRect.left),
        right: Math.max(0, textRect.right - frame.right),
        top: Math.max(0, frame.top - textRect.top)
      };
      const maxOverflow = Math.max(overflow.bottom, overflow.left, overflow.right, overflow.top);
      if (maxOverflow > 3) {
        issues.push({
          code: "text_overflow",
          message: `${nodeId} text exceeds its frame by ${round(maxOverflow)}px; enlarge the frame or shorten the copy.`,
          metrics: Object.fromEntries(Object.entries(overflow).map(([key, value]) => [key, round(value)])),
          nodeIds: [nodeId],
          severity: "error",
          slideIndex
        });
      }
      if (
        textRect.left - measurement.slide.left < marginX ||
        measurement.slide.right - textRect.right < marginX ||
        textRect.top - measurement.slide.top < marginY ||
        measurement.slide.bottom - textRect.bottom < marginY
      ) {
        issues.push({
          code: "safe_margin",
          message: `${nodeId} text sits inside the outer 2% safety margin.`,
          nodeIds: [nodeId],
          severity: "warning",
          slideIndex
        });
      }
    }

    if (block.mediaUnresolved) {
      issues.push({
        code: "media_unresolved",
        message: `${nodeId} contains media that did not decode in the rendered slide.`,
        nodeIds: [nodeId],
        severity: "error",
        slideIndex
      });
    }
    if (block.text && block.fontSize > 0 && block.fontSize < 16) {
      issues.push({
        code: "tiny_text",
        message: `${nodeId} renders at ${round(block.fontSize)}px and may be unreadable at presentation distance.`,
        metrics: { fontSizePx: round(block.fontSize) },
        nodeIds: [nodeId],
        severity: "warning",
        slideIndex
      });
    }
    if (
      block.lineCount > 1 &&
      /[\u3400-\u9fff]/u.test(block.text) &&
      /^[\u3400-\u9fff，。！？；：、）》】」』]{1,2}$/u.test(block.lastLine.replace(/\s+/g, ""))
    ) {
      issues.push({
        code: "cjk_orphan",
        message: `${nodeId} ends with the short CJK line “${block.lastLine}”; rebalance the frame or rewrite the sentence.`,
        metrics: { lastLineCharacters: [...block.lastLine].length, lineCount: block.lineCount },
        nodeIds: [nodeId],
        severity: "warning",
        slideIndex
      });
    }
    totalCharacters += [...block.text].length;
    cjkCharacters += [...block.text].filter((character) => /[\u3400-\u9fff]/u.test(character)).length;
  }

  const textBlocks = measurement.blocks.filter((block) => block.textRect);
  for (let leftIndex = 0; leftIndex < textBlocks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < textBlocks.length; rightIndex += 1) {
      const left = textBlocks[leftIndex];
      const right = textBlocks[rightIndex];
      if (!left?.textRect || !right?.textRect) continue;
      const overlapWidth = Math.min(left.textRect.right, right.textRect.right) - Math.max(left.textRect.left, right.textRect.left);
      const overlapHeight = Math.min(left.textRect.bottom, right.textRect.bottom) - Math.max(left.textRect.top, right.textRect.top);
      if (overlapWidth <= 4 || overlapHeight <= 4) continue;
      issues.push({
        code: "text_collision",
        message: `${left.nodeId} and ${right.nodeId} overlap in the rendered slide.`,
        metrics: { overlapHeight: round(overlapHeight), overlapWidth: round(overlapWidth) },
        nodeIds: [left.nodeId, right.nodeId],
        severity: "error",
        slideIndex
      });
    }
  }

  if (cjkCharacters > 180 || totalCharacters > 700) {
    issues.push({
      code: "dense_slide",
      message: `Slide ${slideIndex + 1} contains too much presentation copy for one focal message.`,
      metrics: { cjkCharacters, totalCharacters },
      nodeIds: [],
      severity: "warning",
      slideIndex
    });
  }
  return issues;
}

function repeatedCompositionIssues(measurements: ReadonlyMap<number, SlideMeasurement>) {
  const signatures = new Map<string, number[]>();
  for (const [slideIndex, measurement] of measurements) {
    if (!measurement.compositionSignature) continue;
    const indices = signatures.get(measurement.compositionSignature) ?? [];
    indices.push(slideIndex);
    signatures.set(measurement.compositionSignature, indices);
  }
  const issues: SlideXQualityIssue[] = [];
  for (const indices of signatures.values()) {
    if (indices.length < 3) continue;
    for (const slideIndex of indices.slice(2)) {
      issues.push({
        code: "repeated_composition",
        message: `Slide ${slideIndex + 1} repeats the same composition used on slides ${indices.slice(0, 2).map((index) => index + 1).join(" and ")}.`,
        metrics: { repeatedSlides: indices.length },
        nodeIds: [],
        severity: "warning",
        slideIndex
      });
    }
  }
  return issues;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
