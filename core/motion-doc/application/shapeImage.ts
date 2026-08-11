import { applyImageCropRect, type ImageCropRect } from "@/core/motion-doc/application/imageCrop";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const shapeImageKeys = ["src", "alt", "fit", "cropX", "cropY", "scaleX", "scaleY"] as const;

export function shapeImageAsImageProps(props: MotionDocProps): MotionDocProps {
  return {
    ...props,
    alt: props.shapeImageAlt ?? "",
    cropX: props.shapeImageCropX ?? 0,
    cropY: props.shapeImageCropY ?? 0,
    fit: props.shapeImageFit ?? "cover",
    scaleX: props.shapeImageScaleX ?? 1,
    scaleY: props.shapeImageScaleY ?? 1,
    src: props.shapeImageSrc ?? ""
  };
}

export function imagePropsAsShapeImageProps(shapeProps: MotionDocProps, imageProps: MotionDocProps): MotionDocProps {
  const next = { ...shapeProps };
  next.shapeImageSrc = imageProps.src ?? "";
  next.shapeImageAlt = imageProps.alt ?? "";
  next.shapeImageFit = imageProps.fit ?? "cover";
  next.shapeImageCropX = imageProps.cropX ?? 0;
  next.shapeImageCropY = imageProps.cropY ?? 0;
  next.shapeImageScaleX = imageProps.scaleX ?? 1;
  next.shapeImageScaleY = imageProps.scaleY ?? 1;
  for (const key of ["x", "y", "w", "h"] as const) {
    if (imageProps[key] !== undefined) next[key] = imageProps[key];
  }
  shapeImageKeys.forEach((key) => delete next[key]);
  return next;
}

export function applyShapeImageCropRect(props: MotionDocProps, cropRect: ImageCropRect) {
  return imagePropsAsShapeImageProps(props, applyImageCropRect(shapeImageAsImageProps(props), cropRect));
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
