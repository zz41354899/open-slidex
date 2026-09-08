import { htmlPageSourceLocations } from "@/core/motion-doc/domain/htmlPageSource";
import { htmlAttributeToken, scanCssUrls, scanHtmlDocument, type HtmlTagToken } from "./htmlScanner";

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

/** Local sidecars are only permitted after Workspace has copied and hashed them. */
export type HtmlImportPolicyOptions = {
  localAssets?: Iterable<string>;
};

/**
 * Imported HTML keeps its original bytes and runs as an opaque-origin browser
 * document. Embedded resources work offline. Absolute HTTP(S) resources, CDN
 * libraries, and relative resources resolved by a remote <base> stay online.
 * Local image sidecars are packaged before this policy runs. A single browser
 * file upload cannot expose sibling bytes, so relative images require folder
 * import; MCP may resolve them through htmlAssetRoot.
 */
export function assertSandboxedHtml(source: string, options: HtmlImportPolicyOptions = {}) {
  if (!/^\s*(?:<!doctype\s+html\b[^>]*>\s*)?<html\b/i.test(source)) {
    throw badRequest("The HTML import must contain a complete <html> document.");
  }
  const network = inspectHtmlNetworkResources(source, options);
  if (network.requiresNetwork) {
    throw badRequest(
      "Remote HTML resources are disabled for local security. Package required images and scripts with the presentation instead."
    );
  }
}

/** Produces a static offline copy that is safe to open outside the Workbench sandbox. */
export function secureHtmlForStandaloneExport(source: string, options: HtmlImportPolicyOptions = {}) {
  assertSandboxedHtml(source, options);
  const decoded = decodeHtmlAttributeValue(source);
  if (/<script\b/i.test(decoded) || /\son[a-z][a-z\d:_-]*\s*=/i.test(decoded)) {
    throw badRequest("Standalone HTML export is limited to static HTML; scripts and event handlers are not allowed.");
  }
  const decodedTags = scanHtmlDocument(decoded).tags;
  if (decodedTags.some((tag) => ["base", "embed", "form", "frame", "iframe", "object"].includes(tag.name))
    || decodedTags.some((tag) => tag.name === "meta" && htmlAttributeToken(tag, "http-equiv")?.value.toLowerCase() === "refresh")) {
    throw badRequest("Standalone HTML export cannot contain navigation, forms, frames, objects, or refresh directives.");
  }
  for (const tag of decodedTags.filter((candidate) => candidate.name === "a" || candidate.name === "area")) {
    const href = (htmlAttributeToken(tag, "href")?.value ?? "").trim();
    if (href && !href.startsWith("#")) {
      throw badRequest("Standalone HTML export permits only in-document navigation links.");
    }
  }
  const policy = [
    "default-src 'none'",
    "base-uri 'none'",
    "connect-src 'none'",
    "font-src 'self' data:",
    "form-action 'none'",
    "frame-src 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "script-src 'none'",
    "style-src 'self' 'unsafe-inline' data:",
    "worker-src 'none'"
  ].join("; ");
  const meta = `<meta data-open-slidex-offline-export http-equiv="Content-Security-Policy" content="${policy}">`;
  if (/<head\b[^>]*>/i.test(source)) return source.replace(/<head\b[^>]*>/i, (head) => `${head}${meta}`);
  return source.replace(/<html\b[^>]*>/i, (html) => `${html}<head>${meta}</head>`);
}

/** Returns the online dependency boundary without changing canonical HTML. */
export function inspectHtmlNetworkResources(source: string, options: HtmlImportPolicyOptions = {}): HtmlNetworkResourceSummary {
  const inspected = scanHtmlDocument(source);
  const base = remoteBaseUrl(inspected.tags);
  const localAssets = new Set(options.localAssets ?? []);
  const networkUrls: URL[] = [];
  for (const reference of htmlResourceReferences(source, inspected)) {
    const resolved = networkResourceUrl(reference, base, localAssets);
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
 * rendering source; these records only map its pages into presentation.tsx.
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
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'self' data: blob:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'none'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'self' 'unsafe-inline' data: blob:",
  "worker-src 'none'"
].join("; ");

function htmlResourceReferences(source: string, inspected = scanHtmlDocument(source)) {
  const references: string[] = [];
  for (const tag of inspected.tags) {
    for (const attribute of tag.attributes) {
      if (
        attribute.name === "src"
        || attribute.name === "poster"
        || attribute.name === "background"
        || attribute.name === "href"
        || attribute.name === "xlink:href"
        || (tag.name === "object" && attribute.name === "data")
      ) references.push(decodeHtmlAttributeValue(attribute.value));
      else if (attribute.name === "srcset") references.push(...srcsetReferences(decodeHtmlAttributeValue(attribute.value)));
      else if (attribute.name === "style") references.push(...cssResourceReferences(decodeHtmlAttributeValue(attribute.value)));
    }
  }
  for (const block of inspected.rawText.filter((token) => token.name === "style")) {
    references.push(...cssResourceReferences(source.slice(block.from, block.to)));
  }
  return references.map((value) => value.trim()).filter(Boolean);
}

function cssResourceReferences(source: string) {
  const imports = [...source.matchAll(/@import\s+(["'])([^"']*)\1/gi)].map((match) => match[2] ?? "");
  return [...imports, ...scanCssUrls(source).map((token) => token.value)];
}

function srcsetReferences(value: string) {
  return value
    .split(/\s*,\s*(?=(?:https?:|data:|blob:|\/\/|\.{0,2}\/|#))/i)
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? "")
    .filter(Boolean);
}

function remoteBaseUrl(tags: HtmlTagToken[]) {
  const base = tags.find((tag) => tag.name === "base");
  const value = decodeHtmlAttributeValue(base ? htmlAttributeToken(base, "href")?.value ?? "" : "").trim();
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

function networkResourceUrl(value: string, base?: URL, localAssets = new Set<string>()): URL | undefined {
  const reference = value.trim();
  if (!reference || reference.startsWith("#")) return undefined;
  if (/^(?:data:|blob:|about:blank(?:#.*)?$)/i.test(reference)) return undefined;
  if (localAssets.has(reference)) return undefined;

  let resolved: URL;
  try {
    if (reference.startsWith("//")) resolved = new URL(`https:${reference}`);
    else if (/^https?:/i.test(reference)) resolved = new URL(reference);
    else if (base && !hasProtocol(reference)) resolved = new URL(reference, base);
    else {
      throw badRequest(
        `The HTML import references a relative or unsupported resource (${summarizeReference(reference)}). ` +
        "Choose the complete HTML presentation folder to package local images, or pass htmlAssetRoot through MCP. " +
        "Remote resources may use an absolute HTTP(S) URL or a remote <base href>."
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
