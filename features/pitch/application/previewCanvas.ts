import {
  clampFramePosition,
  clampPercent,
  motionDocBlockFrame,
  roundFrameDimension,
  roundFramePosition,
  type MotionDocFrame
} from "@/core/motion-doc/domain/frame";
import type {
  MotionDocBlockWithProps,
  MotionDocScene,
  MotionDocTableBlock,
  MotionDocTextBlock
} from "@/core/motion-doc/domain/motionDocTypes";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { blockRotation, normalizeBlockRotation } from "@/core/motion-doc/domain/blockTransform";
import type { ResolvedBlockFrameUpdate } from "@/features/pitch/application/pitchGeometry";

export const CANVAS_WIDTH = MOTION_DOC_CANVAS_WIDTH;
export const CANVAS_HEIGHT = MOTION_DOC_CANVAS_HEIGHT;

const MIN_FRAME_WIDTH = 2;
const MIN_FRAME_HEIGHT = 2;
const GUIDE_THRESHOLD = 0.7;

export type ResizeHandle = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

export function shouldClearActiveSlideFrameSelection({
  insideCanvas,
  isFrameControl
}: {
  insideCanvas: boolean;
  isFrameControl: boolean;
}) {
  return !insideCanvas && !isFrameControl;
}

export type CanvasPoint = { x: number; y: number };
export type CanvasInteraction = {
  blockId: string;
  blockIndex: number;
  handle?: ResizeHandle;
  lockAspectRatio?: boolean;
  mode: "line-endpoint" | "move" | "resize" | "rotate";
  rotation?: number;
  rotationCenter?: CanvasPoint;
  startFrame: MotionDocFrame;
  startFrames: ResolvedBlockFrameUpdate[];
  startPointer: CanvasPoint;
};
export type MarqueeSelection = {
  additive: boolean;
  current: CanvasPoint;
  pointerId: number;
  start: CanvasPoint;
};
export type AlignmentGuide = {
  orientation: "horizontal" | "vertical";
  position: number;
};
export type FrameSnapInteraction = {
  handle?: ResizeHandle;
  mode: "move" | "resize";
};
export type SelectionSpacingGuide = {
  axis: "horizontal" | "vertical";
  crossPosition: number;
  end: number;
  gapPercent: number;
  gapPx: number;
  start: number;
  status: "even" | "overlap" | "tight" | "uneven";
};

export type MovableBlock = MotionDocBlockWithProps;

export const resizeHandles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const satisfies ReadonlyArray<ResizeHandle>;

export function canvasPointFromRect(
  event: { clientX: number; clientY: number },
  rect: { height: number; left: number; top: number; width: number } | undefined
): CanvasPoint {
  if (!rect) {
    return { x: 0, y: 0 };
  }

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  return {
    x: clampPercent(Math.min(Math.max(x, 0), 100)),
    y: clampPercent(Math.min(Math.max(y, 0), 100))
  };
}

export function hiddenEditablePreviewBlockIndices(
  blocks: MotionDocScene["blocks"],
  selectedBlockIndex: number | null,
  selectedBlockIndices: readonly number[]
) {
  const selectedIndices = new Set(selectedBlockIndices);

  if (selectedBlockIndex !== null) {
    selectedIndices.add(selectedBlockIndex);
  }

  const resolvedIndices = [...selectedIndices];
  const isMultiSelection = resolvedIndices.length > 1;
  const groupId = selectedGroupId(blocks, resolvedIndices);

  if (isMultiSelection && !groupId) {
    return [];
  }

  return blocks
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter(({ block, blockIndex }) => (
      selectedIndices.has(blockIndex) &&
      isMovableBlock(block) &&
      (isEditableTextBlock(block) || (!groupId && isEditableTableBlock(block)))
    ))
    .map(({ blockIndex }) => blockIndex);
}

