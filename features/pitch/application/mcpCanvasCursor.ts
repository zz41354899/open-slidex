import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

export type McpCanvasCursorPosition = {
  source: "dom" | "motion-doc" | "slide-center";
  xPercent: number;
  yPercent: number;
};

type RectLike = Pick<DOMRect, "height" | "left" | "top" | "width">;

export function mcpCanvasCursorPositionFromRects(
  targetRect: RectLike,
  cursorLayerRect: RectLike
): McpCanvasCursorPosition {
  const width = Math.max(cursorLayerRect.width, 1);
  const height = Math.max(cursorLayerRect.height, 1);
  const x = targetRect.left - cursorLayerRect.left + targetRect.width / 2;
  const y = targetRect.top - cursorLayerRect.top + targetRect.height / 2;

  return {
    source: "dom",
    xPercent: clampPercent((x / width) * 100),
    yPercent: clampPercent((y / height) * 100)
  };
}

export function mcpCanvasCursorFallbackPosition(
  activity: RemoteMcpOperation,
  scene: MotionDocScene | undefined,
  activeSlideIndex: number
): McpCanvasCursorPosition {
  if (activity.target.kind !== "block" || activity.target.slideIndex !== activeSlideIndex) {
    return slideCenterPosition;
  }
  const blockTarget = activity.target;

  const blockIndex = scene?.blocks.findIndex((block, index) => (
    motionDocBlockKey(block, index) === blockTarget.nodeId ||
    `${block.type}-legacy-${index}` === blockTarget.nodeId
  )) ?? -1;
  const block = blockIndex >= 0 ? scene?.blocks[blockIndex] : undefined;
  if (!block) return slideCenterPosition;

  const frame = blockFrame(block);
  return {
    source: "motion-doc",
    xPercent: clampPercent(frame.x + frame.w / 2),
    yPercent: clampPercent(frame.y + frame.h / 2)
  };
}

export function latestRemoteMcpCanvasOperation(
  activities: readonly RemoteMcpOperation[],
  activeSlideIndex: number
) {
  const latest = activities.reduce<RemoteMcpOperation | undefined>((current, activity) => {
    if (!current) return activity;
    const currentTimestamp = Date.parse(current.updatedAt);
    const activityTimestamp = Date.parse(activity.updatedAt);
    if (activityTimestamp !== currentTimestamp) {
      return activityTimestamp > currentTimestamp ? activity : current;
    }
    return activity.id > current.id ? activity : current;
  }, undefined);

  if (!latest) return undefined;
  if (latest.target.kind === "presentation") return latest;
  return latest.target.slideIndex === activeSlideIndex ? latest : undefined;
}

export function mcpCanvasCursorGeneration(activity: RemoteMcpOperation) {
  return `${activity.id}:${activity.updatedAt}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

const slideCenterPosition: McpCanvasCursorPosition = {
  source: "slide-center",
  xPercent: 50,
  yPercent: 50
};
