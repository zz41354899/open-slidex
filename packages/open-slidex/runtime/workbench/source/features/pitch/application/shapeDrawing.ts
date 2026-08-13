import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import type { CanvasPoint } from "@/features/pitch/application/previewCanvas";

/**
 * A draw-on-canvas insertion tool. Shapes and media deliberately share this
 * contract so their initial frame always comes from the same pixel gesture.
 */
export type CanvasShapeTool = {
  props: MotionDocProps;
  type: "Image" | "ShapeRectangle" | "Video";
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

/**
 * Media frames are measured in the physical 1920 × 1080 canvas first, then
 * converted to the serializable percentage frame used by MotionDoc.
 */
export function mediaDrawResult(
  start: CanvasPoint,
  pointer: CanvasPoint,
  options: { fromCenter?: boolean; preserveAspectRatio?: boolean } = {}
): ShapeDrawResult {
  const startPx = pointToPixels(start);
  const pointerPx = pointToPixels(pointer);
  let deltaX = pointerPx.x - startPx.x;
  let deltaY = pointerPx.y - startPx.y;

  if (options.preserveAspectRatio) {
    const ratio = Math.max(Math.abs(deltaX) / MOTION_DOC_CANVAS_WIDTH, Math.abs(deltaY) / MOTION_DOC_CANVAS_HEIGHT);
    deltaX = Math.sign(deltaX || 1) * ratio * MOTION_DOC_CANVAS_WIDTH;
    deltaY = Math.sign(deltaY || 1) * ratio * MOTION_DOC_CANVAS_HEIGHT;
  }

  const opposite = options.fromCenter
    ? { x: startPx.x - deltaX, y: startPx.y - deltaY }
    : startPx;
  const end = options.fromCenter
    ? { x: startPx.x + deltaX, y: startPx.y + deltaY }
    : { x: startPx.x + deltaX, y: startPx.y + deltaY };
  const left = Math.max(0, Math.min(opposite.x, end.x));
  const top = Math.max(0, Math.min(opposite.y, end.y));
  const right = Math.min(MOTION_DOC_CANVAS_WIDTH, Math.max(opposite.x, end.x));
  const bottom = Math.min(MOTION_DOC_CANVAS_HEIGHT, Math.max(opposite.y, end.y));

  return {
    frame: {
      h: round((bottom - top) / MOTION_DOC_CANVAS_HEIGHT * 100),
      w: round((right - left) / MOTION_DOC_CANVAS_WIDTH * 100),
      x: round(left / MOTION_DOC_CANVAS_WIDTH * 100),
      y: round(top / MOTION_DOC_CANVAS_HEIGHT * 100)
    }
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