export function selectedGroupId(
  blocks: MotionDocScene["blocks"],
  indices: readonly number[]
) {
  const selectedIndices = new Set(indices);
  if (selectedIndices.size < 2) return null;

  const firstIndex = selectedIndices.values().next().value;
  const firstBlock = firstIndex === undefined ? undefined : blocks[firstIndex];
  const groupId = firstBlock && "props" in firstBlock && typeof firstBlock.props.groupId === "string"
    ? firstBlock.props.groupId.trim()
    : "";
  if (!groupId) return null;

  const selectedIsOneGroup = [...selectedIndices].every((index) => {
    const block = blocks[index];
    return block && "props" in block && block.props.groupId === groupId;
  });
  if (!selectedIsOneGroup) return null;

  const completeGroupIsSelected = blocks.every((block, index) => (
    !("props" in block) ||
    block.props.groupId !== groupId ||
    selectedIndices.has(index)
  ));

  return completeGroupIsSelected ? groupId : null;
}

export function isTextOnlySelection(blocks: MotionDocScene["blocks"], indices: readonly number[]) {
  return indices.length > 0 && indices.every((index) => {
    const block = blocks[index];
    return block ? isEditableTextBlock(block) : false;
  });
}

export function isMovableBlock(block: MotionDocScene["blocks"][number]): block is MovableBlock {
  if (!("props" in block)) return false;

  // These native frame blocks have a deterministic default MotionDoc frame.
  // They must remain selectable even when an author has not persisted x/y yet;
  // otherwise their move, resize, and rotate tools never receive pointer input.
  if (
    block.type === "ImageBlock" ||
    block.type === "VideoBlock" ||
    block.type === "Chart" ||
    block.type === "Table" ||
    block.type === "Shape"
  ) {
    return true;
  }

  return Number.isFinite(Number(block.props.x)) || Number.isFinite(Number(block.props.y));
}

export function isEditableTextBlock(block: MotionDocScene["blocks"][number]): block is MotionDocTextBlock {
  return block.type === "Text" && "props" in block && "text" in block;
}

export function isEditableTableBlock(block: MotionDocScene["blocks"][number]): block is MotionDocTableBlock {
  return block.type === "Table" && "props" in block;
}

export function blockFrame(block: MotionDocScene["blocks"][number] | undefined): MotionDocFrame {
  return motionDocBlockFrame(block);
}

export function interactionFrameUpdates(
  interaction: CanvasInteraction,
  pointer: CanvasPoint,
  options: { preserveAspectRatio?: boolean } = {}
): ResolvedBlockFrameUpdate[] {
  const dx = pointer.x - interaction.startPointer.x;
  const dy = pointer.y - interaction.startPointer.y;

  if (interaction.mode === "line-endpoint") {
    return [];
  }

  if (interaction.mode === "resize" && interaction.handle) {
    const localDelta = rotateCanvasDelta(dx, dy, -(interaction.rotation ?? 0));
    const resizedFrame = resizeFrame(
      interaction.startFrame,
      localDelta.x,
      localDelta.y,
      interaction.handle,
      { preserveAspectRatio: options.preserveAspectRatio }
    );

    if (interaction.startFrames.length > 1) {
      return resizeSelectionFrames(interaction.startFrame, resizedFrame, interaction.startFrames);
    }

    return [
      {
        blockId: interaction.blockId,
        blockIndex: interaction.blockIndex,
        frame: resizedFrame
      }
    ];
  }

  return interaction.startFrames.map(({ blockId, blockIndex, frame }) => ({
    blockId,
    blockIndex,
    frame: {
      h: frame.h,
      w: frame.w,
      x: clampFramePosition(frame.x + dx, frame.w),
      y: clampFramePosition(frame.y + dy, frame.h)
    }
  }));
}

export type LineEndpoint = "end" | "start";

