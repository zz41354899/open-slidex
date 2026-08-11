"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  clampImageMediaPosition,
  imageMediaDimensions,
  type ImageCropRect
} from "@/core/motion-doc/application/imageCrop";
import type { MotionDocBlockOf } from "@/core/motion-doc/domain/motionDocTypes";
import {
  imagePropsAsShapeImageProps,
  shapeImageAsImageProps
} from "@/core/motion-doc/application/shapeImage";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { blockFrame, type ResizeHandle } from "@/features/pitch/application/previewCanvas";
import {
  cachedImageAspectRatio,
  rememberImageAspectRatio
} from "@/features/pitch/ui/preview/imageAspectRatioCache";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { usePreviewMediaSource } from "@/features/pitch/ui/preview/PreviewMediaPolicy";

type CropPan = {
  cropRect: ImageCropRect;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCropX: number;
  startCropY: number;
  scaleX: number;
  scaleY: number;
  target: HTMLDivElement;
  width: number;
  height: number;
  imageHeight: number;
  imageWidth: number;
};

type CropResize = {
  handle: ResizeHandle;
  pointerId: number;
  rect: ImageCropRect;
  startClientX: number;
  startClientY: number;
  width: number;
  height: number;
};

type ImageCropEditorProps = {
  block: MotionDocBlockOf<"ImageBlock"> | MotionDocBlockOf<"Shape">;
  blockIndex: number;
  cropRect: ImageCropRect;
  onBeginBlockTransform: () => void;
  onCropRectChange: (rect: ImageCropRect) => void;
  onUpdateBlock: BlockUpdater;
};

const resizeHandles: readonly ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const minimumCropSize = 12;

