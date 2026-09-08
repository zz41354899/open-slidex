import { request } from "node:https";
import path from "node:path";

import {
  downloadPublicHttpsResource,
  isBlockedPublicAddress
} from "@/common/util/publicHttpsDownload";

const maximumImageBytes = 25 * 1024 * 1024;
const maximumRedirects = 5;
const requestTimeoutMs = 12_000;

export type PublicImageDownload = {
  bytes: Uint8Array;
  fileName: string;
  finalUrl: string;
  mediaType?: string;
  originalUrl: string;
};

export async function downloadPublicImage(
  input: string,
  options: {
    request?: typeof request;
    resolver?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  } = {}
): Promise<PublicImageDownload> {
  const downloaded = await downloadPublicHttpsResource(input, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
    maximumBytes: maximumImageBytes,
    maximumRedirects,
    request: options.request ?? request,
    resolver: options.resolver,
    timeoutMs: requestTimeoutMs,
    userAgent: "OpenSlideX/0.6 source-import"
  });
  return {
    bytes: downloaded.bytes,
    finalUrl: downloaded.finalUrl,
    fileName: remoteFileName(new URL(downloaded.finalUrl), downloaded.mediaType ?? ""),
    ...(downloaded.mediaType?.startsWith("image/") ? { mediaType: downloaded.mediaType } : {}),
    originalUrl: new URL(input).toString()
  };
}

export const isBlockedAddress = isBlockedPublicAddress;

function remoteFileName(url: URL, mediaType: string) {
  const candidate = decodeURIComponent(path.posix.basename(url.pathname)).replace(/[^A-Za-z0-9._-]+/g, "-");
  if (candidate && path.posix.extname(candidate)) return candidate.slice(0, 120);
  const extension = ({
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  } as Record<string, string>)[mediaType] ?? ".img";
  return `remote-image${extension}`;
}
