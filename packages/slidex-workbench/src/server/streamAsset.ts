import type { FileHandle } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";

export function parseByteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}

export async function streamAsset(handle: FileHandle, mimeType: string, request: Request, response: ServerResponse) {
  try {
    const info = await handle.stat({ bigint: true });
    const size = Number(info.size);
    const etag = `"${info.ino}-${info.size}-${info.mtimeNs}-${info.ctimeNs}"`;
    const headers = {
      "accept-ranges": "bytes", "cache-control": "public, max-age=0, must-revalidate",
      "content-type": mimeType, "etag": etag, "x-content-type-options": "nosniff",
      ...(mimeType === "image/svg+xml" ? { "content-security-policy": "default-src 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'" } : {})
    };
    if (request.headers.get("if-none-match")?.split(/,\s*/).some((value) => value === etag || value === `W/${etag}` || value === "*")) {
      response.writeHead(304, headers); response.end(); return;
    }
    const rangeHeader = request.headers.get("range");
    const ifRange = request.headers.get("if-range");
    const range = request.method !== "HEAD" && rangeHeader && (!ifRange || ifRange === etag) ? parseByteRange(rangeHeader, size) : undefined;
    if (range === null) { response.writeHead(416, { ...headers, "content-range": `bytes */${size}` }); response.end(); return; }
    response.writeHead(range ? 206 : 200, {
      ...headers, "content-length": range ? range.end - range.start + 1 : size,
      ...(range ? { "content-range": `bytes ${range.start}-${range.end}/${size}` } : {})
    });
    if (request.method === "HEAD" || size === 0) { response.end(); return; }
    await pipeline(handle.createReadStream({ ...range, autoClose: false }), response).catch((error) => {
      if (!response.destroyed) throw error;
    });
  } finally { await handle.close(); }
}
