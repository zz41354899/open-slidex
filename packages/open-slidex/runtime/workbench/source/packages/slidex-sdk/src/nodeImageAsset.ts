import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { resolveInsideRoot } from "./nodePath";

const defaultMaximumInputBytes = 25 * 1024 * 1024;
const maximumImagePixels = 40_000_000;
const maximumImageDimension = 2304;
const defaultTargetOutputBytes = 2 * 1024 * 1024;
const minimumTargetOutputBytes = 64 * 1024;
const outputMimeType = "image/webp";
const supportedInputMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export type ImportSlideXImageAssetInput = {
  assetsDir?: string;
  bytes: Uint8Array;
  fileName: string;
  maxInputBytes?: number;
  mediaType?: string;
  projectRoot: string;
  targetOutputBytes?: number;
};

export type SlideXImageAsset = {
  bytes: number;
  deduplicated: boolean;
  height: number;
  inputBytes: number;
  inputMimeType: string;
  mimeType: typeof outputMimeType;
  name: string;
  optimized: true;
  outputPath: string;
  source: string;
  width: number;
  targetOutputBytes: number;
};

export class SlideXImageAssetError extends Error {
  constructor(
    readonly code:
      | "image_too_large"
      | "invalid_image"
      | "invalid_source"
      | "unsupported_image",
    message: string
  ) {
    super(message);
    this.name = "SlideXImageAssetError";
  }
}

export async function importSlideXImageAsset(
  input: ImportSlideXImageAssetInput
): Promise<SlideXImageAsset> {
  assertBinaryInput(input.bytes);
  const maximumInputBytes = input.maxInputBytes ?? defaultMaximumInputBytes;
  if (!Number.isSafeInteger(maximumInputBytes) || maximumInputBytes <= 0) {
    throw new SlideXImageAssetError(
      "invalid_source",
      "maxInputBytes must be a positive integer."
    );
  }
  if (input.bytes.byteLength < 1) {
    throw new SlideXImageAssetError("invalid_image", "The image is empty.");
  }
  if (input.bytes.byteLength > maximumInputBytes) {
    throw new SlideXImageAssetError(
      "image_too_large",
      `The image exceeds the ${maximumInputBytes}-byte limit.`
    );
  }

  const fileName = assertFileName(input.fileName);
  const declaredMimeType = normalizeMimeType(input.mediaType);
  const detectedMimeType = detectImageMimeType(input.bytes);
  if (!detectedMimeType) {
    throw new SlideXImageAssetError(
      "unsupported_image",
      "Use a JPEG, PNG, WebP, AVIF, or non-animated GIF image."
    );
  }
  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    throw new SlideXImageAssetError(
      "invalid_image",
      "The decoded image type does not match the declared media type."
    );
  }

  const targetOutputBytes = input.targetOutputBytes ?? defaultTargetOutputBytes;
  if (
    !Number.isSafeInteger(targetOutputBytes) ||
    targetOutputBytes < minimumTargetOutputBytes ||
    targetOutputBytes > maximumInputBytes
  ) {
    throw new SlideXImageAssetError(
      "invalid_source",
      `targetOutputBytes must be an integer between ${minimumTargetOutputBytes} and maxInputBytes.`
    );
  }

  const normalized = await normalizeImage(input.bytes, targetOutputBytes);
  if (normalized.data.byteLength > maximumInputBytes) {
    throw new SlideXImageAssetError(
      "image_too_large",
      "The normalized WebP image is too large."
    );
  }

  const requestedProjectRoot = path.resolve(input.projectRoot);
  const requestedAssetsDir = resolveInsideRoot(
    requestedProjectRoot,
    input.assetsDir ?? "assets"
  );
  const projectRoot = await realpath(requestedProjectRoot).catch(() => {
    throw new SlideXImageAssetError(
      "invalid_source",
      "The OpenSlideX project root does not exist."
    );
  });
  await mkdir(requestedAssetsDir, { recursive: true });
  const assetsDir = await assertRealAssetsDirectory(
    projectRoot,
    requestedAssetsDir
  );

  const hash = createHash("sha256").update(normalized.data).digest("hex");
  const name = `${safeImageStem(fileName)}-${hash.slice(0, 16)}.webp`;
  const outputPath = resolveInsideRoot(assetsDir, name);
  const deduplicated = await writeContentAddressedFile(
    outputPath,
    normalized.data
  );
  const source = path
    .relative(projectRoot, outputPath)
    .split(path.sep)
    .join("/");

  return {
    bytes: normalized.data.byteLength,
    deduplicated,
    height: normalized.height,
    inputBytes: input.bytes.byteLength,
    inputMimeType: detectedMimeType,
    mimeType: outputMimeType,
    name,
    optimized: true,
    outputPath,
    source,
    targetOutputBytes,
    width: normalized.width
  };
}

