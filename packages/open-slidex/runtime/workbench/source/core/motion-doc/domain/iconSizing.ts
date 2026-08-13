import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const canvasWidth = 1920;
const canvasHeight = 1080;

export function iconFrameForSize(props: MotionDocProps, value: number) {
  const size = Math.min(Math.max(Number.isFinite(value) ? value : 112, 40), 640);
  const w = size / canvasWidth * 100;
  const h = size / canvasHeight * 100;
  const currentW = numericProp(props.w, w);
  const currentH = numericProp(props.h, h);
  const centerX = numericProp(props.x, 50 - currentW / 2) + currentW / 2;
  const centerY = numericProp(props.y, 50 - currentH / 2) + currentH / 2;

  return {
    ...props,
    h,
    size,
    w,
    x: Math.min(Math.max(centerX - w / 2, 0), 100 - w),
    y: Math.min(Math.max(centerY - h / 2, 0), 100 - h)
  };
}

export function iconSizeForFrame(w: number, h: number) {
  return Math.round(Math.min(w / 100 * canvasWidth, h / 100 * canvasHeight));
}

function numericProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
