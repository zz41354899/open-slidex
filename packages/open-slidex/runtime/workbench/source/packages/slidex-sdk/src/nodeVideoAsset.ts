import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveInsideRoot } from "./nodePath";

const maximumVideoBytes = 80 * 1024 * 1024;

export type ImportSlideXVideoAssetInput = {
  assetsDir?: string;
  bytes: Uint8Array;
  fileName: string;
  mediaType?: string;
  projectRoot: string;
};

export type SlideXVideoAsset = {
  bytes: number;
  deduplicated: boolean;
  mimeType: "video/mp4";
  name: string;
  outputPath: string;
  source: string;
};

export class SlideXVideoAssetError extends Error {
  constructor(readonly code: "invalid_source" | "invalid_video" | "unsupported_video" | "video_too_large", message: string) {
    super(message);
    this.name = "SlideXVideoAssetError";
  }
}

/** Stores a root-confined, content-addressed MP4 without re-encoding it. */
export async function importSlideXVideoAsset(input: ImportSlideXVideoAssetInput): Promise<SlideXVideoAsset> {
  if (!(input.bytes instanceof Uint8Array)) {
    throw new SlideXVideoAssetError("invalid_source", "Video uploads must use binary bytes.");
  }
  if (input.bytes.byteLength < 12 || !isMp4(input.bytes)) {
    throw new SlideXVideoAssetError("invalid_video", "The uploaded file is not a valid MP4 container.");
  }
  if (input.bytes.byteLength > maximumVideoBytes) {
    throw new SlideXVideoAssetError("video_too_large", "MP4 videos must not exceed 80 MB.");
  }
  if (input.mediaType && input.mediaType.split(";", 1)[0].trim().toLowerCase() !== "video/mp4") {
    throw new SlideXVideoAssetError("unsupported_video", "Only video/mp4 uploads are supported.");
  }

  const fileName = safeVideoName(input.fileName);
  const projectRoot = await realpath(path.resolve(input.projectRoot)).catch(() => {
    throw new SlideXVideoAssetError("invalid_source", "The OpenSlideX project root does not exist.");
  });
  const requestedAssetsDir = resolveInsideRoot(projectRoot, input.assetsDir ?? "assets");
  await mkdir(requestedAssetsDir, { recursive: true });
  const assetsDir = await realAssetsDirectory(projectRoot, requestedAssetsDir);
  const hash = createHash("sha256").update(input.bytes).digest("hex");
  const name = `${fileName}-${hash.slice(0, 16)}.mp4`;
  const outputPath = resolveInsideRoot(assetsDir, name);
  const deduplicated = await writeContentAddressedFile(outputPath, input.bytes);

  return {
    bytes: input.bytes.byteLength,
    deduplicated,
    mimeType: "video/mp4",
    name,
    outputPath,
    source: path.relative(projectRoot, outputPath).split(path.sep).join("/")
  };
}

function isMp4(bytes: Uint8Array) {
  return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
}

function safeVideoName(value: string) {
  if (!value || value !== path.basename(value) || /^(?:data|https?):/i.test(value)) {
    throw new SlideXVideoAssetError("invalid_source", "The video filename cannot contain a path or URL.");
  }
  const stem = value
    .replace(/\.mp4$/i, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  if (!stem) throw new SlideXVideoAssetError("invalid_source", "Choose a valid MP4 filename.");
  return stem;
}

async function realAssetsDirectory(projectRoot: string, assetsDir: string) {
  const stats = await lstat(assetsDir);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new SlideXVideoAssetError("invalid_source", "The assets directory must be a real directory.");
  }
  const resolved = await realpath(assetsDir);
  resolveInsideRoot(projectRoot, resolved);
  return resolved;
}

async function writeContentAddressedFile(outputPath: string, contents: Uint8Array) {
  const existing = await lstat(outputPath).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new SlideXVideoAssetError("invalid_source", "The destination asset path is not a regular file.");
    }
    if ((await readFile(outputPath)).equals(contents)) return true;
    throw new SlideXVideoAssetError("invalid_source", "An asset hash collision was detected.");
  }
  const temporary = resolveInsideRoot(path.dirname(outputPath), `.${path.basename(outputPath)}.${randomUUID()}.tmp`);
  await writeFile(temporary, contents, { flag: "wx", mode: 0o644 });
  try {
    await rename(temporary, outputPath);
    return false;
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
