import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";

import { importSlideXImageAsset, resolveInsideRoot, type SlideXImageAsset } from "@open-slidex/sdk/node";
import { extractPdfMedia } from "./pdfContent";
import { downloadPublicImage, type PublicImageDownload } from "./publicImages";
import { appendImageProvenance } from "./trustedImages";

const documentExtensions = new Set([".csv", ".md", ".markdown", ".pdf", ".txt"]);
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const maximumDocumentBytes = 20 * 1024 * 1024;
const maximumImageBytes = 25 * 1024 * 1024;

export type SourceIntakeAsset = SlideXImageAsset & {
  origin: {
    kind: "ai-or-local" | "markdown-data" | "markdown-local" | "markdown-url" | "pdf-embedded" | "pdf-page";
    page?: number;
    reference?: string;
  };
};

export type SourceIntakeResult = {
  assets: SourceIntakeAsset[];
  inputFile: string;
  knowledgePath?: string;
  kind: "document" | "image";
  revision: string;
  warnings: string[];
};

export async function ingestOpenSlideXSource(input: {
  expectedRevision: string;
  filePath: string;
  inboxRoot: string;
  projectRoot: string;
  downloadImage?: (url: string) => Promise<PublicImageDownload>;
}): Promise<SourceIntakeResult> {
  if (/^https:/i.test(input.filePath)) {
    const downloaded = await (input.downloadImage ?? downloadPublicImage)(input.filePath);
    const asset = await importAsset(input.projectRoot, downloaded.bytes, downloaded.fileName, {
      kind: "ai-or-local",
      reference: downloaded.originalUrl
    }, downloaded.mediaType);
    await appendImageProvenance(input.projectRoot, {
      finalUrl: downloaded.finalUrl,
      importedAt: new Date().toISOString(),
      origin: "public-image-url",
      originalUrl: downloaded.originalUrl,
      source: asset.source
    });
    return {
      assets: [asset],
      inputFile: downloaded.originalUrl,
      kind: "image",
      revision: input.expectedRevision,
      warnings: []
    };
  }
  const source = await inboxSource(input.inboxRoot, input.filePath);
  const extension = path.extname(source.path).toLowerCase();
  if (!documentExtensions.has(extension) && !imageExtensions.has(extension)) {
    throw new Error("Source intake supports Markdown, text, CSV, PDF, JPEG, PNG, WebP, AVIF, and non-animated GIF files.");
  }
  const sourceBytes = new Uint8Array(await readFile(source.path));
  const maximumBytes = imageExtensions.has(extension) ? maximumImageBytes : maximumDocumentBytes;
  if (sourceBytes.byteLength < 1 || sourceBytes.byteLength > maximumBytes) {
    throw new Error(`The source file must be between 1 and ${maximumBytes} bytes.`);
  }

  if (imageExtensions.has(extension)) {
    const asset = await importAsset(input.projectRoot, sourceBytes, path.basename(source.path), {
      kind: "ai-or-local",
      reference: source.relativePath
    });
    await appendImageProvenance(input.projectRoot, {
      importedAt: new Date().toISOString(),
      inputFile: source.relativePath,
      origin: "local-or-ai",
      source: asset.source
    });
    await unlink(source.path);
    return {
      assets: [asset],
      inputFile: source.relativePath,
      kind: "image",
      revision: input.expectedRevision,
      warnings: []
    };
  }

  const assets: SourceIntakeAsset[] = [];
  const warnings: string[] = [];
  if (extension === ".md" || extension === ".markdown") {
    const markdown = Buffer.from(sourceBytes).toString("utf8");
    const references = markdownImageReferences(markdown);
    for (let index = 0; index < references.length; index += 1) {
      const reference = references[index]!;
      try {
        const imported = await importMarkdownImage({
          downloadImage: input.downloadImage ?? downloadPublicImage,
          inboxRoot: source.inboxRoot,
          projectRoot: input.projectRoot,
          reference,
          sourceDirectory: path.dirname(source.path),
          sourceIndex: index
        });
        if (imported) assets.push(imported);
      } catch (error) {
        warnings.push(`Markdown image ${reference}: ${error instanceof Error ? error.message : "import failed"}`);
      }
    }
  }
  if (extension === ".pdf") {
    try {
      const extracted = await extractPdfMedia(sourceBytes, path.basename(source.path, extension));
      warnings.push(...extracted.warnings);
      for (const candidate of extracted.candidates) {
        try {
          const origin = {
            kind: candidate.kind === "embedded" ? "pdf-embedded" as const : "pdf-page" as const,
            page: candidate.page,
            reference: source.relativePath
          };
          const asset = await importAsset(input.projectRoot, candidate.bytes, candidate.fileName, origin);
          assets.push(asset);
          await appendImageProvenance(input.projectRoot, {
            importedAt: new Date().toISOString(),
            inputFile: source.relativePath,
            origin: origin.kind,
            page: candidate.page,
            source: asset.source
          });
        } catch (error) {
          warnings.push(`PDF page ${candidate.page} ${candidate.kind}: ${error instanceof Error ? error.message : "image import failed"}`);
        }
      }
    } catch (error) {
      warnings.push(`PDF visual extraction: ${error instanceof Error ? error.message : "unavailable"}`);
    }
  }

  const knowledgePath = await writeKnowledgeSource(input.projectRoot, sourceBytes, path.basename(source.path));
  await unlink(source.path);
  return {
    assets,
    inputFile: source.relativePath,
    knowledgePath,
    kind: "document",
    revision: input.expectedRevision,
    warnings
  };
}

