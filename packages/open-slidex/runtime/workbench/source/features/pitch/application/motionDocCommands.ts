import { createMotionDocBlock, type AddBlockType } from "@/core/motion-doc/application/motionDocBlockFactory";
import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import { withNewMotionDocBlockId } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { cloneBlock, generateBlockString, generateSlideString, replaceSlideOpeningTag } from "@/core/motion-doc/application/motionDocSerialize";
import {
  appendMotionDocSlideSource,
  deleteMotionDocSlideSource,
  insertMotionDocSlideSource,
  motionDocSlideSourceRanges,
  reorderMotionDocSlideSource,
  replaceMotionDocSlideSource,
  type MotionDocSlidePlacement
} from "@/core/motion-doc/application/motionDocSourceEditor";
import { clampFramePosition, defaultBlockHeight, defaultBlockWidth, defaultBlockX, defaultBlockY, framePositionValue, percentFrameValue } from "@/core/motion-doc/domain/frame";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  MOTION_DOC_CANVAS_PROPS,
  MOTION_DOC_FONT_SIZES
} from "@/core/motion-doc/domain/typography";
import { normalizeElementMotionProps } from "@/features/pitch/application/motionModel";
import type { BlockFramePatch, PositionDelta } from "@/features/pitch/application/pitchGeometry";
import {
  applyLayoutBlocksToSlide,
  applyTemplateSlideSourceToSlide
} from "@/features/pitch/application/templateDeckApplication";

export type AddBlockOptions = {
  position?: { x: number; y: number };
  props?: MotionDocProps;
};

export type InsertSlidePlacement = MotionDocSlidePlacement;

type ApplySelectionMdxResult =
  | {
      error: string;
    }
  | {
      notice: string;
      source: string;
    };

export function appendBlankSlideSource(source: string, slideIndex: number) {
  void slideIndex;
  return appendMotionDocSlideSource(source, blankSlideSource());
}

export function insertBlankSlideSource(source: string, slideIndex: number, placement: InsertSlidePlacement) {
  const ranges = motionDocSlideSourceRanges(source);
  const blankSlide = blankSlideSource();

  if (ranges.length === 0) {
    return appendMotionDocSlideSource(source, blankSlide);
  }

  const targetIndex = Math.max(0, Math.min(slideIndex, ranges.length - 1));
  return insertMotionDocSlideSource(source, targetIndex, blankSlide, placement);
}

export function insertLayoutSlideSource(
  source: string,
  slideIndex: number,
  layoutSource: string,
  layoutId: string,
  placement: InsertSlidePlacement = "after"
) {
  const ranges = motionDocSlideSourceRanges(source);
  const nextSlide = layoutSlideSourceFromReference(source, slideIndex, layoutSource, layoutId);

  if (ranges.length === 0) {
    return appendMotionDocSlideSource(source, nextSlide);
  }

  const targetIndex = Math.max(0, Math.min(slideIndex, ranges.length - 1));
  return insertMotionDocSlideSource(source, targetIndex, nextSlide, placement);
}

function layoutSlideSourceFromReference(source: string, slideIndex: number, layoutSource: string, layoutId: string) {
  const { accent, background, textColor, theme } = referenceSlideStyle(source, slideIndex);

  const txtAttr = textColor ? ` textColor="${textColor}"` : "";
  const startTag = `<Slide canvasHeight={${MOTION_DOC_CANVAS_PROPS.canvasHeight}} canvasWidth={${MOTION_DOC_CANVAS_PROPS.canvasWidth}} fontSizeUnit="${MOTION_DOC_CANVAS_PROPS.fontSizeUnit}" duration={5} theme="${theme}" background="${background}" accent="${accent}" layoutPreset="${layoutId}"${txtAttr}>`;
  const endTag = '</Slide>';

  return `${startTag}\n${normalizeLayoutSourceTextMotion(layoutSource)}\n${endTag}`;
}

export function appendTemplateSlideSource(source: string, templateSlideSource: string) {
  const templateSlide = motionDocSlideSourceRanges(templateSlideSource)[0];
  return templateSlide
    ? appendMotionDocSlideSource(source, templateSlide.source)
    : source;
}