function assertBinaryInput(
  bytes: Uint8Array
): asserts bytes is Uint8Array {
  if (!(bytes instanceof Uint8Array)) {
    throw new SlideXImageAssetError(
      "invalid_source",
      "Image uploads must use binary bytes. Base64 and data URLs are not accepted."
    );
  }
}

function assertFileName(value: string) {
  if (
    !value ||
    value !== path.basename(value) ||
    /^(?:data|https?):/i.test(value)
  ) {
    throw new SlideXImageAssetError(
      "invalid_source",
      "The image filename cannot contain a path, URL, Base64, or data URL."
    );
  }
  return value;
}

function normalizeMimeType(value: string | undefined) {
  const mediaType = value?.split(";", 1)[0].trim().toLowerCase();
  if (!mediaType) return undefined;
  if (!supportedInputMimeTypes.has(mediaType)) {
    throw new SlideXImageAssetError(
      "unsupported_image",
      `Unsupported image media type: ${mediaType}.`
    );
  }
  return mediaType;
}

async function normalizeImage(bytes: Uint8Array, targetOutputBytes: number) {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(bytes, {
      animated: true,
      failOn: "error",
      limitInputPixels: maximumImagePixels
    }).metadata();
  } catch {
    throw new SlideXImageAssetError(
      "invalid_image",
      "The image could not be decoded."
    );
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > maximumImagePixels
  ) {
    throw new SlideXImageAssetError(
      "invalid_image",
      "The image dimensions are not allowed."
    );
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new SlideXImageAssetError(
      "unsupported_image",
      "Animated images are not supported."
    );
  }

  try {
    const dimensions = [maximumImageDimension, 1920, 1600, 1280, 1024, 768, 512, 384, 256];
    const qualities = [84, 78, 72, 66, 60];
    let smallest: {
      data: Buffer;
      info: { height: number; width: number };
    } | undefined;

    for (const dimension of dimensions) {
      for (const quality of qualities) {
        const result = await sharp(bytes, {
          failOn: "error",
          limitInputPixels: maximumImagePixels
        })
          .rotate()
          .resize({
            fit: "inside",
            height: dimension,
            width: dimension,
            withoutEnlargement: true
          })
          .webp({
            alphaQuality: Math.max(quality + 6, 72),
            effort: 4,
            quality,
            smartSubsample: true
          })
          .toBuffer({ resolveWithObject: true });
        smallest = result;
        if (result.data.byteLength <= targetOutputBytes) {
          return {
            data: result.data,
            height: result.info.height,
            width: result.info.width
          };
        }
      }
    }

    if (smallest) {
      return {
        data: smallest.data,
        height: smallest.info.height,
        width: smallest.info.width
      };
    }
    throw new Error("No image candidate was produced.");
  } catch {
    throw new SlideXImageAssetError(
      "invalid_image",
      "The image could not be normalized to WebP."
    );
  }
}

async function assertRealAssetsDirectory(
  projectRoot: string,
  assetsDir: string
) {
  const stats = await lstat(assetsDir);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new SlideXImageAssetError(
      "invalid_source",
      "The assets directory must be a real directory."
    );
  }
  const actualAssetsDir = await realpath(assetsDir);
  resolveInsideRoot(projectRoot, actualAssetsDir);
  return actualAssetsDir;
}

async function writeContentAddressedFile(
  outputPath: string,
  contents: Buffer
) {
  const existingStats = await lstat(outputPath).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  );
  if (existingStats) {
    if (!existingStats.isFile() || existingStats.isSymbolicLink()) {
      throw new SlideXImageAssetError(
        "invalid_source",
        "The destination asset path is not a regular file."
      );
    }
    const existing = await readFile(outputPath);
    if (existing.equals(contents)) return true;
    throw new SlideXImageAssetError(
      "invalid_source",
      "An asset hash collision was detected."
    );
  }

  const temporaryPath = resolveInsideRoot(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${randomUUID()}.tmp`
  );
  await writeFile(temporaryPath, contents, { mode: 0o644 });
  try {
    await rename(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return false;
}

function safeImageStem(fileName: string) {
  const stem = path.basename(fileName, path.extname(fileName));
  return (
    stem
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image"
  );
}

function detectImageMimeType(bytes: Uint8Array) {
  const startsWith = (...signature: number[]) =>
    bytes.byteLength >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte);
  const ascii = (start: number, end: number) =>
    Buffer.from(bytes.subarray(start, end)).toString("ascii");

  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png";
  }
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") {
    return "image/gif";
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(4, 8) === "ftyp") {
    const boxLength =
      bytes.byteLength >= 4
        ? new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
          ).getUint32(0)
        : 0;
    const boxEnd = Math.min(
      bytes.byteLength,
      boxLength >= 16 ? boxLength : bytes.byteLength
    );
    for (let index = 8; index + 4 <= boxEnd; index += 4) {
      const brand = ascii(index, index + 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  return undefined;
}
