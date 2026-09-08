import { join } from "node:path";
import { stat } from "node:fs/promises";

import {
  motionDocSlideSourceRanges,
  parseMotionDoc,
  reactPresentationToMotionDocSource
} from "@open-slidex/sdk";

import { isNodeError } from "./serverWorkspace";

export const removedMotionDocTags = ["Card", "Group", "Icon", "Metric", "Notes", "Stack", "Title"] as const;

const authorableMotionDocTags = new Set([
  "Chart",
  "ImageBlock",
  "Shape",
  "Slide",
  "SvgBlock",
  "Table",
  "Text",
  "VideoBlock"
]);

export async function resolveAuthoringGuidanceRoot(deckRoot: string, configuredWorkspaceRoot?: string) {
  const candidates = [
    deckRoot,
    ...(configuredWorkspaceRoot ? [configuredWorkspaceRoot] : [])
  ];
  for (const candidate of [...new Set(candidates)]) {
    try {
      const skillDirectory = await stat(join(candidate, ".agents", "skills"));
      if (skillDirectory.isDirectory()) return candidate;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
  }
  return deckRoot;
}

export function assertToolbarNativeDocument(source: string) {
  const removed = removedMotionDocTags.filter((tag) => new RegExp(`<${tag}\\b`).test(source));
  if (removed.length > 0) {
    throw new Error(
      `Removed MotionDoc component${removed.length === 1 ? "" : "s"}: ${removed.join(", ")}. ` +
      "These tags are no longer parsed or supported."
    );
  }
  for (const [slideIndex, range] of motionDocSlideSourceRanges(reactPresentationToMotionDocSource(source)).entries()) {
    assertToolbarNativeSlideSource(range.source, `slide ${slideIndex + 1}`);
  }
}

function assertToolbarNativeSlideSource(source: string, label: string) {
  const tags = [...source.matchAll(/<\/?([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1]);
  const forbidden = [...new Set(tags.filter((tag) => !authorableMotionDocTags.has(tag)))];
  if (forbidden.length > 0) {
    throw new Error(
      `${label} may only use Workspace toolbar layers. ` +
      `Unsupported component${forbidden.length === 1 ? "" : "s"}: ${forbidden.join(", ")}. ` +
      "Use Text, ImageBlock, VideoBlock, SvgBlock, Chart, Table, or Shape with explicit geometry."
    );
  }

  for (const match of source.matchAll(/<(Text|Chart|ImageBlock|Shape|SvgBlock|Table|VideoBlock)\b([^>]*)>/g)) {
    const tag = match[1];
    const attributes = match[2] ?? "";
    const missing = ["id", "x", "y", "w", "h"].filter(
      (key) => !new RegExp(`\\b${key}\\s*=`).test(attributes)
    );
    if (missing.length > 0) {
      throw new Error(
        `${label} <${tag}> is missing deterministic layer attributes: ${missing.join(", ")}. ` +
        "Every MCP-authored visible layer needs a stable id and explicit percentage x/y/w/h geometry."
      );
    }
  }

  const visibleRemainder = source
    .replace(/<Text\b[^>]*>[\s\S]*?<\/Text>/g, "")
    .replace(/<(?:Chart|ImageBlock|Shape|SvgBlock|Table|VideoBlock)\b[^>]*\/>/g, "")
    .replace(/<\/?Slide\b[^>]*>/g, "")
    .trim();
  if (visibleRemainder) {
    throw new Error(
      `${label} contains visible Markdown or malformed component markup outside toolbar-native layers. ` +
      "Put visible copy inside positioned <Text> layers."
    );
  }
}

export function listHtmlPresentationAssets(source: string) {
  const records = new Map<string, {
    blockIds: string[];
    pages: number[];
    sharedScenes: string[];
    slideIndices: number[];
    source: string;
  }>();
  const document = parseMotionDoc(source);
  document.scenes.forEach((scene, slideIndex) => {
    scene.blocks.forEach((block) => {
      if (block.type !== "HtmlEmbedBlock") return;
      const assetSource = typeof block.props.src === "string" ? block.props.src : "";
      if (!/^assets\/[A-Za-z0-9._-]+\.html?$/i.test(assetSource)) return;
      const record = records.get(assetSource) ?? {
        blockIds: [],
        pages: [],
        sharedScenes: [],
        slideIndices: [],
        source: assetSource
      };
      const page = Number(block.props.page ?? 1);
      record.blockIds.push(String(block.props.id ?? ""));
      record.pages.push(Number.isInteger(page) && page > 0 ? page : 1);
      record.slideIndices.push(slideIndex);
      if (typeof block.props.sharedScene === "string" && block.props.sharedScene) {
        record.sharedScenes.push(block.props.sharedScene);
      }
      records.set(assetSource, record);
    });
  });
  return [...records.values()].map((record) => ({
    ...record,
    blockIds: [...new Set(record.blockIds.filter(Boolean))],
    pageCount: new Set(record.pages).size,
    pages: [...new Set(record.pages)].sort((left, right) => left - right),
    sharedScenes: [...new Set(record.sharedScenes)],
    slideIndices: [...new Set(record.slideIndices)].sort((left, right) => left - right)
  }));
}

export function isPureHtmlPresentation(source: string, assetSource: string) {
  const document = parseMotionDoc(source);
  return document.scenes.length > 0 && document.scenes.every((scene) => (
    scene.blocks.length === 1
    && scene.blocks[0]?.type === "HtmlEmbedBlock"
    && scene.blocks[0].props.src === assetSource
  ));
}