export function lineFrameEndpoints(frame: MotionDocFrame, rotation: number) {
  const centerX = (frame.x + frame.w / 2) / 100 * CANVAS_WIDTH;
  const centerY = (frame.y + frame.h / 2) / 100 * CANVAS_HEIGHT;
  const halfLength = frame.w / 100 * CANVAS_WIDTH / 2;
  const radians = rotation * Math.PI / 180;
  const offsetX = Math.cos(radians) * halfLength;
  const offsetY = Math.sin(radians) * halfLength;

  return {
    end: {
      x: (centerX + offsetX) / CANVAS_WIDTH * 100,
      y: (centerY + offsetY) / CANVAS_HEIGHT * 100
    },
    start: {
      x: (centerX - offsetX) / CANVAS_WIDTH * 100,
      y: (centerY - offsetY) / CANVAS_HEIGHT * 100
    }
  } satisfies Record<LineEndpoint, CanvasPoint>;
}

export function lineFrameForEndpoint(
  frame: MotionDocFrame,
  rotation: number,
  endpoint: LineEndpoint,
  pointer: CanvasPoint
) {
  const endpoints = lineFrameEndpoints(frame, rotation);
  const fixed = endpoint === "start" ? endpoints.end : endpoints.start;
  const fixedPx = canvasPointToPixels(fixed);
  const pointerPx = canvasPointToPixels(pointer);
  const rawX = endpoint === "start" ? fixedPx.x - pointerPx.x : pointerPx.x - fixedPx.x;
  const rawY = endpoint === "start" ? fixedPx.y - pointerPx.y : pointerPx.y - fixedPx.y;
  const rawLength = Math.hypot(rawX, rawY);
  const previousRadians = rotation * Math.PI / 180;
  const unitX = rawLength > 0.001 ? rawX / rawLength : Math.cos(previousRadians);
  const unitY = rawLength > 0.001 ? rawY / rawLength : Math.sin(previousRadians);
  const length = Math.min(Math.max(rawLength, MIN_FRAME_WIDTH / 100 * CANVAS_WIDTH), CANVAS_WIDTH);
  const movingPx = endpoint === "start"
    ? { x: fixedPx.x - unitX * length, y: fixedPx.y - unitY * length }
    : { x: fixedPx.x + unitX * length, y: fixedPx.y + unitY * length };
  const centerPx = {
    x: (fixedPx.x + movingPx.x) / 2,
    y: (fixedPx.y + movingPx.y) / 2
  };
  const width = length / CANVAS_WIDTH * 100;

  return {
    frame: {
      h: frame.h,
      w: clampPercent(width),
      x: clampFramePosition(centerPx.x / CANVAS_WIDTH * 100 - width / 2, width),
      y: clampFramePosition(centerPx.y / CANVAS_HEIGHT * 100 - frame.h / 2, frame.h)
    },
    rotation: normalizeBlockRotation(Math.atan2(unitY, unitX) * 180 / Math.PI)
  };
}

function canvasPointToPixels(point: CanvasPoint) {
  return {
    x: point.x / 100 * CANVAS_WIDTH,
    y: point.y / 100 * CANVAS_HEIGHT
  };
}

export function resizeSelectionFrames(
  selectionFrame: MotionDocFrame,
  resizedSelectionFrame: MotionDocFrame,
  frames: readonly ResolvedBlockFrameUpdate[]
): ResolvedBlockFrameUpdate[] {
  const scaleX = selectionFrame.w === 0 ? 1 : resizedSelectionFrame.w / selectionFrame.w;
  const scaleY = selectionFrame.h === 0 ? 1 : resizedSelectionFrame.h / selectionFrame.h;

  return frames.map(({ blockId, blockIndex, frame }) => ({
    blockId,
    blockIndex,
    frame: {
      h: roundFrameDimension(frame.h * scaleY),
      w: roundFrameDimension(frame.w * scaleX),
      x: roundFramePosition(resizedSelectionFrame.x + (frame.x - selectionFrame.x) * scaleX),
      y: roundFramePosition(resizedSelectionFrame.y + (frame.y - selectionFrame.y) * scaleY)
    }
  }));
}

