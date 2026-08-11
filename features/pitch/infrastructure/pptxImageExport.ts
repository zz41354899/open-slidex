import type { PptxSize } from "@/features/pitch/infrastructure/pptxTypes";

const PPTX_IMAGE_JPEG_QUALITY = 0.94;
const PPTX_PASSTHROUGH_MAX_BYTES = 384 * 1024;
const PPTX_PNG_REPLACEMENT_RATIO = 0.9;
const PPTX_RASTER_PIXELS_PER_INCH = 144;
const PPTX_RASTER_MAX_DIMENSION = 4096;

export type PptxImageFit = "contain" | "cover" | "fill";

/**
 * Google Slides does not reliably import WebP, AVIF, GIF, or SVG images stored
 * inside a PPTX. Convert those formats and oversized PNGs at the actual display
 * size, preserving transparent PNGs and using JPEG for opaque raster content.
 * The fit is baked into a frame-sized bitmap because passing only frame
 * dimensions to PptxGenJS sizing loses the source aspect ratio and stretches it.
 */
export async function portablePptxImageData(
  source: string,
  frame: PptxSize,
  fit: PptxImageFit = "fill"
) {
  const currentPageLocation = getCurrentPageLocation();
  if (currentPageLocation && isPptxPageLocation(source, currentPageLocation)) {
    throw new Error("PowerPoint image source is invalid");
  }

  const mimeType = dataImageMimeType(source);
  if (!mimeType) return source;

  const image = await loadImage(source);
  const targetWidth = rasterDimension(frame.w);
  const targetHeight = rasterDimension(frame.h);
  const placement = fittedRasterPlacement(
    image.naturalWidth,
    image.naturalHeight,
    targetWidth,
    targetHeight,
    fit
  );
  const sourceByteSize = dataUrlByteSize(source);
  const sourceCanUseFrame = fit === "fill" || approximatelySameAspectRatio(
    image.naturalWidth,
    image.naturalHeight,
    targetWidth,
    targetHeight
  );

  if (
    (mimeType === "image/jpeg" || mimeType === "image/png") &&
    sourceCanUseFrame &&
    sourceByteSize <= PPTX_PASSTHROUGH_MAX_BYTES &&
    image.naturalWidth <= targetWidth * 1.25 &&
    image.naturalHeight <= targetHeight * 1.25
  ) {
    image.src = "";
    return source;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("PowerPoint image conversion is unavailable in this browser");

  context.drawImage(
    image,
    placement.x,
    placement.y,
    placement.width,
    placement.height
  );
  image.src = "";

  try {
    const hasTransparency = canvasHasTransparency(context, targetWidth, targetHeight);
    const optimizedBlob = await canvasToBlob(
      canvas,
      hasTransparency ? "image/png" : "image/jpeg",
      hasTransparency ? undefined : PPTX_IMAGE_JPEG_QUALITY
    );

    if (
      mimeType === "image/png" &&
      sourceCanUseFrame &&
      optimizedBlob.size >= sourceByteSize * PPTX_PNG_REPLACEMENT_RATIO
    ) {
      return source;
    }

    return blobToDataUrl(optimizedBlob);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function fittedRasterPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: PptxImageFit
) {
  const { height, width } = fittedRasterSize(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    fit
  );

  return {
    height,
    width,
    x: Math.round((targetWidth - width) / 2),
    y: Math.round((targetHeight - height) / 2)
  };
}

export function fittedRasterSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: PptxImageFit
) {
  if (fit === "fill" || sourceWidth <= 0 || sourceHeight <= 0) {
    return { height: targetHeight, width: targetWidth };
  }

  const scale = fit === "cover"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);

  return {
    height: Math.max(1, Math.round(sourceHeight * scale)),
    width: Math.max(1, Math.round(sourceWidth * scale))
  };
}

type PptxPageLocation = {
  origin: string;
  pathname: string;
};

export function isPptxPageLocation(source: string, pageLocation: PptxPageLocation) {
  try {
    const candidate = new URL(source, pageLocation.origin);
    return candidate.origin === pageLocation.origin && candidate.pathname === pageLocation.pathname;
  } catch {
    return false;
  }
}

function dataImageMimeType(source: string) {
  const match = source.match(/^data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?,/i);
  return match?.[1]?.toLowerCase();
}

function getCurrentPageLocation(): PptxPageLocation | null {
  if (typeof window === "undefined") return null;
  return {
    origin: window.location.origin,
    pathname: window.location.pathname
  };
}

function rasterDimension(inches: number) {
  return Math.max(1, Math.min(Math.round(inches * PPTX_RASTER_PIXELS_PER_INCH), PPTX_RASTER_MAX_DIMENSION));
}

function approximatelySameAspectRatio(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) return false;
  return Math.abs(sourceWidth / sourceHeight - targetWidth / targetHeight) < 0.001;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PowerPoint image compression failed"));
    }, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function canvasHasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let alphaIndex = 3; alphaIndex < pixels.length; alphaIndex += 4) {
      if (pixels[alphaIndex] !== 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function dataUrlByteSize(source: string) {
  const commaIndex = source.indexOf(",");
  if (commaIndex < 0) return source.length;
  const metadata = source.slice(0, commaIndex);
  const payload = source.slice(commaIndex + 1);

  if (metadata.includes(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor(payload.length * 3 / 4) - padding);
  }

  try {
    return new Blob([decodeURIComponent(payload)]).size;
  } catch {
    return new Blob([payload]).size;
  }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image could not be converted for Google Slides compatibility"));
    image.src = source;
  });
}