export function ImageCropEditor({
  block,
  blockIndex,
  cropRect,
  onBeginBlockTransform,
  onCropRectChange,
  onUpdateBlock
}: ImageCropEditorProps) {
  const { tx } = usePitchI18n();
  const mediaProps = block.type === "Shape" ? shapeImageAsImageProps(block.props) : block.props;
  const imageSource = usePreviewMediaSource(String(mediaProps.src ?? ""));
  const panRef = useRef<CropPan | null>(null);
  const resizeRef = useRef<CropResize | null>(null);
  const [loadedImage, setLoadedImage] = useState<{ aspectRatio: number | null; src: string }>(() => ({
    aspectRatio: cachedImageAspectRatio(imageSource),
    src: imageSource
  }));
  const imageAspectRatio = loadedImage.src === imageSource
    ? loadedImage.aspectRatio
    : cachedImageAspectRatio(imageSource);

  if (!imageSource) return null;

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || resizeRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    const host = event.currentTarget.closest<HTMLElement>("[data-image-crop-editor]");
    const rect = host?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = numberProp(mediaProps.scaleX, 1);
    const scaleY = numberProp(mediaProps.scaleY, 1);
    const imageDimensions = imageMediaDimensions("cover", rect.width / rect.height, imageAspectRatio);

    panRef.current = {
      cropRect,
      height: Math.max(rect.height, 1),
      imageHeight: imageDimensions.height,
      imageWidth: imageDimensions.width,
      pointerId: event.pointerId,
      scaleX,
      scaleY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCropX: numberProp(mediaProps.cropX, 0),
      startCropY: numberProp(mediaProps.cropY, 0),
      target: event.currentTarget,
      width: Math.max(rect.width, 1)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onBeginBlockTransform();
  }

  function updatePanAt(pointerId: number, clientX: number, clientY: number) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== pointerId) return;

    const desiredCropX = pan.startCropX + (clientX - pan.startClientX) / pan.width * 100;
    const desiredCropY = pan.startCropY + (clientY - pan.startClientY) / pan.height * 100;
    const cropX = clampImageMediaPosition(
      desiredCropX,
      pan.cropRect.x,
      pan.cropRect.w,
      pan.imageWidth * pan.scaleX
    );
    const cropY = clampImageMediaPosition(
      desiredCropY,
      pan.cropRect.y,
      pan.cropRect.h,
      pan.imageHeight * pan.scaleY
    );

    const nextMediaProps = {
      ...mediaProps,
      cropX,
      cropY,
      scaleX: pan.scaleX,
      scaleY: pan.scaleY
    };
    onUpdateBlock(
      blockIndex,
      block.type === "Shape" ? imagePropsAsShapeImageProps(block.props, nextMediaProps) : nextMediaProps,
      undefined,
      { transient: true }
    );
  }

  function finishPan(pointerId: number, clientX: number, clientY: number) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== pointerId) return;
    updatePanAt(pointerId, clientX, clientY);
    if (pan.target.hasPointerCapture(pointerId)) pan.target.releasePointerCapture(pointerId);
    panRef.current = null;
  }

  function startCropResize(event: ReactPointerEvent<HTMLSpanElement>, handle: ResizeHandle) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const host = event.currentTarget.closest<HTMLElement>("[data-image-crop-editor]");
    const rect = host?.getBoundingClientRect();
    if (!rect) return;

    resizeRef.current = {
      handle,
      height: Math.max(rect.height, 1),
      pointerId: event.pointerId,
      rect: cropRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
      width: Math.max(rect.width, 1)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateCropResize(event: ReactPointerEvent<HTMLSpanElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const dx = (event.clientX - resize.startClientX) / resize.width * 100;
    const dy = (event.clientY - resize.startClientY) / resize.height * 100;
    onCropRectChange(resizedCropRect(resize.rect, resize.handle, dx, dy));
  }

  function endCropResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    updateCropResize(event);
    event.currentTarget.releasePointerCapture(event.pointerId);
    resizeRef.current = null;
  }

  const cropStyle = {
    height: `${cropRect.h}%`,
    left: `${cropRect.x}%`,
    top: `${cropRect.y}%`,
    width: `${cropRect.w}%`
  };
  const frame = blockFrame(block);
  const imagePreviewStyles = cropPreviewStyles({
    cropX: numberProp(mediaProps.cropX, 0),
    cropY: numberProp(mediaProps.cropY, 0),
    fit: "cover",
    frameAspectRatio: frame.h > 0 ? frame.w / frame.h * (16 / 9) : 16 / 9,
    imageAspectRatio,
    scaleX: numberProp(mediaProps.scaleX, 1),
    scaleY: numberProp(mediaProps.scaleY, 1)
  });

  return (
    <div className="absolute inset-0 z-30 touch-none overflow-visible" data-image-crop-editor>
      <FullImageCropPreview
        alt={String(mediaProps.alt ?? "")}
        cropRect={cropRect}
        onImageLoad={(naturalWidth, naturalHeight) => {
          const aspectRatio = rememberImageAspectRatio(imageSource, naturalWidth, naturalHeight);
          if (aspectRatio !== null) {
            setLoadedImage({
              aspectRatio,
              src: imageSource
            });
          }
        }}
        src={imageSource}
        imageStyle={imagePreviewStyles.image}
        transformStyle={imagePreviewStyles.transform}
      />
      <CropMask rect={cropRect} />
      <div
        aria-label={tx("Crop image. Drag the image to reposition it and drag the crop handles to change the crop area.")}
        className="absolute cursor-grab border border-sky-400 shadow-[0_0_0_1px_rgba(2,132,199,0.34),0_0_20px_rgba(14,165,233,0.14)] active:cursor-grabbing"
        onPointerCancel={(event) => finishPan(event.pointerId, event.clientX, event.clientY)}
        onPointerDown={startPan}
        onPointerMove={(event) => updatePanAt(event.pointerId, event.clientX, event.clientY)}
        onPointerUp={(event) => finishPan(event.pointerId, event.clientX, event.clientY)}
        role="application"
        style={cropStyle}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.12)]" />
        {resizeHandles.map((handle) => (
          <span
            aria-label={`Adjust crop ${handle}`}
            className={`absolute z-40 flex items-center justify-center ${resizeHandleClass(handle)}`}
            data-crop-resize-handle={handle}
            key={handle}
            onPointerCancel={endCropResize}
            onPointerDown={(event) => startCropResize(event, handle)}
            onPointerMove={updateCropResize}
            onPointerUp={endCropResize}
            role="button"
          >
            <span className={`pointer-events-none border-2 border-sky-400 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${resizeHandleSurfaceClass(handle)}`} />
          </span>
        ))}
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[9px] font-medium text-white/80 shadow-lg backdrop-blur-md">
          {tx("Drag image · Adjust crop handles")}
        </span>
      </div>
    </div>
  );
}

