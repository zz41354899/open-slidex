import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import { MOTION_DOC_CANVAS_HEIGHT } from "@/core/motion-doc/domain/viewport";

export type VisualFrameToolbarPlacement = "above" | "below" | "inside-top";

const toolbarClearancePx = 48;

export function visualFrameToolbarPlacement(
  frame: MotionDocFrame,
  canvasScale: number
): VisualFrameToolbarPlacement {
  const safeScale = Number.isFinite(canvasScale) && canvasScale > 0 ? canvasScale : 1;
  const scaledCanvasHeight = MOTION_DOC_CANVAS_HEIGHT * safeScale;
  const spaceAbovePx = frame.y / 100 * scaledCanvasHeight;
  const spaceBelowPx = (100 - frame.y - frame.h) / 100 * scaledCanvasHeight;

  if (spaceAbovePx >= toolbarClearancePx) return "above";
  if (spaceBelowPx >= toolbarClearancePx) return "below";
  return "inside-top";
}
