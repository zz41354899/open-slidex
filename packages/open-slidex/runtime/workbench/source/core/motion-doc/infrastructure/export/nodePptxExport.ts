import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import { summarizeMotionDoc } from "@/core/motion-doc/application/motionDocAutomation";

export type ExportMotionDocPptxInput = {
  outputPath: string;
  overwrite?: boolean;
  source: string;
  title?: string;
};

const MAX_MEDIA_BYTES = 80 * 1024 * 1024;

export async function exportMotionDocPptx({
  outputPath,
  overwrite = false,
  source,
  title
}: ExportMotionDocPptxInput) {
  const resolvedPath = validateOutputPath(outputPath);
  await assertOutputIsWritable(resolvedPath, overwrite);

  const normalizedSource = materializeFreeformSource(source);
  const summary = summarizeMotionDoc(normalizedSource);
  if (!summary.validation.isValid) {
    throw new Error("The MotionDoc source is invalid and cannot be exported to PowerPoint.");
  }

  const portableSource = await prepareNodePptxSource(normalizedSource);
  const browser = await launchChromium();

  try {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.setContent("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
    await page.evaluate(() => {
      if (!globalThis.crypto.randomUUID) {
        Object.defineProperty(globalThis.crypto, "randomUUID", {
          value: () => "10000000-1000-4000-8000-100000000000"
        });
      }
    });
    await page.addScriptTag({ path: browserBundlePath() });

    const downloadPromise = page.waitForEvent("download");
    const exportPromise = page.evaluate(
      ({ deckSource, deckTitle }) => window.__slidexExportPptx({
        source: deckSource,
        title: deckTitle
      }),
      {
        deckSource: portableSource,
        deckTitle: title?.trim() || summary.document.title || "SlideX Deck"
      }
    );
    const [download, result] = await Promise.all([downloadPromise, exportPromise]);
    await download.saveAs(resolvedPath);

    return {
      outputPath: resolvedPath,
      rasterizedSlideIndices: result.rasterizedSlideIndices,
      summary
    };
  } finally {
    await browser.close();
  }
}

export function validateOutputPath(outputPath: string) {
  if (!path.isAbsolute(outputPath) || path.extname(outputPath).toLowerCase() !== ".pptx") {
    throw new Error("outputPath must be an absolute .pptx path.");
  }

  return path.normalize(outputPath);
}

async function assertOutputIsWritable(outputPath: string, overwrite: boolean) {
  await access(path.dirname(outputPath)).catch(() => {
    throw new Error("The outputPath parent directory does not exist.");
  });

  if (overwrite) return;

  await access(outputPath).then(
    () => {
      throw new Error("The outputPath already exists. Pass overwrite=true to replace it.");
    },
    () => undefined
  );
}

async function launchChromium() {
  const executablePath = process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE?.trim();
  try {
    return await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {})
    });
  } catch {
    throw new Error(
      "OpenSlideX PowerPoint export needs Chromium. Install Chrome or Chromium and set OPEN_SLIDEX_CHROMIUM_EXECUTABLE to its executable path, or install Playwright Chromium explicitly."
    );
  }
}

function browserBundlePath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "pptx-browser.js");
}

async function prepareNodePptxSource(source: string) {
  const replacements: Array<{ end: number; start: number; value: string }> = [];
  const blockPattern = /<(ImageBlock|VideoBlock)\b([^>]*)\/>/g;

  for (const blockMatch of source.matchAll(blockPattern)) {
    const blockType = blockMatch[1];
    const attributes = blockMatch[2] ?? "";
    const blockOffset = (blockMatch.index ?? 0) + blockMatch[0].indexOf(attributes);

    for (const attributeMatch of attributes.matchAll(/\b(src|poster)\s*=\s*(["'])([^"']*)\2/g)) {
      const attributeName = attributeMatch[1];
      const mediaSource = attributeMatch[3];
      const valueOffset = attributeMatch[0].indexOf(mediaSource);
      const start = blockOffset + (attributeMatch.index ?? 0) + valueOffset;
      const kind = blockType === "VideoBlock" && attributeName === "src" ? "video" : "image";
      const value = await portableMediaSource(mediaSource, kind);

      replacements.push({ end: start + mediaSource.length, start, value });
    }
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.value}${current.slice(replacement.end)}`,
      source
    );
}

async function portableMediaSource(source: string, kind: "image" | "video") {
  if (!source) return source;

  if (source.startsWith(`data:${kind}/`)) {
    return source;
  }

  if (source.startsWith("blob:") || source.startsWith("/") && !path.isAbsolute(source)) {
    throw new Error("PowerPoint media must use HTTPS, a data URI, or an absolute local path.");
  }

  if (/^https:\/\//i.test(source)) {
    if (kind === "video") return source;
    const response = await fetch(source);
    if (!response.ok) throw new Error("A PowerPoint image could not be downloaded.");
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES) {
      throw new Error("A PowerPoint media source is too large.");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("A PowerPoint media source is too large.");
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0] || "image/png";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  if (path.isAbsolute(source)) {
    const buffer = await readFile(source).catch(() => {
      throw new Error("A local PowerPoint media file could not be read.");
    });
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("A PowerPoint media source is too large.");
    return `data:${mediaMimeType(source, kind)};base64,${buffer.toString("base64")}`;
  }

  throw new Error("PowerPoint media must use HTTPS, a data URI, or an absolute local path.");
}

function mediaMimeType(source: string, kind: "image" | "video") {
  const extension = path.extname(source).toLowerCase();
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".ogg": kind === "video" ? "video/ogg" : "image/png",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webm": "video/webm",
    ".webp": "image/webp"
  };

  return types[extension] ?? (kind === "video" ? "video/mp4" : "image/png");
}

declare global {
  interface Window {
    __slidexExportPptx: (input: { source: string; title: string }) => Promise<{
      rasterizedSlideIndices: number[];
    }>;
  }
}