export function insertTemplateSlideSource(
  source: string,
  slideIndex: number,
  templateSlideSource: string,
  placement: InsertSlidePlacement = "after"
) {
  const ranges = motionDocSlideSourceRanges(source);
  const templateSlide = motionDocSlideSourceRanges(templateSlideSource)[0];

  if (!templateSlide) return source;
  if (ranges.length === 0) {
    return appendMotionDocSlideSource(source, templateSlide.source);
  }

  const targetIndex = Math.max(0, Math.min(slideIndex, ranges.length - 1));
  return insertMotionDocSlideSource(
    source,
    targetIndex,
    templateSlide.source,
    placement
  );
}

function blankSlideSource() {
  return `<Slide canvasHeight={${MOTION_DOC_CANVAS_PROPS.canvasHeight}} canvasWidth={${MOTION_DOC_CANVAS_PROPS.canvasWidth}} fontSizeUnit="${MOTION_DOC_CANVAS_PROPS.fontSizeUnit}" duration={5} theme="light" background="#FFFFFF" accent="#111827" textColor="#111827" mutedColor="#475569">\n</Slide>`;
}

function referenceSlideStyle(source: string, slideIndex: number) {
  const scenes = parseMotionDoc(source).scenes;
  const reference = scenes[Math.max(0, Math.min(slideIndex, Math.max(scenes.length - 1, 0)))];
  return {
    accent: stringMotionProp(reference?.props.accent, "#ffffff"),
    background: stringMotionProp(reference?.props.background, "#050505"),
    textColor: stringMotionProp(reference?.props.textColor, ""),
    theme: stringMotionProp(reference?.props.theme, "dark")
  };
}

