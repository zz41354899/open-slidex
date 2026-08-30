import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { withSlideXFileLock } from "@open-slidex/sdk/node";

export type TrustedImageCandidate = {
  alt: string;
  attribution: { name: string; profileUrl: string };
  height: number;
  id: string;
  license: "Unsplash License";
  provider: "unsplash";
  thumbUrl: string;
  width: number;
};

export type SlideXAssetProvenance = {
  importedAt: string;
  source: string;
  [key: string]: unknown;
};

type UnsplashPhoto = TrustedImageCandidate & {
  downloadLocation: string;
  regularUrl: string;
};

const maximumImageBytes = 25 * 1024 * 1024;

export async function searchTrustedImages(
  query: string,
  options: { accessKey?: string; fetch?: typeof fetch } = {}
) {
  const accessKey = options.accessKey?.trim();
  if (!accessKey) return { candidates: [], provider: "unsplash" as const, status: "not_configured" as const };
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("content_filter", "high");
  const response = await requestUnsplash(url, accessKey, options.fetch);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.results)) throw new Error("Unsplash returned an invalid search response.");
  const candidates = payload.results.flatMap(parsePhoto).map(publicCandidate);
  return {
    candidates,
    confirmationRequired: true,
    provider: "unsplash" as const,
    status: "ok" as const
  };
}

export async function downloadTrustedImage(
  id: string,
  options: { accessKey?: string; fetch?: typeof fetch } = {}
) {
  const accessKey = options.accessKey?.trim();
  if (!accessKey) throw new Error("UNSPLASH_ACCESS_KEY is not configured.");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid Unsplash asset ID.");
  const fetchImpl = options.fetch ?? fetch;
  const metadataResponse = await requestUnsplash(new URL(`https://api.unsplash.com/photos/${id}`), accessKey, fetchImpl);
  const photos = parsePhoto(await metadataResponse.json());
  const photo = photos[0];
  if (!photo) throw new Error("Unsplash returned invalid image metadata.");

  await requestUnsplash(new URL(photo.downloadLocation), accessKey, fetchImpl).catch(() => undefined);
  const imageUrl = new URL(photo.regularUrl);
  if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "images.unsplash.com") {
    throw new Error("Unsplash returned an untrusted image URL.");
  }
  const response = await fetchImpl(imageUrl, { redirect: "error", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Unsplash image download failed: ${response.status}`);
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]).has(mediaType)) {
    throw new Error("Unsplash returned an unsupported image type.");
  }
  const declaredBytes = Number(response.headers.get("content-length") ?? 0);
  if (declaredBytes > maximumImageBytes) throw new Error("Unsplash image exceeds the import limit.");
  const bytes = await readBoundedResponse(response, maximumImageBytes);
  return { bytes, mediaType, photo: publicCandidate(photo) };
}

export async function appendImageProvenance(
  root: string,
  provenance: SlideXAssetProvenance
) {
  const stateRoot = path.join(root, ".open-slidex");
  const target = path.join(stateRoot, "asset-provenance.json");
  await mkdir(stateRoot, { recursive: true });
  await withSlideXFileLock(`${target}.lock`, async () => {
    const current = await readFile(target, "utf8")
      .then((value) => JSON.parse(value) as unknown)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
    if (!Array.isArray(current)) throw new Error("OpenSlideX asset provenance is invalid.");
    const next = [...current.filter((value) => isRecord(value) && value.source !== provenance.source), provenance];
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  });
}

export async function readBoundedResponse(response: Response, maximumBytes: number) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) throw new Error("Unsplash image exceeds the import limit.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function requestUnsplash(url: URL, accessKey: string, fetchImpl: typeof fetch = fetch) {
  if (url.protocol !== "https:" || url.hostname !== "api.unsplash.com") {
    throw new Error("Only the trusted Unsplash API is allowed.");
  }
  return fetchImpl(url, {
    headers: { Accept: "application/json", "Accept-Version": "v1", Authorization: `Client-ID ${accessKey}` },
    redirect: "error",
    signal: AbortSignal.timeout(8_000)
  }).then((response) => {
    if (!response.ok) throw new Error(`Unsplash request failed: ${response.status}`);
    return response;
  });
}

function parsePhoto(value: unknown): UnsplashPhoto[] {
  if (
    !isRecord(value) || typeof value.id !== "string" || typeof value.width !== "number" || typeof value.height !== "number" ||
    !isRecord(value.urls) || typeof value.urls.thumb !== "string" || typeof value.urls.regular !== "string" ||
    !isRecord(value.user) || typeof value.user.name !== "string" || !isRecord(value.user.links) || typeof value.user.links.html !== "string" ||
    !isRecord(value.links) || typeof value.links.download_location !== "string" ||
    !allowedUrl(value.urls.thumb, ["images.unsplash.com"]) || !allowedUrl(value.urls.regular, ["images.unsplash.com"]) ||
    !allowedUrl(value.user.links.html, ["unsplash.com", "www.unsplash.com"]) || !allowedUrl(value.links.download_location, ["api.unsplash.com"])
  ) return [];
  return [{
    alt: typeof value.alt_description === "string" ? value.alt_description : typeof value.description === "string" ? value.description : "Unsplash image",
    attribution: { name: value.user.name, profileUrl: value.user.links.html },
    downloadLocation: value.links.download_location,
    height: value.height,
    id: value.id,
    license: "Unsplash License",
    provider: "unsplash",
    regularUrl: value.urls.regular,
    thumbUrl: value.urls.thumb,
    width: value.width
  }];
}

function publicCandidate(photo: UnsplashPhoto): TrustedImageCandidate {
  return {
    alt: photo.alt,
    attribution: photo.attribution,
    height: photo.height,
    id: photo.id,
    license: photo.license,
    provider: photo.provider,
    thumbUrl: photo.thumbUrl,
    width: photo.width
  };
}

function allowedUrl(value: string, hosts: readonly string[]) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
