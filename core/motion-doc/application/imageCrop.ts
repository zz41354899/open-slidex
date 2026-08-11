import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  clampFramePosition,
  percentFrameValue,
  roundFrameValue
} from "@/core/motion-doc/domain/frame";

export type ImageCropRect = { x: number; y: number; w: number; h: number };

export const fullImageCropRect: ImageCropRect = { x: 0, y: 0, w: 100, h: 100 };

export function imageMediaDimensions(
  fit: string,
  frameAspectRatio: number,
  imageAspectRatio: number | null
) {
  if (!imageAspectRatio || fit === "fill") return { height: 100, width: 100 };
  const useContain = fit === "contain" || fit === "scale-down";
  const imageIsWider = imageAspectRatio > frameAspectRatio;
  const widthFromFullHeight = imageAspectRatio / frameAspectRatio * 100;
  const heightFromFullWidth = frameAspectRatio / imageAspectRatio * 100;

  if (useContain) {
    return imageIsWider
      ? { height: heightFromFullWidth, width: 100 }
      : { height: 100, width: widthFromFullHeight };
  }

  return imageIsWider
    ? { height: 100, width: widthFromFullHeight }
    : { height: heightFromFullWidth, width: 100 };
}

export function imageMediaPositionBounds(
  cropStart: number,
  cropSize: number,
  scaledImageSize: number
) {
  const minimum = cropStart + cropSize - 50 - scaledImageSize / 2;
  const maximum = cropStart - 50 + scaledImageSize / 2;
  if (minimum <= maximum) return { maximum, minimum };
  const centered = (minimum + maximum) / 2;
  return { maximum: centered, minimum: centered };
}

export function clampImageMediaPosition(
  value: number,
  cropStart: number,
  cropSize: number,
  scaledImageSize: number
) {
  const bounds = imageMediaPositionBounds(cropStart, cropSize, scaledImageSize);
  return Math.round(Math.min(Math.max(value, bounds.minimum), bounds.maximum) * 100) / 100;
}

export function applyImageCropRect(props: MotionDocProps, cropRect: ImageCropRect): MotionDocProps {
  const frameX = percentFrameValue(props.x, 10);
  const frameY = percentFrameValue(props.y, 20);
  const frameWidth = Math.max(percentFrameValue(props.w, 80), 0.1);
  const frameHeight = Math.max(percentFrameValue(props.h, 54), 0.1);
  const rect = normalizeImageCropRect(cropRect);
  const widthRatio = rect.w / 100;
  const heightRatio = rect.h / 100;
  const scaleX = clampImageCropScale(numberProp(props.scaleX, 1));
  const scaleY = clampImageCropScale(numberProp(props.scaleY, 1));
  const cropX = numberProp(props.cropX, 0);
  const cropY = numberProp(props.cropY, 0);
  const nextScaleX = clampImageCropScale(scaleX / widthRatio);
  const nextScaleY = clampImageCropScale(scaleY / heightRatio);
  const oldImageLeft = cropX - (scaleX - 1) * 50;
  const oldImageTop = cropY - (scaleY - 1) * 50;
  const nextImageLeft = (oldImageLeft - rect.x) / widthRatio;
  const nextImageTop = (oldImageTop - rect.y) / heightRatio;
  const nextCropX = clampImageCropOffset(nextImageLeft + (nextScaleX - 1) * 50);
  const nextCropY = clampImageCropOffset(nextImageTop + (nextScaleY - 1) * 50);
  const nextWidth = Math.max(roundFrameValue(frameWidth * widthRatio), 0.1);
  const nextHeight = Math.max(roundFrameValue(frameHeight * heightRatio), 0.1);

  return {
    ...props,
    cropX: nextCropX,
    cropY: nextCropY,
    fit: "cover",
    h: nextHeight,
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    w: nextWidth,
    x: clampFramePosition(frameX + frameWidth * rect.x / 100, nextWidth),
    y: clampFramePosition(frameY + frameHeight * rect.y / 100, nextHeight)
  };
}

function normalizeImageCropRect(rect: ImageCropRect): ImageCropRect {
  const x = Math.min(Math.max(rect.x, 0), 90);
  const y = Math.min(Math.max(rect.y, 0), 90);
  const w = Math.min(Math.max(rect.w, 10), 100 - x);
  const h = Math.min(Math.max(rect.h, 10), 100 - y);
  return { x, y, w, h };
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampImageCropScale(value: number) {
  return Math.round(Math.min(Math.max(value, 0.1), 8) * 1000) / 1000;
}

function clampImageCropOffset(value: number) {
  return Math.round(Math.min(Math.max(value, -350), 350) * 1000) / 1000;
}
