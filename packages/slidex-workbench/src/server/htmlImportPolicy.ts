import { htmlPageSourceLocations } from "@/core/motion-doc/domain/htmlPageSource";

const sourceAttributePattern = /<[A-Za-z][^>]*?\s+src\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const posterAttributePattern = /<[A-Za-z][^>]*?\s+poster\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const objectDataAttributePattern = /<object\b[^>]*?\s+data\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const resourceHrefPattern = /<(?:base|link|image|use)\b[^>]*?\s+(?:href|xlink:href)\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const srcsetAttributePattern = /<[A-Za-z][^>]*?\s+srcset\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const inlineStyleAttributePattern = /<[A-Za-z][^>]*?\s+style\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/gi;
const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const cssUrlPattern = /\burl\(\s*(["']?)(.*?)\1\s*\)/gi;
const cssImportPattern = /@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?/gi;
const remoteBasePattern = /<base\b[^>]*\bhref\s*=\s*(?:(["'])(.*?)\1|([^\s"'=<>`]+))/i;

export type HtmlPresentationPage = {
  id?: string;
  page: number;
  stage?: number;
};

export type HtmlNetworkResourceSummary = {
  origins: string[];
  referenceCount: number;
  requiresNetwork: boolean;
};

/**
 * Imported HTML keeps its original bytes and runs as an opaque-origin browser
 * document. Embedded resources work offline. Absolute HTTP(S) resources, CDN
 * libraries, and relative resources resolved by a remote <base> stay online.
 * Relative filesystem sidecars cannot be recovered from a single-file upload.
 */
export function assertSandboxedHtml(source: string) {
  if (!/^\s*(?:<!doctype\s+html\b[^>]*>\s*)?<html\b/i.test(source)) {
    throw badRequest("The HTML import must contain a complete <html> document.");
  }
  inspectHtmlNetworkResources(source);
}

/** Returns the online dependency boundary without changing canonical HTML. */
export function inspectHtmlNetworkResources(source: string): HtmlNetworkResourceSummary {
  const inspectedSource = htmlInspectionSource(source);
  const base = remoteBaseUrl(inspectedSource);
  const networkUrls: URL[] = [];
  for (const reference of htmlResourceReferences(inspectedSource)) {
    const resolved = networkResourceUrl(reference, base);
    if (resolved) networkUrls.push(resolved);
  }
  const origins = [...new Set(networkUrls.map((url) => url.origin))].sort();
  return {
    origins,
    referenceCount: networkUrls.length,
    requiresNetwork: networkUrls.length > 0
  };
}

/**
 * Recognizes the explicit OpenSlideX HTML page contract and the Gamma-style
 * page shell used by the IDAEO benchmark. The original document remains the
 * rendering source; these records only map its pages into presentation.mdx.
 */
export function analyzeHtmlPresentation(source: string): HtmlPresentationPage[] {
  return htmlPageSourceLocations(source).map(({ id, page, stage }) => ({
    ...(id ? { id } : {}),
    page,
    ...(stage === undefined ? {} : { stage })
  }));
}

/** CSP for browser-native HTML without granting the iframe OpenSlideX origin access. */
export const HTML_PLAYBACK_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri http: https:",
  "connect-src http: https: ws: wss: data: blob:",
  "font-src http: https: data: blob:",
  "form-action http: https:",
  "frame-ancestors 'self'",
  "frame-src http: https: data: blob:",
  "img-src http: https: data: blob:",
  "manifest-src http: https: data: blob:",
  "media-src http: https: data: blob:",
  "object-src http: https: data: blob:",
  "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http: https: data: blob:",
  "style-src 'unsafe-inline' http: https: data: blob:",
  "worker-src http: https: data: blob:"
].join("; ");

function htmlResourceReferences(source: string) {
  const cssSources = [
    ...matches(source, styleBlockPattern, 1),
    ...attributeMatches(source, inlineStyleAttributePattern)
  ];
  const references = [
    ...attributeMatches(source, sourceAttributePattern),
    ...attributeMatches(source, posterAttributePattern),
    ...attributeMatches(source, objectDataAttributePattern),
    ...attributeMatches(source, resourceHrefPattern),
    ...cssSources.flatMap(cssResourceReferences),
    ...attributeMatches(source, srcsetAttributePattern).flatMap(srcsetReferences)
  ];
  return references.map((value) => value.trim()).filter(Boolean);
}

function matches(source: string, pattern: RegExp, group = 2) {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => match[group] ?? "");
}

function attributeMatches(source: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].map((match) => decodeHtmlAttributeValue(match[2] ?? match[3] ?? ""));
}

function cssResourceReferences(source: string) {
  cssImportPattern.lastIndex = 0;
  const imports = [...source.matchAll(cssImportPattern)].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
    start: match.index ?? 0,
    value: match[2] ?? ""
  }));
  cssUrlPattern.lastIndex = 0;
  const urls = [...source.matchAll(cssUrlPattern)]
    .filter((match) => !imports.some(({ end, start }) => (match.index ?? 0) >= start && (match.index ?? 0) < end))
    .map((match) => match[2] ?? "");
  return [...imports.map(({ value }) => value), ...urls];
}