function stringMotionProp(value: string | number | undefined, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

export function applyLayoutToSlide(slide: MotionDocScene, layoutSource: string, layoutId: string) {
  const parsed = parseMotionDoc(`<Slide duration={${slide.duration}}>\n${layoutSource}\n</Slide>`);
  const layoutSlide = parsed.scenes[0];

  if (!layoutSlide) return slide;

  return applyLayoutBlocksToSlide(
    slide,
    normalizeLayoutBlocksTextMotion(layoutSlide.blocks),
    layoutId
  );
}

export function applyTemplateSlideToSlide(
  slide: MotionDocScene,
  templateSlideSource: string
) {
  return applyTemplateSlideSourceToSlide(slide, templateSlideSource);
}

function normalizeLayoutSourceTextMotion(layoutSource: string) {
  const parsed = parseMotionDoc(`<Slide duration={5}>\n${layoutSource}\n</Slide>`);
  const layoutSlide = parsed.scenes[0];

  if (!layoutSlide) {
    return layoutSource;
  }

  return normalizeLayoutBlocksTextMotion(layoutSlide.blocks)
    .map((block) => generateBlockString(block))
    .join("\n");
}

function normalizeLayoutBlocksTextMotion(blocks: MotionDocBlock[]) {
  return blocks.map((block) => {
    if (block.type !== "Text" || !("props" in block)) {
      return block;
    }

    const nextProps: MotionDocProps = normalizeElementMotionProps({ ...block.props, enter: "none" });
    delete nextProps.borderRadius;
    delete nextProps.delay;
    delete nextProps.duration;
    delete nextProps.radius;

    return {
      ...block,
      props: nextProps
    } as MotionDocBlock;
  });
}

export function deleteSlideSource(source: string, slideIndex: number) {
  return deleteMotionDocSlideSource(source, slideIndex);
}

export function replaceSlideSource(source: string, slideIndex: number, slide: MotionDocScene) {
  return replaceMotionDocSlideSource(source, slideIndex, generateSlideString(slide));
}

export function reorderSlideSource(source: string, fromIndex: number, toIndex: number) {
  return reorderMotionDocSlideSource(source, fromIndex, toIndex);
}

export function duplicateSlideSource(source: string, slideIndex: number) {
  const ranges = motionDocSlideSourceRanges(source);
  const targetIndex = Math.max(0, Math.min(slideIndex, Math.max(ranges.length - 1, 0)));
  const sourceSlide = ranges[targetIndex];
  return sourceSlide
    ? insertMotionDocSlideSource(source, targetIndex, sourceSlide.source, "after")
    : source;
}

export function selectedLayerIndices(selectedBlockIndices: number[], selectedBlockIndex: number | null, sort: "asc" | "desc" = "asc") {
  const indices = selectedBlockIndices.length > 0 ? selectedBlockIndices : selectedBlockIndex === null ? [] : [selectedBlockIndex];

  return indices
    .filter((index, offset, items) => items.indexOf(index) === offset)
    .sort((a, b) => (sort === "desc" ? b - a : a - b));
}

export function deleteBlockAt(slide: MotionDocScene, blockIndex: number) {
  const blocks = [...slide.blocks];
  blocks.splice(blockIndex, 1);

  return { ...slide, blocks };
}

export function deleteBlocks(slide: MotionDocScene, blockIndices: number[]) {
  const blocks = [...slide.blocks];

  for (const index of blockIndices) {
    blocks.splice(index, 1);
  }

  return { ...slide, blocks };
}

export function duplicateBlockAt(slide: MotionDocScene, blockIndex: number) {
  const block = slide.blocks[blockIndex];

  if (!block) {
    return null;
  }

  const blocks = [...slide.blocks];
  const duplicate = offsetDuplicatedBlock(withNewMotionDocBlockId(cloneBlock(block)));
  const insertIndex = Math.min(blockIndex + 1, blocks.length);

  blocks.splice(insertIndex, 0, duplicate);

  return {
    blockIndex: insertIndex,
    slide: { ...slide, blocks }
  };
}

export function moveBlockByDirection(slide: MotionDocScene, blockIndex: number, direction: -1 | 1) {
  const nextIndex = blockIndex + direction;

  if (nextIndex < 0 || nextIndex >= slide.blocks.length) {
    return null;
  }

  const blocks = [...slide.blocks];
  const temp = blocks[blockIndex];
  blocks[blockIndex] = blocks[nextIndex];
  blocks[nextIndex] = temp;

  return { ...slide, blocks };
}

export function pasteBlockIntoSlide(slide: MotionDocScene, copiedBlock: MotionDocBlock, selectedBlockIndex: number | null) {
  const blocks = [...slide.blocks];
  const insertIndex = selectedBlockIndex === null ? blocks.length : Math.min(selectedBlockIndex + 1, blocks.length);

  blocks.splice(insertIndex, 0, withNewMotionDocBlockId(cloneBlock(copiedBlock)));

  return {
    blockIndex: insertIndex,
    slide: { ...slide, blocks }
  };
}

export function pasteBlocksIntoSlide(slide: MotionDocScene, copiedBlocks: MotionDocBlock[], selectedBlockIndex: number | null, options: { offset?: boolean } = {}) {
  const blocks = [...slide.blocks];
  const insertIndex = selectedBlockIndex === null ? blocks.length : Math.min(selectedBlockIndex + 1, blocks.length);
  const groupIds = new Map<string, string>();
  const pastedBlocks = copiedBlocks.map((block) => {
    const identifiedClone = withNewMotionDocBlockId(cloneBlock(block));
    const clone = options.offset ? offsetDuplicatedBlock(identifiedClone) : identifiedClone;
    if (!("props" in clone) || typeof clone.props.groupId !== "string") return clone;
    const nextGroupId = groupIds.get(clone.props.groupId) ?? `group-${Date.now().toString(36)}-${groupIds.size}`;
    groupIds.set(clone.props.groupId, nextGroupId);
    return { ...clone, props: { ...clone.props, groupId: nextGroupId } } as MotionDocBlock;
  });

  blocks.splice(insertIndex, 0, ...pastedBlocks);

  return {
    blockIndices: pastedBlocks.map((_, offset) => insertIndex + offset),
    slide: { ...slide, blocks }
  };
}

export function moveBlocksToEdge(slide: MotionDocScene, blockIndices: number[], edge: "back" | "front") {
  const selected = new Set(blockIndices);
  const moving = slide.blocks.filter((_, index) => selected.has(index));
  const remaining = slide.blocks.filter((_, index) => !selected.has(index));
  const blocks = edge === "front" ? [...remaining, ...moving] : [...moving, ...remaining];

  return {
    blockIndices: edge === "front"
      ? moving.map((_, offset) => remaining.length + offset)
      : moving.map((_, offset) => offset),
    slide: { ...slide, blocks }
  };
}

export function canGroupBlocks(slide: MotionDocScene, blockIndices: readonly number[]) {
  const uniqueIndices = [...new Set(blockIndices)];
  if (uniqueIndices.length < 2) return false;

  return uniqueIndices.every((index) => {
    const block = slide.blocks[index];
    return Boolean(
      block &&
      "props" in block &&
      !(typeof block.props.groupId === "string" && block.props.groupId.trim())
    );
  });
}

export function groupBlocks(slide: MotionDocScene, blockIndices: number[], groupId: string) {
  const sortedIndices = [...new Set(blockIndices)].sort((a, b) => a - b);
  if (!canGroupBlocks(slide, sortedIndices)) {
    return { blockIndices: sortedIndices, slide };
  }

  const selected = new Set(sortedIndices);
  const insertionIndex = sortedIndices[0] ?? 0;
  const grouped = slide.blocks.filter((_, index) => selected.has(index)).map((block) => {
    if (!("props" in block)) return block;
    return { ...block, props: { ...block.props, groupId, groupName: "Group" } } as MotionDocBlock;
  });
  const remaining = slide.blocks.filter((_, index) => !selected.has(index));
  remaining.splice(insertionIndex, 0, ...grouped);
  return {
    blockIndices: grouped.map((_, offset) => insertionIndex + offset),
    slide: { ...slide, blocks: remaining }
  };
}

export function ungroupBlocks(slide: MotionDocScene, blockIndices: number[]) {
  const groupIds = new Set(blockIndices.map((index) => {
    const block = slide.blocks[index];
    return block && "props" in block && typeof block.props.groupId === "string" ? block.props.groupId : "";
  }).filter(Boolean));

  return {
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (!("props" in block) || typeof block.props.groupId !== "string" || !groupIds.has(block.props.groupId)) return block;
      const props = { ...block.props };
      delete props.groupId;
      delete props.groupName;
      return { ...block, props } as MotionDocBlock;
    })
  };
}

