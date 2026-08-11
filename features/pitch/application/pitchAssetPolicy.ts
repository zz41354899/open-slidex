import { sanitizeMotionDocMediaSource } from "@/core/motion-doc/domain/mediaSource";

export const pitchAssetKinds = ["image", "video"] as const;

export type PitchAssetKind = (typeof pitchAssetKinds)[number];

export type PitchAssetDescriptor = {
  name: string;
  size: number;
  type: string;
};

export type PitchAssetValidation =
  | { kind: PitchAssetKind; ok: true }
  | { message: string; ok: false };

const mebibyte = 1024 * 1024;

export const pitchAssetLimits = {
  image: 10 * mebibyte,
  source: 50 * mebibyte,
  video: 50 * mebibyte
} as const;

export const pitchAssetMimeTypes = {
  image: [
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp"
  ],
  video: ["video/mp4", "video/quicktime", "video/webm"]
} as const satisfies Record<PitchAssetKind, readonly string[]>;

export const pitchAssetAllowedMimeTypes = Object.values(pitchAssetMimeTypes).flat();

export const pitchAssetCacheControlSeconds = 31_536_000;
export const pitchWorkspaceDefaultQuotaBytes = 1024 * mebibyte;

export function normalizeDirectPitchImageSource(value: string) {
  const source = sanitizeMotionDocMediaSource(value);
  if (!source || source.startsWith("blob:") || source.startsWith("data:")) return null;
  return source;
}

export function normalizeAbsolutePitchImageSource(value: string) {
  const source = normalizeDirectPitchImageSource(value);
  if (!source) return null;

  try {
    return new URL(source).protocol === "https:" ? source : null;
  } catch {
    return null;
  }
}

export function pitchAssetKindFromMimeType(mimeType: string): PitchAssetKind | null {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  for (const kind of pitchAssetKinds) {
    if (pitchAssetMimeTypes[kind].some((allowedMimeType) => allowedMimeType === normalizedMimeType)) {
      return kind;
    }
  }

  return null;
}

export function validatePitchAssetSource(asset: PitchAssetDescriptor): PitchAssetValidation {
  const kind = pitchAssetKindFromMimeType(asset.type);
  if (!kind) {
    return { message: "This file type is not supported", ok: false };
  }

  if (asset.size <= 0) {
    return { message: "The selected file is empty", ok: false };
  }

  if (asset.size > pitchAssetLimits.source) {
    return { message: "Files must be 50 MB or smaller", ok: false };
  }

  return { kind, ok: true };
}

export function validatePreparedPitchAsset(asset: PitchAssetDescriptor): PitchAssetValidation {
  const sourceValidation = validatePitchAssetSource(asset);
  if (!sourceValidation.ok) return sourceValidation;

  const maxBytes = pitchAssetLimits[sourceValidation.kind];
  if (asset.size > maxBytes) {
    return {
      message: `${labelForKind(sourceValidation.kind)} must be ${formatMebibytes(maxBytes)} MB or smaller`,
      ok: false
    };
  }

  return sourceValidation;
}

function labelForKind(kind: PitchAssetKind) {
  if (kind === "image") return "Images";
  return "Videos";
}

function formatMebibytes(bytes: number) {
  return Math.round(bytes / mebibyte);
}