export function resizeFrame(
  frame: MotionDocFrame,
  dx: number,
  dy: number,
  handle: ResizeHandle,
  options: { preserveAspectRatio?: boolean } = {}
): MotionDocFrame {
  let nextX = frame.x;
  let nextY = frame.y;
  let nextW = frame.w;
  let nextH = frame.h;

  if (handle.includes("e")) {
    nextW = Math.min(Math.max(frame.w + dx, MIN_FRAME_WIDTH), 200);
  }

  if (handle.includes("s")) {
    nextH = Math.min(Math.max(frame.h + dy, MIN_FRAME_HEIGHT), 200);
  }

  if (handle.includes("w")) {
    const maxLeftDelta = frame.w - MIN_FRAME_WIDTH;
    const leftDelta = Math.min(Math.max(dx, -100 - frame.x), maxLeftDelta);
    nextX = frame.x + leftDelta;
    nextW = frame.w - leftDelta;
  }

  if (handle.includes("n")) {
    const maxTopDelta = frame.h - MIN_FRAME_HEIGHT;
    const topDelta = Math.min(Math.max(dy, -100 - frame.y), maxTopDelta);
    nextY = frame.y + topDelta;
    nextH = frame.h - topDelta;
  }

  const resized = {
    h: roundFrameDimension(nextH),
    w: roundFrameDimension(nextW),
    x: roundFramePosition(nextX),
    y: roundFramePosition(nextY)
  };

  return options.preserveAspectRatio
    ? constrainFrameAspectRatio(frame, resized, handle)
    : resized;
}

export function rotationForPointer(interaction: CanvasInteraction, pointer: CanvasPoint, snap = false) {
  if (interaction.mode !== "rotate" || !interaction.rotationCenter) return interaction.rotation ?? 0;
  const startAngle = canvasAngle(interaction.rotationCenter, interaction.startPointer);
  const currentAngle = canvasAngle(interaction.rotationCenter, pointer);
  const raw = (interaction.rotation ?? 0) + currentAngle - startAngle;
  const snapped = snap ? Math.round(raw / 15) * 15 : raw;
  return Math.round(snapped * 10) / 10;
}

export function stackedBlockIndicesAtPoint(blocks: MotionDocScene["blocks"], point: CanvasPoint) {
  return blocks
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter(({ block }) => isMovableBlock(block))
    .filter(({ block }) => pointInRotatedFrame(point, blockFrame(block), blockRotation(block.props)))
    .map(({ blockIndex }) => blockIndex)
    .reverse();
}

export function nextStackedBlockIndex(indices: readonly number[], current: number | null) {
  if (indices.length === 0) return null;
  const currentPosition = current === null ? -1 : indices.indexOf(current);
  return indices[(currentPosition + 1) % indices.length] ?? indices[0] ?? null;
}

export function marqueeRect(selection: MarqueeSelection): MotionDocFrame {
  const x = Math.min(selection.start.x, selection.current.x);
  const y = Math.min(selection.start.y, selection.current.y);
  const right = Math.max(selection.start.x, selection.current.x);
  const bottom = Math.max(selection.start.y, selection.current.y);

  return {
    h: clampPercent(bottom - y),
    w: clampPercent(right - x),
    x: clampPercent(x),
    y: clampPercent(y)
  };
}

export function selectedMovableBlockIndices(blocks: MotionDocScene["blocks"], rect: MotionDocFrame) {
  return blocks
    .map((block, blockIndex) => ({ block, blockIndex }))
    .filter(({ block }) => isMovableBlock(block))
    .filter(({ block }) => intersectsRect(blockFrame(block), rect))
    .map(({ blockIndex }) => blockIndex);
}