export function renameLayer(slide: MotionDocScene, blockIndex: number, name: string) {
  const block = slide.blocks[blockIndex];
  if (!block || !("props" in block)) return slide;
  const blocks = [...slide.blocks];
  const props = { ...block.props };
  if (name.trim()) props.layerName = name.trim();
  else delete props.layerName;
  blocks[blockIndex] = { ...block, props } as MotionDocBlock;
  return { ...slide, blocks };
}

export function reorderBlocks(slide: MotionDocScene, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) {
    return null;
  }

  const blocks = [...slide.blocks];
  const [movedItem] = blocks.splice(fromIndex, 1);
  blocks.splice(toIndex, 0, movedItem);

  return { ...slide, blocks };
}

export function toggleBlocksPositionLock(slide: MotionDocScene, blockIndices: number[]) {
  const blocks = [...slide.blocks];
  const shouldLock = blockIndices.some((blockIndex) => {
    const block = blocks[blockIndex];
    return block && "props" in block && !isPositionLocked(block);
  });
  let didUpdate = false;

  for (const blockIndex of blockIndices) {
    const currentBlock = blocks[blockIndex];

    if (!currentBlock || !("props" in currentBlock)) {
      continue;
    }

    const nextProps = { ...currentBlock.props };

    if (shouldLock) {
      nextProps.lockPosition = "true";
    } else {
      delete nextProps.lockPosition;
      delete nextProps.locked;
    }

    blocks[blockIndex] = {
      ...currentBlock,
      props: nextProps
    } as MotionDocBlock;
    didUpdate = true;
  }

  return {
    didUpdate,
    locked: shouldLock,
    slide: { ...slide, blocks }
  };
}

export function imageBlockAsSlideBackground(slide: MotionDocScene, blockIndex: number) {
  const block = slide.blocks[blockIndex];

  if (!block || block.type !== "ImageBlock") {
    return null;
  }

  const src = typeof block.props.src === "string" ? block.props.src.trim() : "";

  if (!src) {
    return null;
  }

  const fit = typeof block.props.fit === "string" && block.props.fit ? block.props.fit : "cover";
  const blocks = [...slide.blocks];
  blocks.splice(blockIndex, 1);

  return {
    slide: {
      ...slide,
      blocks,
      props: {
        ...slide.props,
        backgroundFit: fit,
        backgroundImage: src,
        shader: ""
      }
    }
  };
}