function FullImageCropPreview({
  alt,
  cropRect,
  imageStyle,
  onImageLoad,
  src,
  transformStyle
}: {
  alt: string;
  cropRect: ImageCropRect;
  imageStyle: CSSProperties;
  onImageLoad: (naturalWidth: number, naturalHeight: number) => void;
  src: string;
  transformStyle: CSSProperties;
}) {
  const clipPath = `inset(${cropRect.y}% ${100 - cropRect.x - cropRect.w}% ${100 - cropRect.y - cropRect.h}% ${cropRect.x}%)`;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <div className="absolute inset-0 opacity-35 saturate-75" style={transformStyle}>
        <img
          alt=""
          className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
          decoding="async"
          draggable={false}
          onLoad={(event) => onImageLoad(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
          src={src}
          style={imageStyle}
        />
      </div>
      <div className="absolute inset-0" style={{ clipPath }}>
        <div className="absolute inset-0" style={transformStyle}>
          <img
            alt={alt}
            className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
            decoding="async"
            draggable={false}
            src={src}
            style={imageStyle}
          />
        </div>
      </div>
    </div>
  );
}

function CropMask({ rect }: { rect: ImageCropRect }) {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bg-black/55" style={{ height: `${rect.y}%` }} />
      <span aria-hidden="true" className="pointer-events-none absolute left-0 bg-black/55" style={{ height: `${rect.h}%`, top: `${rect.y}%`, width: `${rect.x}%` }} />
      <span aria-hidden="true" className="pointer-events-none absolute right-0 bg-black/55" style={{ height: `${rect.h}%`, top: `${rect.y}%`, width: `${100 - rect.x - rect.w}%` }} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55" style={{ height: `${100 - rect.y - rect.h}%` }} />
    </>
  );
}

function cropPreviewStyles({
  cropX,
  cropY,
  fit,
  frameAspectRatio,
  imageAspectRatio,
  scaleX,
  scaleY
}: {
  cropX: number;
  cropY: number;
  fit: string;
  frameAspectRatio: number;
  imageAspectRatio: number | null;
  scaleX: number;
  scaleY: number;
}): { image: CSSProperties; transform: CSSProperties } {
  const dimensions = imageMediaDimensions(fit, frameAspectRatio, imageAspectRatio);
  return {
    image: {
      height: `${dimensions.height}%`,
      width: `${dimensions.width}%`
    },
    transform: {
      transform: `translate(${cropX}%, ${cropY}%) scale(${scaleX}, ${scaleY})`,
      transformOrigin: "center"
    }
  };
}

function resizedCropRect(rect: ImageCropRect, handle: ResizeHandle, dx: number, dy: number): ImageCropRect {
  let left = rect.x;
  let right = rect.x + rect.w;
  let top = rect.y;
  let bottom = rect.y + rect.h;

  if (handle.includes("w")) left = clamp(left + dx, 0, right - minimumCropSize);
  if (handle.includes("e")) right = clamp(right + dx, left + minimumCropSize, 100);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - minimumCropSize);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + minimumCropSize, 100);

  return {
    h: roundCropValue(bottom - top),
    w: roundCropValue(right - left),
    x: roundCropValue(left),
    y: roundCropValue(top)
  };
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundCropValue(value: number) {
  return Math.round(value * 100) / 100;
}

function resizeHandleClass(handle: ResizeHandle) {
  if (handle === "n") return "-top-3 left-1/2 h-6 w-12 -translate-x-1/2 cursor-ns-resize";
  if (handle === "e") return "-right-3 top-1/2 h-12 w-6 -translate-y-1/2 cursor-ew-resize";
  if (handle === "s") return "-bottom-3 left-1/2 h-6 w-12 -translate-x-1/2 cursor-ns-resize";
  if (handle === "w") return "-left-3 top-1/2 h-12 w-6 -translate-y-1/2 cursor-ew-resize";
  if (handle === "nw") return "-left-3.5 -top-3.5 h-7 w-7 cursor-nwse-resize";
  if (handle === "ne") return "-right-3.5 -top-3.5 h-7 w-7 cursor-nesw-resize";
  if (handle === "sw") return "-bottom-3.5 -left-3.5 h-7 w-7 cursor-nesw-resize";
  return "-bottom-3.5 -right-3.5 h-7 w-7 cursor-nwse-resize";
}

function resizeHandleSurfaceClass(handle: ResizeHandle) {
  if (handle === "n" || handle === "s") return "h-2 w-6 rounded-full";
  if (handle === "e" || handle === "w") return "h-6 w-2 rounded-full";
  return "h-3.5 w-3.5 rounded-full";
}