export function selectionSpacingGuides(frames: readonly MotionDocFrame[]): SelectionSpacingGuide[] {
  if (frames.length < 2) return [];

  const xCenters = frames.map((frame) => frame.x + frame.w / 2);
  const yCenters = frames.map((frame) => frame.y + frame.h / 2);
  const xSpread = Math.max(...xCenters) - Math.min(...xCenters);
  const ySpread = Math.max(...yCenters) - Math.min(...yCenters);
  const axis: SelectionSpacingGuide["axis"] = xSpread >= ySpread ? "horizontal" : "vertical";
  const sortedFrames = [...frames].sort((a, b) => axis === "horizontal" ? a.x - b.x : a.y - b.y);
  const rawGuides = sortedFrames.slice(0, -1).map((frame, index) => {
    const nextFrame = sortedFrames[index + 1];
    const start = axis === "horizontal" ? frame.x + frame.w : frame.y + frame.h;
    const end = axis === "horizontal" ? nextFrame.x : nextFrame.y;
    const gapPercent = end - start;
    const crossStart = axis === "horizontal" ? Math.max(frame.y, nextFrame.y) : Math.max(frame.x, nextFrame.x);
    const crossEnd = axis === "horizontal"
      ? Math.min(frame.y + frame.h, nextFrame.y + nextFrame.h)
      : Math.min(frame.x + frame.w, nextFrame.x + nextFrame.w);
    const fallbackCross = axis === "horizontal"
      ? (frame.y + frame.h / 2 + nextFrame.y + nextFrame.h / 2) / 2
      : (frame.x + frame.w / 2 + nextFrame.x + nextFrame.w / 2) / 2;

    return {
      axis,
      crossPosition: crossEnd >= crossStart ? (crossStart + crossEnd) / 2 : fallbackCross,
      end,
      gapPercent,
      gapPx: Math.round(gapPercent / 100 * (axis === "horizontal" ? CANVAS_WIDTH : CANVAS_HEIGHT)),
      start
    };
  });
  const positiveGaps = rawGuides.map((guide) => guide.gapPercent).filter((gap) => gap >= 0);
  const isEven = positiveGaps.length > 1 && Math.max(...positiveGaps) - Math.min(...positiveGaps) <= 0.7;
  const isUneven = positiveGaps.length > 1 && !isEven;

  return rawGuides.map((guide) => ({
    ...guide,
    status: guide.gapPercent < -0.1
      ? "overlap"
      : isUneven
        ? "uneven"
        : guide.gapPercent < 1.5
          ? "tight"
          : "even"
  }));
}

export function findAlignmentGuides(blocks: MotionDocScene["blocks"], updates: readonly ResolvedBlockFrameUpdate[]) {
  const targets = getAlignmentTargets(blocks, updates);
  const guides: AlignmentGuide[] = [];

  updates.forEach(({ frame }) => {
    const verticalGuide = nearestGuide([frame.x, frame.x + frame.w / 2, frame.x + frame.w], targets.vertical);
    const horizontalGuide = nearestGuide([frame.y, frame.y + frame.h / 2, frame.y + frame.h], targets.horizontal);

    if (verticalGuide !== null) {
      guides.push({ orientation: "vertical", position: verticalGuide });
    }

    if (horizontalGuide !== null) {
      guides.push({ orientation: "horizontal", position: horizontalGuide });
    }
  });

  return uniqueGuides(guides);
}

