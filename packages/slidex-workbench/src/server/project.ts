import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applySlideXBatch,
  buildMotionDocPngSvg,
  getOfficialTemplatePackage,
  listSlideXAssetReferences,
  officialTemplatePackages,
  parseMotionDoc,
  parseTemplateRef,
  stripNonLocalMotionDocMedia,
  summarizeMotionDoc,
  type TemplatePackageLocale,
  type TemplateRef,
  validateOpenSlideXLocalMedia,
  type SlideXDocument
} from "@open-slidex/sdk";
import {
  exportSlideXDocument,
  importOpenSlideXImageAsset,
  importOpenSlideXVideoAsset,
  renderSlideXDocument,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";

import { extractEmbeddedImageAssets } from "./workspaceImport";

export type ProjectSnapshot = ReturnType<SlideXProject["snapshot"]>;

export class OpenSlideXLocalMediaError extends Error {
  constructor(readonly issues: ReturnType<typeof validateOpenSlideXLocalMedia>["issues"]) {
    super("OpenSlideX local decks allow imported assets/*.webp or complete HTTPS media URLs.");
    this.name = "OpenSlideXLocalMediaError";
  }
}

export class SlideXProject {
  readonly adapter: SlideXFileDocumentAdapter;
  readonly assetsRoot: string;
  readonly distRoot: string;
  readonly projectId: string;
  readonly root: string;
  readonly stateRoot: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.assetsRoot = path.join(this.root, "assets");
    this.distRoot = path.join(this.root, "dist");
    this.stateRoot = path.join(this.root, ".open-slidex");
    this.projectId = createHash("sha256").update(this.root).digest("hex").slice(0, 20);
    this.adapter = new SlideXFileDocumentAdapter({ projectRoot: this.root });
  }

  async prepare() {
    await Promise.all([
      mkdir(this.assetsRoot, { recursive: true }),
      mkdir(this.distRoot, { recursive: true }),
      mkdir(this.stateRoot, { recursive: true })
    ]);
    if (!(await this.adapter.exists())) {
      throw new Error(`presentation.mdx was not found in ${this.root}.`);
    }
  }

  snapshot(document: SlideXDocument) {
    return {
      ...document,
      projectId: this.projectId,
      validation: summarizeMotionDoc(document.source).validation
    };
  }

  async open() {
    return this.snapshot(await this.adapter.open());
  }

  async templateCatalog(locale: TemplatePackageLocale) {
    const current = await this.readTemplateLock().catch(() => undefined);
    return {
      canSelect: true,
      current,
      templates: officialTemplatePackages.map((template) => ({
        blueprintSummary: template.blueprint.narrative.objective,
        cover: `/api/v1/templates/${template.id}/cover.svg?locale=${encodeURIComponent(locale)}&version=${encodeURIComponent(template.version)}`,
        description: template.locales[locale].description,
        id: template.id,
        locale,
        name: template.locales[locale].name,
        slideCount: template.catalog.slideCount,
        useCase: template.locales[locale].useCase,
        version: template.version
      }))
    };
  }

  async selectTemplate(value: unknown) {
    const reference = parseTemplateRef(value);
    if (!getOfficialTemplatePackage(reference.id, reference.version)) {
      throw new Error(`Official template package is unavailable: ${reference.id}@${reference.version}`);
    }
    await mkdir(this.stateRoot, { recursive: true });
    const target = path.join(this.stateRoot, "template-lock.json");
    const temporary = path.join(this.stateRoot, `.template-lock.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(reference, null, 2)}\n`, "utf8");
    await rename(temporary, target);
    return reference;
  }

  templatePreview(value: unknown) {
    const reference = parseTemplateRef(value);
    const template = getOfficialTemplatePackage(reference.id, reference.version);
    if (!template) {
      throw Object.assign(new Error(`Official template package is unavailable: ${reference.id}@${reference.version}`), { status: 404 });
    }
    return buildMotionDocPngSvg(
      stripNonLocalMotionDocMedia(template.sources[reference.locale]),
      0,
      template.locales[reference.locale].name
    );
  }

  private async readTemplateLock(): Promise<TemplateRef> {
    return parseTemplateRef(JSON.parse(await readFile(path.join(this.stateRoot, "template-lock.json"), "utf8")));
  }

  async save(input: { expectedRevision: string; source: string; title: string }) {
    await this.assertRevision(input.expectedRevision);
    const source = await this.importEmbeddedImageAssets(input.source);
    assertOpenSlideXLocalMedia(source);
    return this.snapshot(await this.adapter.save({ ...input, source }));
  }

  async listAssets() {
    const document = await this.adapter.open();
    const references = listSlideXAssetReferences(document.source);
    const entries = await readdir(this.assetsRoot, { withFileTypes: true });
    const assets = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isAssetFileName(entry.name))
        .map(async (entry) => {
          const source = `assets/${entry.name}`;
          return {
            bytes: (await stat(path.join(this.assetsRoot, entry.name))).size,
            mimeType: assetMimeType(entry.name),
            name: entry.name,
            source,
            usedBy: references
              .filter((reference) => reference.source === source)
              .map((reference) => ({
                blockIndex: reference.blockIndex,
                prop: reference.prop,
                slideIndex: reference.slideIndex
              }))
          };
        })
    );
    return assets.sort((left, right) => left.name.localeCompare(right.name));
  }

  async importAsset(file: File, expectedRevision: string) {
    await this.assertRevision(expectedRevision);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isMp4Upload(file)) {
      const asset = await importOpenSlideXVideoAsset({
        bytes,
        fileName: file.name,
        mediaType: file.type,
        projectRoot: this.root
      });
      return { bytes: asset.bytes, mimeType: asset.mimeType, name: asset.name, source: asset.source, usedBy: [] };
    }
    const asset = await importOpenSlideXImageAsset({
      bytes,
      fileName: file.name,
      mediaType: file.type,
      projectRoot: this.root
    });
    return {
      bytes: asset.bytes,
      mimeType: asset.mimeType,
      name: asset.name,
      source: asset.source,
      usedBy: []
    };
  }

  async renameAsset(input: { expectedRevision: string; from: string; to: string }) {
    const fromName = assetName(input.from);
    const toName = normalizedAssetName(input.to);
    if (fromName === toName) return this.open();
    const fromPath = resolveInsideRoot(this.assetsRoot, fromName);
    const toPath = resolveInsideRoot(this.assetsRoot, toName);
    if (await exists(toPath)) throw new Error("An asset with that name already exists.");

    await copyFile(fromPath, toPath, constants.COPYFILE_EXCL);
    try {
      const document = await this.adapter.edit(input.expectedRevision, [
        { from: `assets/${fromName}`, to: `assets/${toName}`, type: "asset.repath" }
      ]);
      await unlink(fromPath);
      return this.snapshot(document);
    } catch (error) {
      await unlink(toPath).catch(() => undefined);
      throw error;
    }
  }

  async deleteAsset(source: string, expectedRevision: string) {
    const name = assetName(source);
    const document = await this.adapter.open();
    if (document.revision !== expectedRevision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    const used = listSlideXAssetReferences(document.source).some(
      (reference) => reference.source === `assets/${name}`
    );
    if (used) throw new Error("The asset is still referenced by presentation.mdx.");
    await unlink(resolveInsideRoot(this.assetsRoot, name));
  }

  private async assertRevision(expectedRevision: string) {
    const document = await this.adapter.open();
    if (document.revision !== expectedRevision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    return document;
  }

  async readAsset(name: string) {
    const safeName = assetName(`assets/${name}`);
    return readFile(resolveInsideRoot(this.assetsRoot, safeName));
  }

  assetMimeType(name: string) {
    return assetMimeType(assetName(`assets/${name}`));
  }

  async writeCurrent(input: {
    blockIndex?: number;
    nodeId?: string;
    revision: string;
    slideIndex: number;
  }) {
    const document = await this.adapter.open();
    if (document.revision !== input.revision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    const slide = parseMotionDoc(document.source).scenes[input.slideIndex];
    if (!slide) throw new Error("The selected slide no longer exists.");
    const block = input.nodeId
      ? slide.blocks.find(
          (candidate) =>
            candidate.props?.id === input.nodeId
        )
      : input.blockIndex === undefined
        ? undefined
        : slide.blocks[input.blockIndex];
    // Canvas selection can briefly lag behind a delete, reorder, or source
    // replacement. Context is advisory metadata for local agents, so retain
    // the active slide and clear the stale layer instead of turning a
    // background sync into a 500 response.
    const resolvedBlock = block;

    const value = {
      blockId: resolvedBlock ? input.nodeId : undefined,
      blockType: resolvedBlock?.type,
      document: "presentation.mdx",
      revision: document.revision,
      slideId: String(slide.props?.id ?? `slide-${input.slideIndex + 1}`),
      slideIndex: input.slideIndex,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    const temporary = path.join(this.stateRoot, `.current.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path.join(this.stateRoot, "current.json"));
  }

  async export(input: {
    fileName: string;
    format: "html" | "mdx" | "pptx";
    overwrite: boolean;
    source: string;
    target: "download" | "dist";
  }) {
    // Exports use the live canvas source, which can briefly contain an image
    // pasted just before the autosave normalizes it to an assets/*.webp path.
    // Keep export behavior aligned with save so this valid user flow cannot
    // fail with local_media_not_allowed during that short interval.
    const source = await this.importEmbeddedImageAssets(input.source);
    assertOpenSlideXLocalMedia(source);
    const fileName = safeExportName(input.fileName);
    const root =
      input.target === "download"
        ? await mkdtemp(path.join(os.tmpdir(), "slidex-export-"))
        : this.distRoot;
    const outputPath = path.join(root, `${fileName}.${input.format}`);
    try {
      await exportSlideXDocument({
        format: input.format,
        outputPath,
        overwrite: input.target === "download" || input.overwrite,
        projectRoot: this.root,
        source
      });
      return input.target === "download"
        ? { bytes: await readFile(outputPath), output: `${fileName}.${input.format}` }
        : { output: `dist/${fileName}.${input.format}` };
    } finally {
      if (input.target === "download") await rm(root, { force: true, recursive: true });
    }
  }

  private async importEmbeddedImageAssets(source: string) {
    const embedded = extractEmbeddedImageAssets(source);
    const commands = [];
    for (const asset of embedded.assets) {
      const stored = await importOpenSlideXImageAsset({
        bytes: asset.bytes,
        fileName: asset.fileName,
        mediaType: asset.mediaType,
        projectRoot: this.root
      });
      if (stored.source !== asset.source) {
        commands.push({ from: asset.source, to: stored.source, type: "asset.repath" } as const);
      }
    }
    return commands.length > 0
      ? applySlideXBatch(embedded.source, commands).source
      : embedded.source;
  }

  async renderMontage(overwrite: boolean) {
    const outputPath = path.join(this.distRoot, "montage.png");
    if (!overwrite && (await exists(outputPath))) {
      throw new Error("dist/montage.png already exists.");
    }
    const document = await this.adapter.open();
    assertOpenSlideXLocalMedia(document.source);
    await renderSlideXDocument({
      mode: "montage",
      outputPath,
      projectRoot: this.root,
      source: document.source
    });
    return "dist/montage.png";
  }

  async buildStaticSite() {
    const document = await this.adapter.open();
    assertOpenSlideXLocalMedia(document.source);
    const siteRoot = path.join(this.distRoot, "site");
    await mkdir(siteRoot, { recursive: true });
    await exportSlideXDocument({
      format: "html",
      outputPath: path.join(siteRoot, "index.html"),
      overwrite: true,
      projectRoot: this.root,
      source: document.source
    });
    return siteRoot;
  }
}

function assertOpenSlideXLocalMedia(source: string) {
  const result = validateOpenSlideXLocalMedia(source);
  if (!result.isValid) throw new OpenSlideXLocalMediaError(result.issues);
}

export function safeExportName(value: unknown) {
  const normalized =
    typeof value === "string"
      ? value
          .normalize("NFKD")
          .replace(/[^A-Za-z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";
  return (normalized || "presentation").slice(0, 80);
}

function assetName(source: string) {
  if (!/^assets\/[A-Za-z0-9._-]+\.(?:webp|mp4)$/i.test(source)) {
    throw new Error("Asset paths must use assets/<name>.webp or assets/<name>.mp4.");
  }
  return source.slice("assets/".length);
}

function normalizedAssetName(value: string) {
  const name = value.startsWith("assets/") ? value.slice(7) : value;
  const extension = path.extname(name).toLowerCase() === ".mp4" ? ".mp4" : ".webp";
  const base = name
    .replace(/\.(?:webp|mp4)$/i, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  if (!base) throw new Error("Choose a valid asset name.");
  return `${base}${extension}`;
}

function isAssetFileName(value: string) {
  return /^[A-Za-z0-9._-]+\.(?:webp|mp4)$/i.test(value);
}

function assetMimeType(value: string) {
  return value.toLowerCase().endsWith(".mp4") ? "video/mp4" : "image/webp";
}

function isMp4Upload(file: File) {
  return file.type.toLowerCase().split(";", 1)[0] === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
}

function exists(filePath: string) {
  return access(filePath).then(() => true, () => false);
}