async function inboxSource(inboxRootInput: string, requestedPath: string) {
  if (!requestedPath || path.isAbsolute(requestedPath) || /^(?:data|blob|https?):/i.test(requestedPath)) {
    throw new Error("filePath must be relative to the configured .open-slidex-inbox directory.");
  }
  await mkdir(inboxRootInput, { recursive: true });
  const rootStats = await lstat(inboxRootInput);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(".open-slidex-inbox must be a real directory.");
  }
  const inboxRoot = await realpath(inboxRootInput);
  const requested = resolveInsideRoot(inboxRoot, requestedPath);
  const sourceStats = await lstat(requested);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error("The inbox source must be a regular file, not a symlink.");
  }
  const canonical = resolveInsideRoot(inboxRoot, await realpath(requested));
  return {
    inboxRoot,
    path: canonical,
    relativePath: path.relative(inboxRoot, canonical).split(path.sep).join("/")
  };
}

async function importMarkdownImage(input: {
  downloadImage: (url: string) => Promise<PublicImageDownload>;
  inboxRoot: string;
  projectRoot: string;
  reference: string;
  sourceDirectory: string;
  sourceIndex: number;
}) {
  if (/^data:/i.test(input.reference)) {
    const decoded = decodeImageDataUrl(input.reference);
    const asset = await importAsset(input.projectRoot, decoded.bytes, `markdown-inline-${input.sourceIndex + 1}.${decoded.extension}`, {
      kind: "markdown-data",
      reference: "data:image/..."
    });
    await appendImageProvenance(input.projectRoot, {
      importedAt: new Date().toISOString(),
      origin: "markdown-data",
      source: asset.source
    });
    return asset;
  }
  if (/^https:/i.test(input.reference)) {
    const downloaded = await input.downloadImage(input.reference);
    const asset = await importAsset(input.projectRoot, downloaded.bytes, downloaded.fileName, {
      kind: "markdown-url",
      reference: downloaded.originalUrl
    }, downloaded.mediaType);
    await appendImageProvenance(input.projectRoot, {
      finalUrl: downloaded.finalUrl,
      importedAt: new Date().toISOString(),
      origin: "markdown-url",
      originalUrl: downloaded.originalUrl,
      source: asset.source
    });
    return asset;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(input.reference) || input.reference.startsWith("//")) {
    throw new Error("Only local, data:image, or public HTTPS image references are supported.");
  }
  const cleaned = decodeURIComponent(input.reference.split(/[?#]/, 1)[0] ?? "");
  if (!cleaned || path.isAbsolute(cleaned)) throw new Error("Local Markdown image path is invalid.");
  const candidate = resolveInsideRoot(input.inboxRoot, path.resolve(input.sourceDirectory, cleaned));
  const stats = await lstat(candidate);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Local Markdown image must be a regular file.");
  const canonical = resolveInsideRoot(input.inboxRoot, await realpath(candidate));
  const bytes = new Uint8Array(await readFile(canonical));
  const asset = await importAsset(input.projectRoot, bytes, path.basename(canonical), {
    kind: "markdown-local",
    reference: input.reference
  });
  await appendImageProvenance(input.projectRoot, {
    importedAt: new Date().toISOString(),
    inputFile: path.relative(input.inboxRoot, canonical).split(path.sep).join("/"),
    origin: "markdown-local",
    source: asset.source
  });
  return asset;
}

async function importAsset(
  projectRoot: string,
  bytes: Uint8Array,
  fileName: string,
  origin: SourceIntakeAsset["origin"],
  mediaType?: string
): Promise<SourceIntakeAsset> {
  const asset = await importSlideXImageAsset({ bytes, fileName, mediaType, projectRoot });
  return { ...asset, origin };
}

function markdownImageReferences(source: string) {
  const tree = fromMarkdown(source) as MarkdownNode;
  const references: string[] = [];
  const visit = (node: MarkdownNode) => {
    if (node.type === "image" && typeof node.url === "string") references.push(node.url);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return [...new Set(references)];
}

type MarkdownNode = {
  children?: MarkdownNode[];
  type?: string;
  url?: string;
};

function decodeImageDataUrl(value: string) {
  const match = value.match(/^data:image\/(png|jpeg|jpg|webp|avif|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("Inline Markdown images must be Base64 PNG, JPEG, WebP, AVIF, or GIF data URLs.");
  const bytes = Buffer.from(match[2]!.replace(/\s+/g, ""), "base64");
  if (bytes.byteLength < 1 || bytes.byteLength > maximumImageBytes) throw new Error("Inline Markdown image exceeds the import limit.");
  return { bytes: new Uint8Array(bytes), extension: match[1]!.toLowerCase() === "jpeg" ? "jpg" : match[1]!.toLowerCase() };
}

async function writeKnowledgeSource(projectRoot: string, bytes: Uint8Array, fileName: string) {
  const requestedRoot = resolveInsideRoot(projectRoot, "knowledge");
  await mkdir(requestedRoot, { recursive: true });
  const stats = await lstat(requestedRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("knowledge/ must be a real directory.");
  const root = resolveInsideRoot(await realpath(projectRoot), await realpath(requestedRoot));
  const extension = path.extname(fileName).toLowerCase();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `${safeStem(path.basename(fileName, extension))}-${hash.slice(0, 16)}${extension}`;
  const target = resolveInsideRoot(root, name);
  const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("The knowledge destination is not a regular file.");
    const current = await readFile(target);
    if (!current.equals(Buffer.from(bytes))) throw new Error("A knowledge source hash collision was detected.");
  } else {
    const temporary = resolveInsideRoot(root, `.${name}.${randomUUID()}.tmp`);
    await writeFile(temporary, bytes, { mode: 0o644 });
    try {
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  return `knowledge/${name}`;
}

function safeStem(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "source";
}
