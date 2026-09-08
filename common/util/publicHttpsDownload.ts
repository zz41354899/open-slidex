import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import { isIP } from "node:net";

type PublicAddress = { address: string; family: number };

export type PublicHttpsDownloadOptions = {
  headers?: RequestOptions["headers"];
  maximumBytes: number;
  maximumRedirects?: number;
  request?: typeof request;
  resolver?: (hostname: string) => Promise<PublicAddress[]>;
  timeoutMs?: number;
  userAgent: string;
};

export type PublicHttpsDownload = {
  bytes: Uint8Array;
  finalUrl: string;
  mediaType?: string;
};

export async function downloadPublicHttpsResource(
  input: string,
  options: PublicHttpsDownloadOptions
): Promise<PublicHttpsDownload> {
  if (!Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 1) {
    throw new Error("Remote download maximumBytes must be a positive integer.");
  }
  const maximumRedirects = options.maximumRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 12_000;
  if (!Number.isSafeInteger(maximumRedirects) || maximumRedirects < 0) {
    throw new Error("Remote download maximumRedirects must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Remote download timeoutMs must be a positive integer.");
  }
  return download(publicHttpsUrl(input), 0, {
    ...options,
    deadlineAt: Date.now() + timeoutMs,
    maximumRedirects,
    request: options.request ?? request,
    resolver: options.resolver ?? resolveAddresses,
    timeoutMs
  });
}

async function download(
  url: URL,
  redirects: number,
  options: PublicHttpsDownloadOptions & {
    deadlineAt: number;
    maximumRedirects: number;
    request: typeof request;
    resolver: (hostname: string) => Promise<PublicAddress[]>;
    timeoutMs: number;
  }
): Promise<PublicHttpsDownload> {
  if (redirects > options.maximumRedirects) throw new Error("The remote URL redirected too many times.");
  const target = await withRemoteDeadline(
    resolvedPublicAddress(url, options.resolver),
    options.deadlineAt
  );
  const response = await requestOnce(url, target, options);
  try {
    if (response.redirect) {
      response.stream.destroy();
      return download(publicHttpsUrl(new URL(response.redirect, url).toString()), redirects + 1, options);
    }
    if (response.status < 200 || response.status >= 300) {
      response.stream.destroy();
      throw new Error(`Remote download failed: ${response.status}`);
    }
    const declaredBytes = Number(response.stream.headers["content-length"] ?? 0);
    if (Number.isFinite(declaredBytes) && declaredBytes > options.maximumBytes) {
      response.stream.destroy();
      throw new Error("Remote resource exceeds the download limit.");
    }
    const bytes = await readBounded(response.stream, options.maximumBytes);
    const mediaType = String(response.stream.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    return {
      bytes,
      finalUrl: url.toString(),
      ...(mediaType ? { mediaType } : {})
    };
  } finally {
    response.cancelDeadline();
  }
}

async function resolvedPublicAddress(
  url: URL,
  resolver: (hostname: string) => Promise<PublicAddress[]>
) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolver(hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedPublicAddress(address))) {
    throw new Error("Remote host does not resolve exclusively to public addresses.");
  }
  return addresses[0]!;
}

function requestOnce(
  url: URL,
  target: PublicAddress,
  options: PublicHttpsDownloadOptions & { deadlineAt: number; request: typeof request; timeoutMs: number }
) {
  return new Promise<{
    cancelDeadline: () => void;
    redirect?: string;
    status: number;
    stream: import("node:http").IncomingMessage;
  }>((resolve, reject) => {
    const remaining = options.deadlineAt - Date.now();
    if (remaining < 1) {
      reject(new Error("Remote download timed out."));
      return;
    }
    let settled = false;
    const client = options.request({
      headers: {
        ...options.headers,
        "User-Agent": options.userAgent
      },
      hostname: url.hostname,
      lookup: (_hostname, _lookupOptions, callback) => callback(null, target.address, target.family),
      method: "GET",
      path: `${url.pathname}${url.search}`,
      port: 443,
      protocol: "https:",
      servername: isIP(url.hostname.replace(/^\[|\]$/g, "")) ? undefined : url.hostname,
      timeout: remaining
    }, (response) => {
      settled = true;
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      resolve({
        cancelDeadline: () => clearTimeout(deadline),
        ...(status >= 300 && status < 400 && location ? { redirect: location } : {}),
        status,
        stream: response
      });
    });
    const deadline = setTimeout(() => {
      client.destroy(new Error("Remote download timed out."));
    }, remaining);
    client.once("timeout", () => client.destroy(new Error("Remote download timed out.")));
    client.once("error", (error) => {
      clearTimeout(deadline);
      if (!settled) reject(error);
    });
    client.end();
  });
}

async function withRemoteDeadline<T>(operation: Promise<T>, deadlineAt: number) {
  const remaining = deadlineAt - Date.now();
  if (remaining < 1) throw new Error("Remote download timed out.");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error("Remote download timed out."))),
      remaining
    );
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
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
      throw new Error("Remote resource exceeds the download limit.");
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
    throw new Error("Remote URL is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.port && url.port !== "443"
    || url.username
    || url.password
    || url.hostname.toLowerCase().endsWith(".local")
  ) {
    throw new Error("Remote resources require a credential-free public HTTPS URL on port 443.");
  }
  return url;
}

async function resolveAddresses(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

export function isBlockedPublicAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isBlockedPublicAddress(normalized.slice("::ffff:".length));
  if (isIP(normalized) === 4) {
    const [a = 0, b = 0, c = 0] = normalized.split(".").map(Number);
    return (
      a === 0
      || a === 10
      || a === 127
      || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && [0, 2].includes(c))
      || (a === 192 && b === 88 && c === 99)
      || (a === 192 && b === 168)
      || (a === 198 && [18, 19].includes(b))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(normalized) === 6) {
    const first = Number.parseInt(normalized.split(":", 1)[0] || "0", 16);
    return first < 0x2000 || first > 0x3fff || normalized.startsWith("2001:db8:");
  }
  return true;
}
