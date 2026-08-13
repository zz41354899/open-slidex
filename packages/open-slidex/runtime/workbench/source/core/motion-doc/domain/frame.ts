import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";

export type MotionDocFrame = {
  h: number;
  w: number;
  x: number;
  y: number;
};

export type MotionDocFramePatch = Partial<MotionDocFrame>;

export function motionDocBlockFrame(block: MotionDocBlock | undefined): MotionDocFrame {
  if (!block || !("props" in block)) {
    return { h: 18, w: 42, x: 8, y: 12 };
  }

  return {
    h: percentFrameValue(block.props.h, defaultBlockHeight(block.type)),
    w: percentFrameValue(block.props.w, defaultBlockWidth(block.type)),
    x: framePositionValue(block.props.x, 9),
    y: framePositionValue(block.props.y, defaultBlockY(block.type))
  };
}

export function defaultBlockWidth(type: MotionDocBlock["type"]) {
  if (type === "Title") return 52;
  if (type === "Text") return 42;
  if (type === "Icon") return 16;
  if (type === "Metric") return 32;
  if (type === "Shape") return widthPercentForPhysicalAspectRatio(28);
  if (type === "Stack") return 80;
  if (type === "Table") return 56;
  if (type === "Chart") return 78;
  if (type === "ImageBlock" || type === "VideoBlock") return 80;

  return 40;
}

export function widthPercentForPhysicalAspectRatio(heightPercent: number, aspectRatio = 1) {
  return heightPercent * MOTION_DOC_CANVAS_HEIGHT / MOTION_DOC_CANVAS_WIDTH * aspectRatio;
}

export function defaultBlockHeight(type: MotionDocBlock["type"]) {
  if (type === "Title") return 18;
  if (type === "Text") return 9;
  if (type === "Icon") return 28;
  if (type === "Metric") return 36;
  if (type === "Shape") return 28;
  if (type === "Stack") return 20;
  if (type === "Table") return 30;
  if (type === "Chart") return 52;
  if (type === "ImageBlock" || type === "VideoBlock") return 54;

  return 32;
}

export function defaultBlockX(type: MotionDocBlock["type"]) {
  if (type === "Icon") return 42;
  if (type === "ImageBlock" || type === "VideoBlock" || type === "Stack") return 10;
  if (type === "Table") return 22;
  if (type === "Chart") return 11;
  if (type === "Shape") return 34;

  return 8;
}

export function defaultBlockY(type: MotionDocBlock["type"]) {
  if (type === "Title") return 18;
  if (type === "Icon" || type === "Shape") return 30;
  if (type === "Table") return 34;
  if (type === "Chart") return 25;
  if (type === "Stack") return 64;
  if (type === "ImageBlock" || type === "VideoBlock") return 20;

  return 38;
}

export function percentFrameValue(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 0), 200);
}

export function framePositionValue(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, -100), 100);
}

export function numberValue(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function clampFramePosition(value: number, size: number) {
  const safeSize = Math.max(Number.isFinite(size) ? size : 0, 0);
  return Math.round(Math.min(Math.max(value, -safeSize), 100) * 10) / 10;
}

export function roundFrameValue(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 100) * 10) / 10;
}

export function clampPercent(value: number) {
  return roundFrameValue(value);
}

export function roundFrameDimension(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 200) * 10) / 10;
}

export function roundFramePosition(value: number) {
  return Math.round(Math.min(Math.max(value, -100), 100) * 10) / 10;
}
