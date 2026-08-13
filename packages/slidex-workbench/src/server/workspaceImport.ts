import { createHash } from "node:crypto";
import path from "node:path";

import JSZip, { type JSZipObject } from "jszip";

const MAX_WORKSPACE_MDX_BYTES = 2 * 1024 * 1024;
const MAX_WORKSPACE_MDX_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_WORKSPACE_BUNDLE_BYTES = 50 * 1024 * 1024;
const MAX_WORKSPACE_BUNDLE_ENTRIES = 512;
const MAX_WORKSPACE_BUNDLE_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export type WorkspaceImportAsset = {
  bytes: Uint8Array;
  fileName: string;
  mediaType?: string;
  source: string;
};

export type WorkspaceImportPayload = {
  assets: WorkspaceImportAsset[];
  kind: "bundle" | "mdx";
  source: string;
};

export async function readWorkspaceImport(
  file: File,
  referencedSources: (source: string) => string[]
): Promise<WorkspaceImportPayload> {
  const extension = path.extname(file.name).toLowerCase();
  if (extension === ".mdx") {
    const embedded = extractEmbeddedImageAssets(await readMdxFile(file));
    assertCanonicalMdxSize(embedded.source);
    const embeddedSources = new Set(embedded.assets.map((asset) => asset.source));
    const missingReferences = unique(referencedSources(embedded.source))
      .filter((source) => !embeddedSources.has(source));
    if (missingReferences.length > 0) {
      throw badRequest(
        `This MDX references ${missingReferences.length} local asset${missingReferences.length === 1 ? "" : "s"}. Import a .zip or .slidex bundle containing presentation.mdx and its assets folder.`
      );
    }
    return { assets: embedded.assets, kind: "mdx", source: embedded.source };
  }

  if (extension !== ".zip" && extension !== ".slidex") {
    throw badRequest("Import a .mdx file or a .zip/.slidex OpenSlideX project bundle.");
  }
  if (!file.size || file.size > MAX_WORKSPACE_BUNDLE_BYTES) {
    throw badRequest("The OpenSlideX project bundle must be between 1 byte and 50 MB.");
  }

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(await file.arrayBuffer(), { createFolders: false });
  } catch {
    throw badRequest("The OpenSlideX project bundle is not a valid ZIP archive.");
  }

  const entries = Object.values(archive.files);
  if (entries.length > MAX_WORKSPACE_BUNDLE_ENTRIES) {
    throw badRequest(`The OpenSlideX project bundle contains more than ${MAX_WORKSPACE_BUNDLE_ENTRIES} entries.`);
  }
  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    assertSafeArchiveEntry(entry);
    totalUncompressedBytes += uncompressedSize(entry);
    if (totalUncompressedBytes > MAX_WORKSPACE_BUNDLE_UNCOMPRESSED_BYTES) {
      throw badRequest("The expanded OpenSlideX project bundle exceeds 100 MB.");
    }
  }

  const presentationEntries = entries.filter((entry) => !entry.dir && /(?:^|\/)presentation\.mdx$/i.test(entry.name));
  if (presentationEntries.length !== 1) {
    throw badRequest("The OpenSlideX project bundle must contain exactly one presentation.mdx file.");
  }
  const presentationEntry = presentationEntries[0]!;
  if (uncompressedSize(presentationEntry) > MAX_WORKSPACE_MDX_IMPORT_BYTES) {
    throw badRequest("The bundled presentation.mdx must not exceed 50 MB before embedded images are extracted.");
  }
  const rawSource = await presentationEntry.async("string");
  if (!rawSource) {
    throw badRequest("presentation.mdx must be between 1 byte and 2 MB.");
  }
  const embedded = extractEmbeddedImageAssets(rawSource);
  const source = embedded.source;
  assertCanonicalMdxSize(source);

  const prefix = presentationEntry.name.slice(0, -"presentation.mdx".length);
  const references = unique(referencedSources(source));
  const assets: WorkspaceImportAsset[] = [...embedded.assets];
  const embeddedSources = new Set(embedded.assets.map((asset) => asset.source));
  for (const sourcePath of references) {
    if (embeddedSources.has(sourcePath)) continue;
    const entryPath = `${prefix}${sourcePath}`;
    const entry = archive.file(entryPath);
    if (!entry || entry.dir) {
      throw badRequest(`The project bundle is missing referenced asset: ${sourcePath}`);
    }
    if (uncompressedSize(entry) > 25 * 1024 * 1024) {
      throw badRequest(`The referenced asset exceeds 25 MB: ${sourcePath}`);
    }
    const bytes = await entry.async("uint8array");
    if (bytes.byteLength > 25 * 1024 * 1024) {
      throw badRequest(`The referenced asset exceeds 25 MB: ${sourcePath}`);
    }
    assets.push({
      bytes,
      fileName: path.posix.basename(sourcePath),
      source: sourcePath
    });
  }

  return { assets, kind: "bundle", source };
}

