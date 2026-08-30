import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import path from "node:path";

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
  options: { request?: typeof request } = {}
): Promise<PublicImageDownload> {
  const original = publicHttpsUrl(input);
  const downloaded = await download(original, 0, options.request ?? request);
  return {
    ...downloaded,
    originalUrl: original.toString()
  };
}

async function download(url: URL, redirects: number, requestImpl: typeof request) {
  if (redirects > maximumRedirects) throw new Error("The image URL redirected too many times.");
  const target = await resolvedPublicAddress(url);
  const response = await requestOnce(url, target, requestImpl);
  if (response.redirect) {
    response.stream.resume();
    return download(publicHttpsUrl(new URL(response.redirect, url).toString()), redirects + 1, requestImpl);
  }
  if (response.status < 200 || response.status >= 300) {
    response.stream.resume();
    throw new Error(`Remote image download failed: ${response.status}`);
  }
  const declaredBytes = Number(response.stream.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumImageBytes) {
    response.stream.destroy();
    throw new Error("Remote image exceeds the import limit.");
  }
  const bytes = await readBounded(response.stream, maximumImageBytes);
  const mediaType = String(response.stream.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return {
    bytes,
    fileName: remoteFileName(url, mediaType),
    finalUrl: url.toString(),
    ...(mediaType.startsWith("image/") ? { mediaType } : {})
  };
}

async function resolvedPublicAddress(url: URL) {
  const literalFamily = isIP(url.hostname);
  const addresses = literalFamily
    ? [{ address: url.hostname, family: literalFamily }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("Remote image host does not resolve exclusively to public addresses.");
  }
  return addresses[0]!;
}

function requestOnce(
  url: URL,
  target: { address: string; family: number },
  requestImpl: typeof request
) {
  return new Promise<{
    redirect?: string;
    status: number;
    stream: import("node:http").IncomingMessage;
  }>((resolve, reject) => {
    const client = requestImpl({
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "User-Agent": "OpenSlideX/0.5 source-import"
      },
      hostname: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      method: "GET",
      path: `${url.pathname}${url.search}`,
      port: 443,
      protocol: "https:",
      servername: isIP(url.hostname) ? undefined : url.hostname,
      timeout: requestTimeoutMs
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      resolve({
        ...(status >= 300 && status < 400 && location ? { redirect: location } : {}),
        status,
        stream: response
      });
    });
    client.once("timeout", () => client.destroy(new Error("Remote image download timed out.")));
    client.once("error", reject);
    client.end();
  });
}

async function readBounded(stream: import("node:http").IncomingMessage, maximumBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maximumBytes) {
      stream.destroy();
      throw new Error("Remote image exceeds the import limit.");
    }
    chunks.push(bytes);
  }
  return new Uint8Array(Buffer.concat(chunks, total));
}

function publicHttpsUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Remote image URL is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.port && url.port !== "443"
    || url.username
    || url.password
    || url.hostname.toLowerCase().endsWith(".local")
  ) {
    throw new Error("Remote images require a credential-free public HTTPS URL on port 443.");
  }
  return url;
}

export function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isBlockedAddress(normalized.slice("::ffff:".length));
  if (isIP(normalized) === 4) {
    const [a = 0, b = 0] = normalized.split(".").map(Number);
    return (
      a === 0
      || a === 10
      || a === 127
      || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && [0, 2, 168].includes(b))
      || (a === 198 && [18, 19, 51].includes(b))
      || (a === 203 && b === 0)
    );
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("2001:db8:")
    );
  }
  return true;
}

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
