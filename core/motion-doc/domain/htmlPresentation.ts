import type { MotionDocBlock, ParsedMotionDoc } from "@/core/motion-doc/domain/motionDocTypes";

const HTML_SOURCE_SELECTOR_PROP = "htmlSourceSelector";
const HTML_SOURCE_TEXT_NODE_PROP = "htmlSourceTextNode";

export function isHtmlSourceTextBlock(block: MotionDocBlock) {
  return block.type === "Text"
    && typeof block.props[HTML_SOURCE_SELECTOR_PROP] === "string"
    && Number.isInteger(Number(block.props[HTML_SOURCE_TEXT_NODE_PROP]))
    && Number(block.props[HTML_SOURCE_TEXT_NODE_PROP]) >= 0;
}

/** Returns the one canonical HTML asset when every non-HTML layer is a generated source-linked Text layer. */
export function htmlPresentationAsset(document: ParsedMotionDoc) {
  if (!document.scenes.length) return undefined;
  const sources = new Set<string>();

  for (const scene of document.scenes) {
    const htmlBlocks = scene.blocks.filter((block) => block.type === "HtmlEmbedBlock");
    if (htmlBlocks.length !== 1) return undefined;
    if (scene.blocks.some((block) => block.type !== "HtmlEmbedBlock" && !isHtmlSourceTextBlock(block))) return undefined;
    const source = htmlBlocks[0]?.props.src;
    if (typeof source !== "string" || !/^assets\/[A-Za-z0-9._-]+\.html?$/i.test(source)) return undefined;
    sources.add(source);
  }

  return sources.size === 1 ? [...sources][0] : undefined;
}