export function appendBlockToSlide(slide: MotionDocScene, type: AddBlockType, options: AddBlockOptions = {}) {
  const blocks = [...slide.blocks];
  const block = blockWithOptions(createMotionDocBlock(type), options);

  blocks.push(block);

  return {
    blockIndex: blocks.length - 1,
    slide: { ...slide, blocks }
  };
}

function blockWithOptions(block: MotionDocBlock, options: AddBlockOptions): MotionDocBlock {
  if (!("props" in block)) {
    return block;
  }

  return {
    ...block,
    props: {
      ...block.props,
      ...options.props,
      ...(options.position ? { x: Math.min(Math.max(options.position.x, 0), 92), y: Math.min(Math.max(options.position.y, 0), 92) } : {})
    }
  } as MotionDocBlock;
}

export function appendTextBlockAtPosition(
  slide: MotionDocScene,
  position: { x: number; y: number },
  props: MotionDocProps = {}
) {
  const blocks = [...slide.blocks];
  const block: MotionDocBlock = {
    type: "Text",
    props: {
      enter: "none",
      fontSize: MOTION_DOC_FONT_SIZES.body,
      h: 9,
      x: Math.min(Math.max(position.x, 0), 70),
      y: Math.min(Math.max(position.y, 0), 88),
      w: 30,
      ...props
    },
    text: "Double-click text"
  };

  blocks.push(block);

  return {
    blockIndex: blocks.length - 1,
    slide: { ...slide, blocks }
  };
}

export function updatePositionedBlockFrames(slide: MotionDocScene, updates: BlockFramePatch[]) {
  const blocks = [...slide.blocks];

  for (const { blockIndex, frame } of updates) {
    const currentBlock = blocks[blockIndex];

    if (!currentBlock || !("props" in currentBlock) || isPositionLocked(currentBlock)) {
      continue;
    }

    const nextProps = {
      ...currentBlock.props,
      w: currentBlock.props.w ?? defaultBlockWidth(currentBlock.type),
      h: currentBlock.props.h ?? defaultBlockHeight(currentBlock.type),
      ...frame
    };

    blocks[blockIndex] = { ...currentBlock, props: nextProps };
  }

  return { ...slide, blocks };
}

export function nudgeBlocks(slide: MotionDocScene, blockIndices: number[], delta: PositionDelta) {
  const blocks = [...slide.blocks];
  let didMove = false;

  for (const blockIndex of blockIndices) {
    const currentBlock = blocks[blockIndex];

    if (!currentBlock || !("props" in currentBlock) || isPositionLocked(currentBlock)) {
      continue;
    }

    const w = percentFrameValue(currentBlock.props.w, defaultBlockWidth(currentBlock.type));
    const h = percentFrameValue(currentBlock.props.h, defaultBlockHeight(currentBlock.type));
    const x = framePositionValue(currentBlock.props.x, defaultBlockX(currentBlock.type));
    const y = framePositionValue(currentBlock.props.y, defaultBlockY(currentBlock.type));

    blocks[blockIndex] = {
      ...currentBlock,
      props: {
        ...currentBlock.props,
        h: currentBlock.props.h ?? h,
        w: currentBlock.props.w ?? w,
        x: clampFramePosition(x + delta.x, w),
        y: clampFramePosition(y + delta.y, h)
      }
    } as MotionDocBlock;
    didMove = true;
  }

  return {
    didMove,
    slide: { ...slide, blocks }
  };
}

export function isPositionLocked(block: MotionDocBlock) {
  if (!("props" in block)) {
    return false;
  }

  return block.props.lockPosition === "true" || block.props.lockPosition === 1 || block.props.locked === "true" || block.props.locked === 1;
}

function offsetDuplicatedBlock(block: MotionDocBlock): MotionDocBlock {
  if (!("props" in block)) {
    return block;
  }

  const frame = blockFrameFromProps(block);

  return {
    ...block,
    props: {
      ...block.props,
      x: clampFramePosition(frame.x + 16 / 1920 * 100, frame.w),
      y: clampFramePosition(frame.y + 16 / 1080 * 100, frame.h)
    }
  } as MotionDocBlock;
}