function htmlInspectionSource(source: string) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<(script|textarea|title)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, "$1$3");
}

function srcsetReferences(value: string) {
  return value
    .split(/\s*,\s*(?=(?:https?:|data:|blob:|\/\/|\.{0,2}\/|#))/i)
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? "")
    .filter(Boolean);
}

function remoteBaseUrl(source: string) {
  const match = source.match(remoteBasePattern);
  const value = decodeHtmlAttributeValue(match?.[2] ?? match?.[3] ?? "").trim();
  if (!value) return undefined;
  return networkResourceUrl(value);
}

/** Mirrors the character-reference decoding browsers apply to attribute values. */
function decodeHtmlAttributeValue(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|apos|gt|lt|quot));/gi,
    (reference, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
      if (decimal || hexadecimal) {
        const codePoint = Number.parseInt(decimal ?? hexadecimal ?? "", decimal ? 10 : 16);
        if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
          return String.fromCodePoint(codePoint);
        }
        return reference;
      }
      return {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        quot: '"'
      }[named?.toLowerCase() ?? ""] ?? reference;
    }
  );
}

function networkResourceUrl(value: string, base?: URL): URL | undefined {
  const reference = value.trim();
  if (!reference || reference.startsWith("#")) return undefined;
  if (/^(?:data:|blob:|about:blank(?:#.*)?$)/i.test(reference)) return undefined;

  let resolved: URL;
  try {
    if (reference.startsWith("//")) resolved = new URL(`https:${reference}`);
    else if (/^https?:/i.test(reference)) resolved = new URL(reference);
    else if (base && !hasProtocol(reference)) resolved = new URL(reference, base);
    else {
      throw badRequest(
        `The HTML import references a relative or unsupported resource (${summarizeReference(reference)}). ` +
        "Use an absolute HTTP(S) URL, add a remote <base href>, or inline the resource."
      );
    }
  } catch (error) {
    if (isStatusError(error)) throw error;
    throw badRequest(`The HTML import contains an invalid resource URL (${summarizeReference(reference)}).`);
  }

  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw badRequest(
      `The HTML import uses an unsupported resource protocol (${resolved.protocol}). ` +
      "Use HTTP(S), data:, or blob: resources."
    );
  }
  return resolved;
}

function hasProtocol(value: string) {
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(value);
}

function summarizeReference(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  try {
    const url = new URL(normalized.startsWith("//") ? `https:${normalized}` : normalized);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 80);
  } catch {
    return normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
  }
}

function isStatusError(value: unknown): value is Error & { status: number } {
  return value !== null && typeof value === "object" && "status" in value && typeof value.status === "number";
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
export {
  injectHtmlPlaybackBridge
} from "@/core/motion-doc/infrastructure/export/htmlEmbedBridge";