export function resolveSnapFrameUpdates(
  blocks: MotionDocScene["blocks"],
  updates: readonly ResolvedBlockFrameUpdate[],
  interaction: FrameSnapInteraction
): ResolvedBlockFrameUpdate[] {
  if (updates.length === 0) return [];

  const targets = getAlignmentTargets(blocks, updates);
  const selectionFrame = combinedFrame(updates.map(({ frame }) => frame));

  if (interaction.mode === "move") {
    const xMatch = nearestGuideMatch(
      [selectionFrame.x, selectionFrame.x + selectionFrame.w / 2, selectionFrame.x + selectionFrame.w],
      targets.vertical
    );
    const yMatch = nearestGuideMatch(
      [selectionFrame.y, selectionFrame.y + selectionFrame.h / 2, selectionFrame.y + selectionFrame.h],
      targets.horizontal
    );
    const dx = xMatch?.delta ?? 0;
    const dy = yMatch?.delta ?? 0;

    return updates.map((update) => ({
      ...update,
      frame: {
        ...update.frame,
        x: clampFramePosition(update.frame.x + dx, update.frame.w),
        y: clampFramePosition(update.frame.y + dy, update.frame.h)
      }
    }));
  }

  const handle = interaction.handle;
  if (!handle) return [...updates];

  const snappedSelectionFrame = { ...selectionFrame };

  if (handle.includes("e")) {
    const match = nearestGuideMatch([selectionFrame.x + selectionFrame.w], targets.vertical);
    if (match) snappedSelectionFrame.w = Math.max(MIN_FRAME_WIDTH, selectionFrame.w + match.delta);
  } else if (handle.includes("w")) {
    const match = nearestGuideMatch([selectionFrame.x], targets.vertical);
    if (match) {
      snappedSelectionFrame.x = selectionFrame.x + match.delta;
      snappedSelectionFrame.w = Math.max(MIN_FRAME_WIDTH, selectionFrame.w - match.delta);
    }
  }

  if (handle.includes("s")) {
    const match = nearestGuideMatch([selectionFrame.y + selectionFrame.h], targets.horizontal);
    if (match) snappedSelectionFrame.h = Math.max(MIN_FRAME_HEIGHT, selectionFrame.h + match.delta);
  } else if (handle.includes("n")) {
    const match = nearestGuideMatch([selectionFrame.y], targets.horizontal);
    if (match) {
      snappedSelectionFrame.y = selectionFrame.y + match.delta;
      snappedSelectionFrame.h = Math.max(MIN_FRAME_HEIGHT, selectionFrame.h - match.delta);
    }
  }

  return resizeSelectionFrames(selectionFrame, snappedSelectionFrame, updates);
}

export function gridLineColor(slide: MotionDocScene | undefined) {
  const background = typeof slide?.props.background === "string" ? slide.props.background : "";
  const theme = typeof slide?.props.theme === "string" ? slide.props.theme : "dark";
  const isLight = isLightBackground(background) ?? (theme === "light" || theme === "paper");

  return isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.1)";
}

