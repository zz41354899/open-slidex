import {
  applyImageCropRect,
  normalizedImageScales,
  type ImageCropRect
} from "@/core/motion-doc/application/imageCrop";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const shapeImageKeys = ["src", "alt", "fit", "cropX", "cropY", "scaleX", "scaleY"] as const;

export function shapeImageAsImageProps(props: MotionDocProps): MotionDocProps {
  const scales = normalizedImageScales("cover", props.shapeImageScaleX, props.shapeImageScaleY);
  return {
    ...props,
    alt: props.shapeImageAlt ?? "",
    cropX: props.shapeImageCropX ?? 0,
    cropY: props.shapeImageCropY ?? 0,
    fit: normalizeShapeImageFit(props.shapeImageFit),
    scaleX: scales.scaleX,
    scaleY: scales.scaleY,
    src: props.shapeImageSrc ?? ""
  };
}

export function imagePropsAsShapeImageProps(shapeProps: MotionDocProps, imageProps: MotionDocProps): MotionDocProps {
  const next = { ...shapeProps };
  const scales = normalizedImageScales("cover", imageProps.scaleX, imageProps.scaleY);
  next.shapeImageSrc = imageProps.src ?? "";
  next.shapeImageAlt = imageProps.alt ?? "";
  next.shapeImageFit = normalizeShapeImageFit(imageProps.fit);
  next.shapeImageCropX = imageProps.cropX ?? 0;
  next.shapeImageCropY = imageProps.cropY ?? 0;
  next.shapeImageScaleX = scales.scaleX;
  next.shapeImageScaleY = scales.scaleY;
  for (const key of ["x", "y", "w", "h"] as const) {
    if (imageProps[key] !== undefined) next[key] = imageProps[key];
  }
  shapeImageKeys.forEach((key) => delete next[key]);
  return next;
}

export function applyShapeImageCropRect(props: MotionDocProps, cropRect: ImageCropRect) {
  return imagePropsAsShapeImageProps(props, applyImageCropRect(shapeImageAsImageProps(props), cropRect));
}

export function normalizeShapeImageFit(value: MotionDocProps[string]) {
  return value === "contain" || value === "scale-down" ? value : "cover";
}

export function removeShapeImageProps(props: MotionDocProps): MotionDocProps {
  const next = { ...props };
  [
    "shapeImageSrc",
    "shapeImageAlt",
    "shapeImageFit",
    "shapeImageCropX",
    "shapeImageCropY",
    "shapeImageScaleX",
    "shapeImageScaleY"
  ].forEach((key) => delete next[key]);
  return next;
}
