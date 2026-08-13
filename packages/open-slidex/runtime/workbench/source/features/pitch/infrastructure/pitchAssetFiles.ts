import {
  validatePitchAssetSource,
  validatePreparedPitchAsset,
  type PitchAssetKind
} from "@/features/pitch/application/pitchAssetPolicy";

const imageOptimizationThresholdBytes = 512 * 1024;
const maximumImageDimension = 2304;
const webpQuality = 0.82;
const optimizableImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PreparedPitchAsset = {
  file: File;
  kind: PitchAssetKind;
  optimized: boolean;
  originalFile: File;
};

export class PitchAssetFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PitchAssetFileError";
  }
}

export async function preparePitchAssetFile(file: File): Promise<PreparedPitchAsset> {
  const sourceValidation = validatePitchAssetSource(file);
  if (!sourceValidation.ok) {
    throw new PitchAssetFileError(sourceValidation.message);
  }

  if (sourceValidation.kind === "image") {
    await assertPitchImageSignature(file);
  }

  const preparedFile = sourceValidation.kind === "image"
    ? await optimizePitchImageFile(file)
    : file;
  const preparedValidation = validatePreparedPitchAsset(preparedFile);

  if (!preparedValidation.ok) {
    throw new PitchAssetFileError(preparedValidation.message);
  }

  if (preparedValidation.kind === "image" && preparedFile !== file) {
    await assertPitchImageSignature(preparedFile);
  }

  return {
    file: preparedFile,
    kind: preparedValidation.kind,
    optimized: preparedFile !== file,
    originalFile: file
  };
}

export async function detectPitchImageMimeType(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, 128).arrayBuffer());

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  const header = ascii(bytes, 0, 12);
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 4, 8) === "ftyp" && hasAvifBrand(bytes)) {
    return "image/avif";
  }

  return null;
}

async function assertPitchImageSignature(file: File) {
  const detectedMimeType = await detectPitchImageMimeType(file);
  if (!detectedMimeType || detectedMimeType !== file.type.trim().toLowerCase()) {
    throw new PitchAssetFileError("The image contents do not match the selected file type");
  }
}

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function hasAvifBrand(bytes: Uint8Array) {
  const declaredBoxSize = bytes.length >= 4
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
    : 0;
  const boxEnd = Math.min(bytes.length, declaredBoxSize >= 16 ? declaredBoxSize : bytes.length);

  for (let index = 8; index + 4 <= boxEnd; index += 4) {
    const brand = ascii(bytes, index, index + 4);
    if (brand === "avif" || brand === "avis") return true;
  }

  return false;
}

async function optimizePitchImageFile(file: File) {
  if (!optimizableImageTypes.has(file.type) || file.size <= imageOptimizationThresholdBytes) {
    return file;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maximumImageDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    const optimizedBlob = await canvasToBlob(canvas, "image/webp", webpQuality);

    if (!optimizedBlob || optimizedBlob.size >= file.size * 0.88) {
      return file;
    }

    return new File([optimizedBlob], webpFileName(file.name), {
      lastModified: file.lastModified,
      type: "image/webp"
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function webpFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "image";
  return `${baseName}.webp`;
}
