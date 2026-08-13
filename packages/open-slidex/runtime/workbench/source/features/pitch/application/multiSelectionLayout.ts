import { clampFramePosition, motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlock, MotionDocBlockWithProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";

export const selectionAlignments = ["left", "center", "right", "top", "middle", "bottom"] as const;
export type SelectionAlignment = typeof selectionAlignments[number];

export const selectionDistributions = ["horizontal", "vertical"] as const;
export type SelectionDistribution = typeof selectionDistributions[number];

type SelectedFrame = {
  block: MotionDocBlockWithProps;
  blockIndex: number;
  frame: ReturnType<typeof motionDocBlockFrame>;
};

export type SelectionLayoutResult = {
  didUpdate: boolean;
  slide: MotionDocScene;
};

export function canArrangeSelectedBlocks(slide: MotionDocScene | undefined, blockIndices: readonly number[]) {
  if (!slide) return false;
  const frames = selectedFrames(slide, blockIndices);
  return frames.length >= 2
    && frames.length === selectedIndexCount(blockIndices)
    && frames.every(({ block }) => !isLockedBlock(block));
}

export function alignSelectedBlocks(
  slide: MotionDocScene,
  blockIndices: readonly number[],
  alignment: SelectionAlignment
): SelectionLayoutResult {
  const frames = selectedFrames(slide, blockIndices);
  if (
    frames.length < 2
    || frames.length !== selectedIndexCount(blockIndices)
    || frames.some(({ block }) => isLockedBlock(block))
  ) {
    return { didUpdate: false, slide };
  }

  const left = Math.min(...frames.map(({ frame }) => frame.x));
  const right = Math.max(...frames.map(({ frame }) => frame.x + frame.w));
  const top = Math.min(...frames.map(({ frame }) => frame.y));
  const bottom = Math.max(...frames.map(({ frame }) => frame.y + frame.h));
  const center = (left + right) / 2;
  const middle = (top + bottom) / 2;

  return updateSelectedFrames(slide, frames, ({ frame }) => {
    if (alignment === "left") return { x: left };
    if (alignment === "center") return { x: center - frame.w / 2 };
    if (alignment === "right") return { x: right - frame.w };
    if (alignment === "top") return { y: top };
    if (alignment === "middle") return { y: middle - frame.h / 2 };
    return { y: bottom - frame.h };
  });
}

export function distributeSelectedBlocks(
  slide: MotionDocScene,
  blockIndices: readonly number[],
  distribution: SelectionDistribution
): SelectionLayoutResult {
  const frames = selectedFrames(slide, blockIndices);
  if (
    frames.length < 3
    || frames.length !== selectedIndexCount(blockIndices)
    || frames.some(({ block }) => isLockedBlock(block))
  ) {
    return { didUpdate: false, slide };
  }

  const axis = distribution === "horizontal" ? "x" : "y";
  const size = distribution === "horizontal" ? "w" : "h";
  const sorted = [...frames].sort((first, second) => first.frame[axis] - second.frame[axis]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return { didUpdate: false, slide };

  const start = first.frame[axis];
  const end = last.frame[axis] + last.frame[size];
  const totalSize = sorted.reduce((sum, item) => sum + item.frame[size], 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);
  let cursor = start;
  const positions = new Map<number, number>();

  sorted.forEach((item) => {
    positions.set(item.blockIndex, cursor);
    cursor += item.frame[size] + gap;
  });

  return updateSelectedFrames(slide, frames, ({ blockIndex }) => (
    distribution === "horizontal"
      ? { x: positions.get(blockIndex) }
      : { y: positions.get(blockIndex) }
  ));
}

export function snapSelectedBlocksToGrid(
  slide: MotionDocScene,
  blockIndices: readonly number[],
  gridSizePx = 8
): SelectionLayoutResult {
  const frames = selectedFrames(slide, blockIndices);
  if (
    frames.length === 0
    || frames.length !== selectedIndexCount(blockIndices)
    || frames.some(({ block }) => isLockedBlock(block))
  ) return { didUpdate: false, slide };

  const blocks = [...slide.blocks];
  let didUpdate = false;
  frames.forEach(({ block, blockIndex, frame }) => {
    const x = snappedPercent(frame.x, MOTION_DOC_CANVAS_WIDTH, gridSizePx);
    const y = snappedPercent(frame.y, MOTION_DOC_CANVAS_HEIGHT, gridSizePx);
    const w = Math.max(snappedPercent(frame.w, MOTION_DOC_CANVAS_WIDTH, gridSizePx), gridSizePx / MOTION_DOC_CANVAS_WIDTH * 100);
    const h = Math.max(snappedPercent(frame.h, MOTION_DOC_CANVAS_HEIGHT, gridSizePx), gridSizePx / MOTION_DOC_CANVAS_HEIGHT * 100);
    if (x === frame.x && y === frame.y && w === frame.w && h === frame.h) return;
    blocks[blockIndex] = { ...block, props: { ...block.props, h, w, x, y } } as MotionDocBlock;
    didUpdate = true;
  });
  return didUpdate ? { didUpdate, slide: { ...slide, blocks } } : { didUpdate, slide };
}

function snappedPercent(value: number, canvasSize: number, gridSizePx: number) {
  const pixels = value / 100 * canvasSize;
  return Math.round(Math.round(pixels / gridSizePx) * gridSizePx / canvasSize * 1000) / 10;
}

function selectedFrames(slide: MotionDocScene, blockIndices: readonly number[]) {
  return [...new Set(blockIndices)]
    .map((blockIndex) => ({ block: slide.blocks[blockIndex], blockIndex }))
    .filter((item): item is { block: MotionDocBlock; blockIndex: number } => Boolean(item.block))
    .filter(({ block }) => hasPositionedFrame(block))
    .map(({ block, blockIndex }) => ({ block, blockIndex, frame: motionDocBlockFrame(block) })) satisfies SelectedFrame[];
}

function selectedIndexCount(blockIndices: readonly number[]) {
  return new Set(blockIndices).size;
}

function updateSelectedFrames(
  slide: MotionDocScene,
  frames: readonly SelectedFrame[],
  positionForFrame: (frame: SelectedFrame) => { x?: number; y?: number }
): SelectionLayoutResult {
  const blocks = [...slide.blocks];
  let didUpdate = false;

  frames.forEach((item) => {
    const position = positionForFrame(item);
    const x = position.x === undefined ? item.frame.x : clampFramePosition(position.x, item.frame.w);
    const y = position.y === undefined ? item.frame.y : clampFramePosition(position.y, item.frame.h);
    if (x === item.frame.x && y === item.frame.y) return;

    blocks[item.blockIndex] = {
      ...item.block,
      props: { ...item.block.props, x, y }
    } as MotionDocBlock;
    didUpdate = true;
  });

  return didUpdate ? { didUpdate, slide: { ...slide, blocks } } : { didUpdate, slide };
}

function hasPositionedFrame(block: MotionDocBlock): block is MotionDocBlockWithProps {
  return "props" in block && (Number.isFinite(Number(block.props.x)) || Number.isFinite(Number(block.props.y)));
}

function isLockedBlock(block: MotionDocBlock) {
  if (!("props" in block)) return false;
  return block.props.lockPosition === "true"
    || block.props.lockPosition === 1
    || block.props.locked === "true"
    || block.props.locked === 1;
}