export function stringValue(value: string | number | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function intersectsRect(frame: MotionDocFrame, rect: MotionDocFrame) {
  const frameRight = frame.x + frame.w;
  const frameBottom = frame.y + frame.h;
  const rectRight = rect.x + rect.w;
  const rectBottom = rect.y + rect.h;

  return frame.x < rectRight && frameRight > rect.x && frame.y < rectBottom && frameBottom > rect.y;
}

function constrainFrameAspectRatio(frame: MotionDocFrame, resized: MotionDocFrame, handle: ResizeHandle) {
  const widthPx = frame.w / 100 * CANVAS_WIDTH;
  const heightPx = frame.h / 100 * CANVAS_HEIGHT;
  const ratio = heightPx > 0 ? widthPx / heightPx : 1;
  const widthDeltaPx = Math.abs((resized.w - frame.w) / 100 * CANVAS_WIDTH);
  const heightDeltaPx = Math.abs((resized.h - frame.h) / 100 * CANVAS_HEIGHT);
  const widthDriven = handle === "e" || handle === "w" || (handle.length === 2 && widthDeltaPx >= heightDeltaPx);
  const nextWidthPx = resized.w / 100 * CANVAS_WIDTH;
  const nextHeightPx = resized.h / 100 * CANVAS_HEIGHT;
  const constrainedW = widthDriven ? resized.w : nextHeightPx * ratio / CANVAS_WIDTH * 100;
  const constrainedH = widthDriven ? nextWidthPx / ratio / CANVAS_HEIGHT * 100 : resized.h;
  const centerX = frame.x + frame.w / 2;
  const centerY = frame.y + frame.h / 2;
  let x = handle.includes("w") ? frame.x + frame.w - constrainedW : resized.x;
  let y = handle.includes("n") ? frame.y + frame.h - constrainedH : resized.y;

  if (handle === "e" || handle === "w") y = centerY - constrainedH / 2;
  if (handle === "n" || handle === "s") x = centerX - constrainedW / 2;

  const w = Math.min(Math.max(constrainedW, MIN_FRAME_WIDTH), 200);
  const h = Math.min(Math.max(constrainedH, MIN_FRAME_HEIGHT), 200);
  return {
    h: roundFrameDimension(h),
    w: roundFrameDimension(w),
    x: clampFramePosition(x, w),
    y: clampFramePosition(y, h)
  };
}

function rotateCanvasDelta(dx: number, dy: number, degrees: number): CanvasPoint {
  if (degrees === 0) return { x: dx, y: dy };
  const radians = degrees * Math.PI / 180;
  const xPx = dx / 100 * CANVAS_WIDTH;
  const yPx = dy / 100 * CANVAS_HEIGHT;
  return {
    x: (xPx * Math.cos(radians) - yPx * Math.sin(radians)) / CANVAS_WIDTH * 100,
    y: (xPx * Math.sin(radians) + yPx * Math.cos(radians)) / CANVAS_HEIGHT * 100
  };
}

function canvasAngle(center: CanvasPoint, point: CanvasPoint) {
  const dx = (point.x - center.x) / 100 * CANVAS_WIDTH;
  const dy = (point.y - center.y) / 100 * CANVAS_HEIGHT;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function pointInRotatedFrame(point: CanvasPoint, frame: MotionDocFrame, rotation: number) {
  const center = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
  const local = rotateCanvasDelta(point.x - center.x, point.y - center.y, -rotation);
  return Math.abs(local.x) <= frame.w / 2 && Math.abs(local.y) <= frame.h / 2;
}

function getAlignmentTargets(blocks: MotionDocScene["blocks"], movingFrames: readonly ResolvedBlockFrameUpdate[]) {
  const movingBlockIds = new Set(movingFrames.map(({ blockId }) => blockId));
  const verticalTargets = [0, 50, 100];
  const horizontalTargets = [0, 50, 100];

  blocks.forEach((block, index) => {
    if (movingBlockIds.has(motionDocBlockKey(block, index)) || !isMovableBlock(block)) {
      return;
    }

    const frame = blockFrame(block);
    verticalTargets.push(frame.x, frame.x + frame.w / 2, frame.x + frame.w);
    horizontalTargets.push(frame.y, frame.y + frame.h / 2, frame.y + frame.h);
  });

  return {
    horizontal: horizontalTargets,
    vertical: verticalTargets
  };
}

function nearestGuide(points: readonly number[], targets: readonly number[]) {
  return nearestGuideMatch(points, targets)?.target ?? null;
}

function nearestGuideMatch(points: readonly number[], targets: readonly number[]) {
  let nearest: { delta: number; target: number } | null = null;
  let nearestDistance = GUIDE_THRESHOLD;

  for (const point of points) {
    for (const target of targets) {
      const distance = Math.abs(point - target);

      if (distance <= nearestDistance) {
        nearest = {
          delta: target - point,
          target: clampPercent(target)
        };
        nearestDistance = distance;
      }
    }
  }

  return nearest;
}

function combinedFrame(frames: readonly MotionDocFrame[]): MotionDocFrame {
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.w));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.h));

  return {
    h: bottom - top,
    w: right - left,
    x: left,
    y: top
  };
}

function uniqueGuides(guides: readonly AlignmentGuide[]) {
  const seen = new Set<string>();

  return guides.filter((guide) => {
    const key = `${guide.orientation}-${guide.position}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isLightBackground(background: string) {
  const hex = background.trim().replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.62;
}
