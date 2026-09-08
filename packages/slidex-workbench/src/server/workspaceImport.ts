import { createHash } from "node:crypto";
import { lstat, readFile as readLocalFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { analyzeHtmlPresentation, assertSandboxedHtml } from "./htmlImportPolicy";
import { htmlAttributeToken, scanCssUrls, scanHtmlDocument } from "./htmlScanner";
import { assertSafeMotionDocSvg } from "@/core/motion-doc/domain/svgPolicy";

const MAX_WORKSPACE_MDX_BYTES = 2 * 1024 * 1024;
export const MAX_WORKSPACE_IMPORT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_HTML_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_HTML_IMAGE_PIXELS = 40_000_000;

export type WorkspaceImportAsset = {
  bytes: Uint8Array;
  fileName: string;
  mediaType?: string;
  preserveOriginal?: boolean;
  source: string;
};

export type WorkspaceHtmlSidecar = {
  file: File;
  path: string;
};

export type PackageHtmlAssetsOptions = {
  /** Absolute folder used to resolve relative image references, primarily for MCP. */
  assetRoot?: string;
  htmlSidecars?: WorkspaceHtmlSidecar[];
};

export type WorkspaceImportPayload = {
  assets: WorkspaceImportAsset[];
  html?: { bytes: Uint8Array; fileName: string; source: string };
  kind: "html" | "mdx" | "tsx";
  source: string;
};

export type ResolveWorkspaceImportAsset = (source: string) => Promise<WorkspaceImportAsset | undefined>;

export async function readWorkspaceImport(
  file: File,
  referencedSources: (source: string) => string[],
  resolveWorkspaceAsset?: ResolveWorkspaceImportAsset,
  options: { htmlSidecars?: WorkspaceHtmlSidecar[]; mdxSidecars?: WorkspaceHtmlSidecar[] } = {}
): Promise<WorkspaceImportPayload> {
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".mdx" || extension === ".tsx") {
    const embedded = extractEmbeddedImageAssets(await readMdxFile(file));
    assertCanonicalMdxSize(embedded.source);
    const references = unique(referencedSources(embedded.source));
    const sidecarAssets = await packageMdxAssets(references, options.mdxSidecars ?? []);
    const embeddedSources = new Set([...embedded.assets, ...sidecarAssets].map((asset) => asset.source));
    const missingReferences = references.filter((source) => !embeddedSources.has(source));
    const recoveredAssets = await Promise.all(missingReferences.map((source) => resolveWorkspaceAsset?.(source)));
    const unresolvedReferences = missingReferences.filter((_, index) => !recoveredAssets[index]);
    return {
      assets: [...embedded.assets, ...sidecarAssets, ...recoveredAssets.filter((asset): asset is WorkspaceImportAsset => Boolean(asset))],
      kind: extension === ".tsx" ? "tsx" : "mdx",
      source: stripUnavailableAssetReferences(embedded.source, unresolvedReferences)
    };
  }
  if (extension !== ".html") {
    throw badRequest("Import a .tsx, .mdx, or .html file.");
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
  const packaged = await packageHtmlAssets(html, { htmlSidecars: options.htmlSidecars });
  assertSandboxedHtml(packaged.source, { localAssets: packaged.assets.map((asset) => asset.fileName) });
  const packagedBytes = new TextEncoder().encode(packaged.source);
  const hash = createHash("sha256").update(packagedBytes).digest("hex").slice(0, 16);
  const fileName = `source-${hash}.html`;
  const assetSource = `assets/${fileName}`;
  const title = file.name.replace(/\.html$/i, "").trim() || "Imported HTML";
  const pages = analyzeHtmlPresentation(packaged.source);
  return {
    assets: packaged.assets,
    html: { bytes: packagedBytes, fileName, source: assetSource },
    kind: "html",
    source: createHtmlPresentationMdx(title, assetSource, hash, pages)
  };
}

async function packageMdxAssets(references: string[], sidecars: WorkspaceHtmlSidecar[]) {
  if (!references.length || !sidecars.length) return [];
  const sidecarsByReference = new Map<string, File>();
  for (const sidecar of sidecars) {
    const reference = normalizeSidecarReference(sidecar.path);
    if (sidecarsByReference.has(reference)) throw badRequest(`The MDX import includes the sidecar more than once: ${reference}`);
    sidecarsByReference.set(reference, sidecar.file);
  }

  const assets: WorkspaceImportAsset[] = [];
  for (const source of references) {
    const file = sidecarsByReference.get(normalizeSidecarReference(source));
    if (!file) continue;
    const extension = path.posix.extname(source).toLowerCase();
    const maximumBytes = extension === ".mp4" ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
    if (!file.size || file.size > maximumBytes) {
      throw badRequest(`MDX sidecar ${source} must be between 1 byte and ${Math.floor(maximumBytes / 1024 / 1024)} MB.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (extension === ".svg") {
      let svg: string;
      try { svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest(`MDX SVG sidecar must use UTF-8: ${source}`); }
      try { assertSafeMotionDocSvg(svg); } catch (error) { throw badRequest(error instanceof Error ? error.message : `MDX SVG sidecar is unsafe: ${source}`); }
      assets.push({ bytes, fileName: path.posix.basename(source), mediaType: "image/svg+xml", preserveOriginal: true, source });
      continue;
    }
    if (extension === ".html" || extension === ".htm") {
      let html: string;
      try { html = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest(`MDX HTML sidecar must use UTF-8: ${source}`); }
      assertSandboxedHtml(html);
      assets.push({ bytes, fileName: path.posix.basename(source), mediaType: "text/html", preserveOriginal: true, source });
      continue;
    }
    if (extension === ".mp4") {
      if (bytes.byteLength < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") {
        throw badRequest(`MDX video sidecar is not a valid MP4 file: ${source}`);
      }
      assets.push({ bytes, fileName: path.posix.basename(source), mediaType: "video/mp4", source });
      continue;
    }
    const mediaType = htmlSidecarMimeType(extension);
    if (!mediaType || mediaType === "image/svg+xml") {
      throw badRequest(`MDX sidecars must be raster images, SVG, MP4, or HTML files: ${source}`);
    }
    assets.push({ bytes, fileName: path.posix.basename(source), mediaType, source });
  }
  return assets;
}

export async function packageHtmlAssets(source: string, options: PackageHtmlAssetsOptions = {}) {
  const sidecars = options.htmlSidecars ?? [];
  const assetsByReference = new Map<string, WorkspaceImportAsset>();
  for (const sidecar of sidecars) {
    const reference = normalizeSidecarReference(sidecar.path);
    if (assetsByReference.has(reference)) throw badRequest(`The HTML import includes the sidecar more than once: ${reference}`);
    if (!sidecar.file.size || sidecar.file.size > MAX_HTML_IMAGE_BYTES) {
      throw badRequest(`HTML sidecar ${reference} must be between 1 byte and 25 MB.`);
    }
    const extension = localImageExtension(reference);
    if (!extension) {
      throw badRequest(`HTML sidecars must be raster images or SVG files: ${reference}`);
    }
    assetsByReference.set(reference, await packageHtmlImage(
      new Uint8Array(await sidecar.file.arrayBuffer()),
      extension,
      reference
    ));
  }

  for (const reference of htmlLocalImageReferences(source)) {
    const normalized = normalizeHtmlReference(reference);
    if (assetsByReference.has(normalized)) continue;
    const localPath = await resolveHtmlLocalImagePath(reference, options.assetRoot);
    if (!localPath) continue;
    const file = await stat(localPath).catch(() => undefined);
    if (!file?.isFile() || !file.size || file.size > MAX_HTML_IMAGE_BYTES) {
      throw badRequest(`HTML image ${reference} must be a readable file between 1 byte and 25 MB.`);
    }
    const extension = localImageExtension(localPath);
    if (!extension) continue;
    assetsByReference.set(normalized, await packageHtmlImage(
      new Uint8Array(await readLocalFile(localPath)),
      extension,
      reference
    ));
  }

  const replacements = new Map([...assetsByReference].map(([reference, asset]) => [reference, asset.fileName]));
  return {
    assets: [...assetsByReference.values()],
    source: rewriteHtmlSidecarReferences(source, replacements)
  };
}

async function packageHtmlImage(bytes: Uint8Array, extension: string, reference: string): Promise<WorkspaceImportAsset> {
  let outputBytes = bytes;
  let outputExtension = extension === ".jpeg" ? ".jpg" : extension;
  if (extension === ".png") {
    try {
      const metadata = await sharp(bytes, {
        animated: true,
        failOn: "error",
        limitInputPixels: MAX_HTML_IMAGE_PIXELS
      }).metadata();
      if (
        metadata.format !== "png"
        || !metadata.width
        || !metadata.height
        || metadata.width * metadata.height > MAX_HTML_IMAGE_PIXELS
        || (metadata.pages ?? 1) !== 1
      ) {
        throw new Error("Invalid PNG dimensions or format.");
      }
      outputBytes = new Uint8Array(await sharp(bytes, {
        failOn: "error",
        limitInputPixels: MAX_HTML_IMAGE_PIXELS
      })
        .rotate()
        .webp({ alphaQuality: 100, effort: 4, quality: 90 })
        .toBuffer());
      if (outputBytes.byteLength > MAX_HTML_IMAGE_BYTES) {
        throw new Error("Converted PNG exceeds the HTML image byte budget.");
      }
      outputExtension = ".webp";
    } catch {
      throw badRequest(`HTML PNG image could not be converted to WebP: ${reference}`);
    }
  } else if (extension === ".svg") {
    let svg: string;
    try { svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest(`HTML SVG sidecar must use UTF-8: ${reference}`); }
    try { assertSafeMotionDocSvg(svg); } catch (error) { throw badRequest(error instanceof Error ? error.message : `HTML SVG sidecar is unsafe: ${reference}`); }
  } else {
    let format: string | undefined;
    try {
      format = (await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).metadata()).format;
    } catch {
      throw badRequest(`HTML image bytes do not match a supported raster image: ${reference}`);
    }
    const expected = extension === ".jpg" || extension === ".jpeg" ? "jpeg" : extension.slice(1);
    if (format !== expected) {
      throw badRequest(`HTML image bytes do not match the ${extension} extension: ${reference}`);
    }
  }
  const hash = createHash("sha256").update(outputBytes).digest("hex").slice(0, 16);
  const fileName = `html-asset-${hash}${outputExtension}`;
  return {
    bytes: outputBytes,
    fileName,
    mediaType: htmlSidecarMimeType(outputExtension),
    preserveOriginal: true,
    source: `assets/${fileName}`
  };
}

function htmlLocalImageReferences(source: string) {
  const values: string[] = [];
  const inspected = scanHtmlDocument(source);
  for (const tag of inspected.tags) {
    for (const attribute of tag.attributes) {
      if (["src", "poster", "data", "background", "href", "xlink:href"].includes(attribute.name)) {
        values.push(attribute.value);
      } else if (attribute.name === "srcset") {
        values.push(...attribute.value.split(",").map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? ""));
      } else if (attribute.name === "style") {
        values.push(...scanCssUrls(attribute.value).map((token) => token.value));
      }
    }
  }
  for (const block of inspected.rawText.filter((token) => token.name === "style")) {
    values.push(...scanCssUrls(source.slice(block.from, block.to)).map((token) => token.value));
  }
  return unique(values.map((value) => decodeHtmlReference(value).trim()))
    .filter((value) => localImageExtension(value));
}

async function resolveHtmlLocalImagePath(reference: string, assetRoot?: string) {
  const encodedValue = decodeHtmlReference(reference).trim().split(/[?#]/, 1)[0] ?? "";
  let value = encodedValue;
  try { value = decodeURIComponent(encodedValue); } catch { /* Keep literal filesystem characters. */ }
  if (!value || /^(?:https?:|data:|blob:|about:|\/\/)/i.test(value)) return undefined;
  if (/^file:/i.test(value)) {
    throw badRequest(`HTML image file URLs are not allowed: ${reference}`);
  }
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw badRequest(`HTML image absolute paths are not allowed: ${reference}`);
  }
  if (!assetRoot) return undefined;
  const requestedRoot = path.resolve(assetRoot);
  const rootStats = await lstat(requestedRoot).catch(() => undefined);
  if (!rootStats?.isDirectory() || rootStats.isSymbolicLink()) {
    throw badRequest(`The HTML asset root must be a real directory: ${assetRoot}`);
  }
  const root = await realpath(requestedRoot).catch(() => undefined);
  if (!root) throw badRequest(`The HTML asset root does not exist: ${assetRoot}`);
  const candidate = path.resolve(root, value.replace(/\\/g, path.sep));
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw badRequest(`The HTML image escapes its asset root: ${reference}`);
  }
  const candidateStats = await lstat(candidate).catch(() => undefined);
  if (!candidateStats?.isFile() || candidateStats.isSymbolicLink()) {
    throw badRequest(`The HTML image must be a regular non-symlink file: ${reference}`);
  }
  const canonical = await realpath(candidate);
  const canonicalRelative = path.relative(root, canonical);
  if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
    throw badRequest(`The HTML image escapes its asset root through a symbolic link: ${reference}`);
  }
  return canonical;
}

function localImageExtension(value: string) {
  const pathname = value.replace(/[?#].*$/, "");
  const extension = path.extname(pathname).toLowerCase();
  return /^(?:\.avif|\.gif|\.jpe?g|\.png|\.webp|\.svg)$/.test(extension) ? extension : undefined;
}

function decodeHtmlReference(value: string) {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|apos|gt|lt|quot));/gi, (reference, decimal, hexadecimal, named) => {
    if (decimal || hexadecimal) return String.fromCodePoint(Number.parseInt(decimal ?? hexadecimal, decimal ? 10 : 16));
    return { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' }[String(named).toLowerCase()] ?? reference;
  });
}

function normalizeSidecarReference(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw badRequest("HTML sidecar paths must stay within the selected presentation folder.");
  }
  return normalized;
}

function htmlSidecarMimeType(extension: string) {
  return {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  }[extension];
}

function rewriteHtmlSidecarReferences(source: string, replacements: Map<string, string>) {
  if (!replacements.size) return source;
  const inspected = scanHtmlDocument(source);
  const baseTag = inspected.tags.find((tag) => tag.name === "base");
  const baseValue = decodeHtmlReference(baseTag ? htmlAttributeToken(baseTag, "href")?.value ?? "" : "").trim();
  const remoteBase = /^https?:/i.test(baseValue) ? new URL(baseValue) : undefined;
  const replace = (value: string) => {
    const packaged = replacements.get(normalizeHtmlReference(value));
    if (packaged) return packaged;
    if (!remoteBase || !value || value.startsWith("#") || /^(?:[A-Za-z][A-Za-z\d+.-]*:|\/\/)/.test(value)) return value;
    try { return new URL(value, remoteBase).href; } catch { return value; }
  };
  const edits: Array<{ from: number; to: number; value: string }> = [];
  const editCss = (css: string, offset: number) => {
    for (const token of scanCssUrls(css, offset)) {
      const next = replace(token.value);
      if (next !== token.value) edits.push({ from: token.from, to: token.to, value: next });
    }
  };
  for (const tag of inspected.tags) {
    for (const attribute of tag.attributes) {
      if (["src", "poster", "data", "background", "href", "xlink:href"].includes(attribute.name)) {
        const next = replace(attribute.value);
        if (next !== attribute.value) edits.push({ from: attribute.valueFrom, to: attribute.valueTo, value: next });
      } else if (attribute.name === "srcset") {
        const next = attribute.value.split(",").map((candidate) => {
          const [reference, ...descriptor] = candidate.trim().split(/\s+/);
          return [replace(reference ?? ""), ...descriptor].join(" ");
        }).join(", ");
        if (next !== attribute.value) edits.push({ from: attribute.valueFrom, to: attribute.valueTo, value: next });
      } else if (attribute.name === "style") {
        editCss(attribute.value, attribute.valueFrom);
      }
    }
  }
  for (const block of inspected.rawText.filter((token) => token.name === "style")) {
    editCss(source.slice(block.from, block.to), block.from);
  }
  // A remote base would redirect packaged filenames away from the local deck.
  // Static relative resources were expanded above, so remove it only when a
  // local sidecar has actually been made portable.
  if (remoteBase && baseTag) edits.push({ from: baseTag.from, to: baseTag.to, value: "" });
  return applyHtmlEdits(source, edits);
}

function applyHtmlEdits(source: string, edits: Array<{ from: number; to: number; value: string }>) {
  let cursor = 0;
  let output = "";
  for (const edit of edits.sort((left, right) => left.from - right.from || left.to - right.to)) {
    if (edit.from < cursor) continue;
    output += source.slice(cursor, edit.from) + edit.value;
    cursor = edit.to;
  }
  return output + source.slice(cursor);
}

function normalizeHtmlReference(value: string) {
  const normalized = decodeHtmlReference(value).trim().replace(/^\.\//, "").replace(/\\/g, "/");
  try { return decodeURIComponent(normalized); } catch { return normalized; }
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
    throw badRequest("The TSX or MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
  }
  const source = await file.text();
  if (!source || Buffer.byteLength(source, "utf8") > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
    throw badRequest("The TSX or MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
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
    throw badRequest("The canonical presentation source must not exceed 2 MB after embedded images are extracted.");
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
