import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import type { CanvasPoint } from "@/features/pitch/application/previewCanvas";

export type CanvasShapeTool = {
  props: MotionDocProps;
  type: "ShapeRectangle";
};

export type ShapeDrawResult = {
  frame: MotionDocFrame;
  rotation?: number;
};

export function shapeDrawResult(
  start: CanvasPoint,
  pointer: CanvasPoint,
  options: { fromCenter: boolean; preserveAspectRatio: boolean; shape: string }
): ShapeDrawResult {
  if (options.shape === "line") {
    return lineDrawResult(start, pointer, options.preserveAspectRatio);
  }

  let deltaX = pointer.x - start.x;
  let deltaY = pointer.y - start.y;

  if (options.preserveAspectRatio) {
    const widthPx = Math.abs(deltaX) / 100 * MOTION_DOC_CANVAS_WIDTH;
    const heightPx = Math.abs(deltaY) / 100 * MOTION_DOC_CANVAS_HEIGHT;
    const sizePx = Math.max(widthPx, heightPx);
    deltaX = Math.sign(deltaX || 1) * sizePx / MOTION_DOC_CANVAS_WIDTH * 100;
    deltaY = Math.sign(deltaY || 1) * sizePx / MOTION_DOC_CANVAS_HEIGHT * 100;
  }

  const opposite = options.fromCenter
    ? { x: start.x - deltaX, y: start.y - deltaY }
    : start;
  const end = options.fromCenter
    ? { x: start.x + deltaX, y: start.y + deltaY }
    : { x: start.x + deltaX, y: start.y + deltaY };

  return {
    frame: boundedFrame(opposite, end)
  };
}

export function shapeDrawIsVisible(result: ShapeDrawResult) {
  const widthPx = result.frame.w / 100 * MOTION_DOC_CANVAS_WIDTH;
  const heightPx = result.frame.h / 100 * MOTION_DOC_CANVAS_HEIGHT;
  return result.rotation === undefined
    ? widthPx >= 2 && heightPx >= 2
    : widthPx >= 6;
}

function lineDrawResult(start: CanvasPoint, pointer: CanvasPoint, snapAngle: boolean): ShapeDrawResult {
  const startPx = pointToPixels(start);
  const pointerPx = pointToPixels(pointer);
  const rawAngle = Math.atan2(pointerPx.y - startPx.y, pointerPx.x - startPx.x);
  const angle = snapAngle ? Math.round(rawAngle / (Math.PI / 4)) * Math.PI / 4 : rawAngle;
  const length = Math.hypot(pointerPx.x - startPx.x, pointerPx.y - startPx.y);
  const endPx = {
    x: startPx.x + Math.cos(angle) * length,
    y: startPx.y + Math.sin(angle) * length
  };
  const centerPx = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };
  const h = 2.5;
  const w = Math.min(length / MOTION_DOC_CANVAS_WIDTH * 100, 100);

  return {
    frame: {
      h,
      w: round(w),
      x: round(Math.min(Math.max(centerPx.x / MOTION_DOC_CANVAS_WIDTH * 100 - w / 2, 0), 100 - w)),
      y: round(Math.min(Math.max(centerPx.y / MOTION_DOC_CANVAS_HEIGHT * 100 - h / 2, 0), 100 - h))
    },
    rotation: normalizeAngle(angle * 180 / Math.PI)
  };
}

function boundedFrame(start: CanvasPoint, end: CanvasPoint): MotionDocFrame {
  const x = Math.max(0, Math.min(start.x, end.x));
  const y = Math.max(0, Math.min(start.y, end.y));
  const right = Math.min(100, Math.max(start.x, end.x));
  const bottom = Math.min(100, Math.max(start.y, end.y));
  return { h: round(bottom - y), w: round(right - x), x: round(x), y: round(y) };
}

function pointToPixels(point: CanvasPoint) {
  return {
    x: point.x / 100 * MOTION_DOC_CANVAS_WIDTH,
    y: point.y / 100 * MOTION_DOC_CANVAS_HEIGHT
  };
}

function normalizeAngle(degrees: number) {
  return Math.round(((degrees + 180) % 360 + 360) % 360 - 180);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
