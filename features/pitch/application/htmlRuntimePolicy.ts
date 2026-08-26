import type { MotionDocScene, ParsedMotionDoc } from "@/core/motion-doc/domain/motionDocTypes";
import { htmlPresentationAsset, isHtmlSourceTextBlock } from "@/core/motion-doc/domain/htmlPresentation";

export type SharedHtmlDeckRuntime = {
  sharedScene: string;
  source: string;
};

export type HtmlSourceWorkspace = {
  pageCount: number;
  source: string;
};

/**
 * Imported HTML is edited as one canonical source file. Generated source-linked
 * Text layers from older Workbench builds are tolerated only so those decks can
 * migrate back to this single-source mode without exposing Canvas authoring.
 */
export function htmlSourceWorkspace(document: ParsedMotionDoc): HtmlSourceWorkspace | null {
  const source = htmlPresentationAsset(document);
  return source ? { pageCount: document.scenes.length, source } : null;
}

/**
 * A shared-HTML deck can reuse one iframe while its active page changes. Text
 * layers extracted from that HTML are editor overlays, not a second runtime.
 * Other mixed/native slides keep their normal per-slide semantics.
 */
export function sharedHtmlDeckRuntime(scenes: readonly MotionDocScene[]): SharedHtmlDeckRuntime | null {
  if (!scenes.length) return null;

  let sharedScene = "";
  let source = "";
  for (const scene of scenes) {
    const htmlBlocks = scene.blocks.filter((block) => block.type === "HtmlEmbedBlock");
    if (
      htmlBlocks.length !== 1
      || scene.blocks.some((block) => block.type !== "HtmlEmbedBlock" && !isHtmlSourceTextBlock(block))
    ) return null;
    const block = htmlBlocks[0]!;
    const nextSharedScene = typeof block.props.sharedScene === "string" ? block.props.sharedScene.trim() : "";
    const nextSource = typeof block.props.src === "string" ? block.props.src.trim() : "";
    if (!nextSharedScene || !nextSource) return null;
    if (!sharedScene) {
      sharedScene = nextSharedScene;
      source = nextSource;
      continue;
    }
    if (nextSharedScene !== sharedScene || nextSource !== source) return null;
  }

  return { sharedScene, source };
}

export function sceneContainsHtmlRuntime(scene: MotionDocScene | undefined) {
  return Boolean(scene?.blocks.some((block) => block.type === "HtmlEmbedBlock"));
}