function blockFrameFromProps(block: Extract<MotionDocBlock, { props: MotionDocProps }>) {
  return {
    h: percentFrameValue(block.props.h, defaultBlockHeight(block.type)),
    w: percentFrameValue(block.props.w, defaultBlockWidth(block.type)),
    x: framePositionValue(block.props.x, defaultBlockX(block.type)),
    y: framePositionValue(block.props.y, defaultBlockY(block.type))
  };
}

export function applySlideStyleSource(source: string, slide: MotionDocScene, slideIndex: number, updates: MotionDocProps) {
  const normalizedSource = materializeFreeformSource(source);
  const sourceSlide = parseMotionDoc(normalizedSource).scenes[slideIndex] ?? slide;
  const nextProps = {
    ...sourceSlide.props,
    duration: sourceSlide.duration,
    ...updates
  };

  return replaceSlideOpeningTag(normalizedSource, slideIndex, nextProps);
}

export function applyAllSlidesStyleSource(source: string, slides: MotionDocScene[], updates: MotionDocProps) {
  return slides.reduce((nextSource, slide, index) => applySlideStyleSource(nextSource, slide, index, updates), source);
}

export function updateBlockInSlide(
  slide: MotionDocScene,
  blockIndex: number,
  newProps: MotionDocProps,
  newText?: string
) {
  const blocks = [...slide.blocks];
  const currentBlock = blocks[blockIndex];

  if (!currentBlock) {
    return null;
  }

  if (currentBlock.type === "Text" || currentBlock.type === "heading") {
    const nextProps = withoutTextFrameOnlyProps(normalizeElementMotionProps(newProps));

    blocks[blockIndex] = {
      type: currentBlock.type,
      props: nextProps,
      text: newText ?? ("text" in currentBlock ? currentBlock.text : "")
    } as MotionDocBlock;
  } else {
    blocks[blockIndex] = {
      type: currentBlock.type,
      props: normalizeElementMotionProps(newProps)
    } as MotionDocBlock;
  }

  return {
    ...slide,
    blocks
  };
}

function withoutTextFrameOnlyProps(props: MotionDocProps) {
  const { borderRadius, radius, ...rest } = props;
  void borderRadius;
  void radius;

  return rest;
}

export function applySelectionMdxSource({
  activeSlide,
  activeSlideIndex,
  selectedBlockIndex,
  selectedBlockIndices,
  source,
  value
}: {
  activeSlide: MotionDocScene;
  activeSlideIndex: number;
  selectedBlockIndex: number | null;
  selectedBlockIndices?: number[];
  source: string;
  value: string;
}): ApplySelectionMdxResult {
  if (selectedBlockIndex === null) {
    const parsed = parseMotionDoc(value);
    const nextSlide = parsed.scenes[0];

    if (!nextSlide) {
      return { error: "Selection MDX needs one Slide" };
    }

    return {
      notice: "Scene MDX updated",
      source: replaceSlideSource(source, activeSlideIndex, nextSlide)
    };
  }

  const parsed = parseMotionDoc(`<Slide duration={5}>\n${value}\n</Slide>`);
  const nextBlocks = parsed.scenes[0]?.blocks ?? [];
  const nextBlock = nextBlocks[0];

  if (!nextBlock) {
    return { error: "Selection MDX needs one layer" };
  }

  const indices = selectedLayerIndices(selectedBlockIndices ?? [], selectedBlockIndex);
  const blocks = [...activeSlide.blocks];
  if (indices.length > 1 || nextBlocks.length > 1) {
    const insertIndex = indices[0] ?? selectedBlockIndex;
    for (const index of [...indices].sort((a, b) => b - a)) blocks.splice(index, 1);
    blocks.splice(insertIndex, 0, ...nextBlocks);
  } else {
    blocks[selectedBlockIndex] = nextBlock;
  }

  return {
    notice: "Layer MDX updated",
    source: replaceSlideSource(source, activeSlideIndex, {
      ...activeSlide,
      blocks
    })
  };
}
