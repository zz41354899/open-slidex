import { createHash } from "node:crypto";
import path from "node:path";

import { analyzeHtmlPresentation, assertSandboxedHtml } from "./htmlImportPolicy";
import { assertSafeMotionDocSvg } from "@/core/motion-doc/domain/svgPolicy";

const MAX_WORKSPACE_MDX_BYTES = 2 * 1024 * 1024;
export const MAX_WORKSPACE_IMPORT_FILE_BYTES = 50 * 1024 * 1024;

export type WorkspaceImportAsset = {
  bytes: Uint8Array;
  fileName: string;
  mediaType?: string;
  source: string;
};

export type WorkspaceImportPayload = {
  assets: WorkspaceImportAsset[];
  html?: { bytes: Uint8Array; fileName: string; source: string };
  kind: "html" | "mdx";
  source: string;
};

export type ResolveWorkspaceImportAsset = (source: string) => Promise<WorkspaceImportAsset | undefined>;

export async function readWorkspaceImport(
  file: File,
  referencedSources: (source: string) => string[],
  resolveWorkspaceAsset?: ResolveWorkspaceImportAsset
): Promise<WorkspaceImportPayload> {
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".mdx") {
    const embedded = extractEmbeddedImageAssets(await readMdxFile(file));
    assertCanonicalMdxSize(embedded.source);
    const embeddedSources = new Set(embedded.assets.map((asset) => asset.source));
    const missingReferences = unique(referencedSources(embedded.source))
      .filter((source) => !embeddedSources.has(source));
    const recoveredAssets = await Promise.all(missingReferences.map((source) => resolveWorkspaceAsset?.(source)));
    const unresolvedReferences = missingReferences.filter((_, index) => !recoveredAssets[index]);
    return {
      assets: [...embedded.assets, ...recoveredAssets.filter((asset): asset is WorkspaceImportAsset => Boolean(asset))],
      kind: "mdx",
      source: stripUnavailableAssetReferences(embedded.source, unresolvedReferences)
    };
  }
  if (extension !== ".html") {
    throw badRequest("Import an .mdx or .html file.");
  }
  if (!file.size || file.size > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
    throw badRequest("The HTML import must be between 1 byte and 50 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let html: string;
  try {
    html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw badRequest("The HTML import must use UTF-8 encoding.");
  }
  assertSandboxedHtml(html);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const fileName = `source-${hash}.html`;
  const assetSource = `assets/${fileName}`;
  const title = file.name.replace(/\.html$/i, "").trim() || "Imported HTML";
  const pages = analyzeHtmlPresentation(html);
  return {
    assets: [],
    html: { bytes, fileName, source: assetSource },
    kind: "html",
    source: createHtmlPresentationMdx(title, assetSource, hash, pages)
  };
}

export function createHtmlPresentationMdx(
  title: string,
  assetSource: string,
  hash: string,
  pages: ReturnType<typeof analyzeHtmlPresentation>
) {
  if (pages.length < 2) {
    return `# ${escapeMdxText(title)}\n\n<Slide duration={5}>\n  <HtmlEmbedBlock id="html-embed-${hash}" src="${assetSource}" page={1} x={0} y={0} w={100} h={100} />\n</Slide>\n`;
  }
  const sharedScene = `html-${hash}`;
  const slides = pages.map((record, index) => (
    `<Slide duration={5} slideTransition="none">\n` +
    `  <HtmlEmbedBlock id="html-embed-${hash}-${index + 1}" src="${assetSource}" sharedScene="${sharedScene}" page={${record.page}} x={0} y={0} w={100} h={100} />\n` +
    `</Slide>`
  ));
  return `# ${escapeMdxText(title)}\n\n${slides.join("\n\n")}\n`;
}

async function readMdxFile(file: File) {
  if (!file.size || file.size > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
    throw badRequest("The MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
  }
  const source = await file.text();
  if (!source || Buffer.byteLength(source, "utf8") > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
    throw badRequest("The MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
  }
  return source;
}

export function extractEmbeddedImageAssets(source: string) {
  const assets = new Map<string, WorkspaceImportAsset>();
  const store = (prop: string, rawSubtype: string, payload: string) => {
    const subtype = rawSubtype.toLowerCase() === "jpg" ? "jpeg" : rawSubtype.toLowerCase();
    const normalizedPayload = payload.replace(/\s+/g, "");
    const bytes = decodeBase64(normalizedPayload, 25 * 1024 * 1024, "image");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const extension = subtype === "jpeg" ? "jpg" : subtype;
    const assetSource = `assets/embedded-${hash}.${extension}`;
    if (!assets.has(assetSource)) {
      assets.set(assetSource, {
        bytes,
        fileName: `embedded-${hash}.${extension}`,
        mediaType: `image/${subtype}`,
        source: assetSource
      });
    }
    return `${prop}="${assetSource}"`;
  };
  const storeSvg = (prop: string, payload: string) => {
    const normalizedPayload = payload.replace(/\s+/g, "");
    const bytes = decodeBase64(normalizedPayload, 10 * 1024 * 1024, "SVG");
    let svg: string;
    try { svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest("An embedded SVG must use UTF-8 encoding."); }
    try { assertSafeMotionDocSvg(svg); } catch (error) { throw badRequest(error instanceof Error ? error.message : "The embedded SVG is unsafe."); }
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const assetSource = `assets/embedded-${hash}.svg`;
    if (!assets.has(assetSource)) assets.set(assetSource, { bytes, fileName: `embedded-${hash}.svg`, mediaType: "image/svg+xml", source: assetSource });
    return `${prop}="${assetSource}"`;
  };
  const storeHtml = (prop: string, payload: string) => {
    const normalizedPayload = payload.replace(/\s+/g, "");
    const bytes = decodeBase64(normalizedPayload, MAX_WORKSPACE_IMPORT_FILE_BYTES, "HTML source");
    let html: string;
    try { html = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest("An embedded HTML source must use UTF-8 encoding."); }
    assertSandboxedHtml(html);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const assetSource = `assets/embedded-${hash}.html`;
    if (!assets.has(assetSource)) assets.set(assetSource, { bytes, fileName: `embedded-${hash}.html`, mediaType: "text/html", source: assetSource });
    return `${prop}="${assetSource}"`;
  };
  const expressionLiteralPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*\{\s*(["'`])data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\2\s*\}/gi;
  const directLiteralPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*(["'])data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\2/gi;
  const rawExpressionPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*\{\s*data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\s*\}/gi;
  const svgExpressionLiteralPattern = /\b(src)\s*=\s*\{\s*(["'`])data:image\/svg\+xml;base64,([A-Za-z0-9+/=\r\n\t ]+)\2\s*\}/gi;
  const svgDirectLiteralPattern = /\b(src)\s*=\s*(["'])data:image\/svg\+xml;base64,([A-Za-z0-9+/=\r\n\t ]+)\2/gi;
  const htmlExpressionLiteralPattern = /\b(src)\s*=\s*\{\s*(["'`])data:text\/html(?:;charset=utf-8)?;base64,([A-Za-z0-9+/=\r\n\t ]+)\2\s*\}/gi;
  const htmlDirectLiteralPattern = /\b(src)\s*=\s*(["'])data:text\/html(?:;charset=utf-8)?;base64,([A-Za-z0-9+/=\r\n\t ]+)\2/gi;
  const rewritten = source
    .replace(htmlExpressionLiteralPattern, (_attribute, prop: string, _quote: string, payload: string) => storeHtml(prop, payload))
    .replace(htmlDirectLiteralPattern, (_attribute, prop: string, _quote: string, payload: string) => storeHtml(prop, payload))
    .replace(svgExpressionLiteralPattern, (_attribute, prop: string, _quote: string, payload: string) => storeSvg(prop, payload))
    .replace(svgDirectLiteralPattern, (_attribute, prop: string, _quote: string, payload: string) => storeSvg(prop, payload))
    .replace(expressionLiteralPattern, (_attribute, prop: string, _quote: string, subtype: string, payload: string) => store(prop, subtype, payload))
    .replace(directLiteralPattern, (_attribute, prop: string, _quote: string, subtype: string, payload: string) => store(prop, subtype, payload))
    .replace(rawExpressionPattern, (_attribute, prop: string, subtype: string, payload: string) => store(prop, subtype, payload));
  return { assets: [...assets.values()], source: rewritten };
}

function decodeBase64(payload: string, maxBytes: number, label: string) {
  if (
    !payload ||
    payload.length > Math.ceil(maxBytes / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)
  ) {
    throw badRequest(`An embedded ${label} contains invalid or oversized Base64 data.`);
  }
  const bytes = new Uint8Array(Buffer.from(payload, "base64"));
  if (bytes.byteLength > maxBytes) throw badRequest(`An embedded ${label} exceeds ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  return bytes;
}

function assertCanonicalMdxSize(source: string) {
  if (!source || Buffer.byteLength(source, "utf8") > MAX_WORKSPACE_MDX_BYTES) {
    throw badRequest("presentation.mdx must not exceed 2 MB after embedded images are extracted.");
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function escapeMdxText(value: string) {
  return value.replace(/[{}]/g, (character) => character === "{" ? "&#123;" : "&#125;").replace(/[\r\n]+/g, " ");
}

/**
 * Browsers do not expose files beside a selected standalone MDX. Preserve the
 * slide and media frame, but remove only unavailable local media attributes so
 * the deck can still be imported and the existing editor placeholder is shown.
 */
function stripUnavailableAssetReferences(source: string, references: string[]) {
  let nextSource = source;
  for (const reference of unique(references)) {
    // Keep the lightweight HTML manifest intact even when a standalone MDX is
    // moved without its sibling asset. The dedicated HTML workspace can then
    // report the missing file without falling back to the heavy native Canvas.
    if (/\.html?$/i.test(reference)) continue;
    const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prop = "(?:src|poster|backgroundImage|shapeImageSrc)";
    const expression = new RegExp(`\\s+\\b${prop}\\s*=\\s*\\{\\s*([\"'])${escaped}\\1\\s*\\}`, "g");
    const literal = new RegExp(`\\s+\\b${prop}\\s*=\\s*([\"'])${escaped}\\1`, "g");
    nextSource = nextSource.replace(expression, "").replace(literal, "");
  }
  return nextSource;
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