async function readMdxFile(file: File) {
  if (!file.size || file.size > MAX_WORKSPACE_MDX_IMPORT_BYTES) {
    throw badRequest("The MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
  }
  const source = await file.text();
  if (!source || Buffer.byteLength(source, "utf8") > MAX_WORKSPACE_MDX_IMPORT_BYTES) {
    throw badRequest("The MDX import must be between 1 byte and 50 MB. Embedded Base64 images are extracted during import.");
  }
  return source;
}

export function extractEmbeddedImageAssets(source: string) {
  const assets = new Map<string, WorkspaceImportAsset>();
  const store = (prop: string, rawSubtype: string, payload: string) => {
    const subtype = rawSubtype.toLowerCase() === "jpg" ? "jpeg" : rawSubtype.toLowerCase();
    const normalizedPayload = payload.replace(/\s+/g, "");
    const bytes = decodeBase64Image(normalizedPayload);
    if (bytes.byteLength > 25 * 1024 * 1024) {
      throw badRequest("An embedded Base64 image exceeds 25 MB.");
    }
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
  const expressionLiteralPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*\{\s*(["'`])data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\2\s*\}/gi;
  const directLiteralPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*(["'])data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\2/gi;
  const rawExpressionPattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*\{\s*data:image\/(avif|gif|jpe?g|png|webp);base64,([A-Za-z0-9+/=\r\n\t ]+)\s*\}/gi;
  const rewritten = source
    .replace(expressionLiteralPattern, (_attribute, prop: string, _quote: string, subtype: string, payload: string) => store(prop, subtype, payload))
    .replace(directLiteralPattern, (_attribute, prop: string, _quote: string, subtype: string, payload: string) => store(prop, subtype, payload))
    .replace(rawExpressionPattern, (_attribute, prop: string, subtype: string, payload: string) => store(prop, subtype, payload));
  return { assets: [...assets.values()], source: rewritten };
}

function decodeBase64Image(payload: string) {
  if (
    !payload ||
    payload.length > Math.ceil(25 * 1024 * 1024 / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)
  ) {
    throw badRequest("An embedded image contains invalid Base64 data.");
  }
  return new Uint8Array(Buffer.from(payload, "base64"));
}

function assertCanonicalMdxSize(source: string) {
  if (!source || Buffer.byteLength(source, "utf8") > MAX_WORKSPACE_MDX_BYTES) {
    throw badRequest("presentation.mdx must not exceed 2 MB after embedded images are extracted.");
  }
}

function assertSafeArchiveEntry(entry: JSZipObject) {
  const originalName = (entry as JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
  const normalized = originalName.replace(/\/$/, "");
  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw badRequest("The OpenSlideX project bundle contains an unsafe path.");
  }
  const permissions = typeof entry.unixPermissions === "string"
    ? Number.parseInt(entry.unixPermissions, 8)
    : entry.unixPermissions;
  if (typeof permissions === "number" && (permissions & 0o170000) === 0o120000) {
    throw badRequest("The OpenSlideX project bundle must not contain symbolic links.");
  }
}

function uncompressedSize(entry: JSZipObject) {
  if (entry.dir) return 0;
  const value = (entry as JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw badRequest(`The project bundle has invalid size metadata: ${entry.name}`);
  }
  return value;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
