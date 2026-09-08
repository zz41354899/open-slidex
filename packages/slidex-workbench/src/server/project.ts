import { createHash } from "node:crypto";
import { constants, existsSync } from "node:fs";
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
  getOfficialTemplatePackage,
  listSlideXAssetReferences,
  officialTemplatePackages,
  motionDocToReactPresentationSource,
  parseMotionDoc,
  parseTemplateRef,
  summarizeMotionDoc,
  type TemplatePackageLocale,
  type TemplateRef,
  validateOpenSlideXLocalMedia,
  type SlideXDocument
} from "@open-slidex/sdk";
import { assertSafeMotionDocSvg } from "@/core/motion-doc/domain/svgPolicy";
import { htmlPresentationAsset } from "@/core/motion-doc/domain/htmlPresentation";
import {
  exportSlideXDocument,
  importOpenSlideXImageAsset,
  importOpenSlideXVideoAsset,
  ensureDirectoryInsideRoot,
  openExistingFileInsideRoot,
  renderSlideXHtmlThumbnail,
  renderSlideXDocument,
  resolveExistingInsideRoot,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";

import { analyzeHtmlPresentation, assertSandboxedHtml, secureHtmlForStandaloneExport } from "./htmlImportPolicy";
import { createHtmlPresentationMdx, extractEmbeddedImageAssets, MAX_WORKSPACE_IMPORT_FILE_BYTES } from "./workspaceImport";
import { renderOfficialTemplateCover } from "./templateCover";
import { fileFingerprint } from "./fileFingerprint";
import { BoundedCache } from "@/common/util/boundedCache";

export type ProjectSnapshot = ReturnType<SlideXProject["snapshot"]>;
const HTML_THUMBNAIL_RENDER_VERSION = "v3";
type ThumbnailJob = { page: number; outputPath: string; resolve: (bytes: Buffer) => void; reject: (error: unknown) => void };

export class OpenSlideXLocalMediaError extends Error {
  constructor(readonly issues: ReturnType<typeof validateOpenSlideXLocalMedia>["issues"]) {
    super("OpenSlideX local decks allow typed assets in assets/ and complete HTTPS raster or video media URLs.");
    this.name = "OpenSlideXLocalMediaError";
  }
}

export class SlideXProject {
  adapter: SlideXFileDocumentAdapter;
  readonly assetsRoot: string;
  readonly distRoot: string;
  readonly projectId: string;
  readonly root: string;
  readonly stateRoot: string;
  private readonly htmlThumbnailRenders = new Map<string, Promise<Buffer>>();
  private htmlThumbnailRenderQueue: Promise<void> = Promise.resolve();
  private opened?: { fingerprint: string; snapshot: ReturnType<SlideXProject["snapshot"]> };
  private currentWriteQueue: Promise<void> = Promise.resolve();
  private currentKey = "";
  private readonly thumbnailSources = new BoundedCache<string, { html: string; hash: string; htmlSidecars: string[] }>(8, 16 * 1024 * 1024);
  private readonly thumbnailSourceLoads = new Map<string, Promise<{ html: string; hash: string; htmlSidecars: string[] }>>();
  private readonly thumbnailBatches = new Map<string, ThumbnailJob[]>();

  constructor(root: string) {
    this.root = path.resolve(root);
    this.assetsRoot = path.join(this.root, "assets");
    this.distRoot = path.join(this.root, "dist");
    this.stateRoot = path.join(this.root, ".open-slidex");
    this.projectId = createHash("sha256").update(this.root).digest("hex").slice(0, 20);
    this.adapter = new SlideXFileDocumentAdapter({
      documentPath: existsSync(path.join(this.root, "presentation.tsx"))
        ? "presentation.tsx"
        : "presentation.mdx",
      projectRoot: this.root
    });
  }

  async prepare() {
    await Promise.all([
      ensureDirectoryInsideRoot(this.root, this.assetsRoot),
      ensureDirectoryInsideRoot(this.root, this.distRoot),
      ensureDirectoryInsideRoot(this.root, this.stateRoot)
    ]);
    if (!(await this.adapter.exists())) {
      throw new Error(`presentation.tsx or legacy presentation.mdx was not found in ${this.root}.`);
    }
  }

  snapshot(document: SlideXDocument) {
    const sourceFormat = path.extname(this.adapter.documentPath) === ".tsx" ? "tsx" : "mdx";
    return {
      ...document,
      projectId: this.projectId,
      requiresMigration: sourceFormat === "mdx",
      sourceFormat,
      validation: summarizeMotionDoc(document.source).validation
    };
  }

  async open() {
    const documentPath = await resolveExistingInsideRoot(this.root, this.adapter.documentPath, "file");
    const fingerprint = await fileFingerprint(documentPath);
    if (this.opened?.fingerprint === fingerprint) return structuredClone(this.opened.snapshot);
    const snapshot = this.snapshot(await this.adapter.open());
    this.opened = { fingerprint, snapshot };
    return structuredClone(snapshot);
  }

  async migrateLegacyMdx(expectedRevision: string, options: { renderedComparison?: boolean } = {}) {
    if (path.extname(this.adapter.documentPath) === ".tsx") return this.open();
    const legacy = await this.adapter.open();
    if (legacy.revision !== expectedRevision) throw new SlideXRevisionConflictError(legacy.revision);

    const candidate = motionDocToReactPresentationSource(legacy.source);
    const validation = summarizeMotionDoc(candidate).validation;
    if (!validation.isValid) {
      throw badRequest(`Legacy MDX could not be upgraded: ${validation.issues.map((issue) => issue.message).join("; ")}`);
    }
    if (JSON.stringify(parseMotionDoc(candidate)) !== JSON.stringify(parseMotionDoc(legacy.source))) {
      throw badRequest("Legacy MDX conversion changed the native slide structure; the original file was not modified.");
    }
    if (options.renderedComparison) {
      await this.assertRenderedMigrationEquivalent(legacy.source, candidate, legacy.title);
    }

    const nextAdapter = new SlideXFileDocumentAdapter({ documentPath: "presentation.tsx", projectRoot: this.root });
    const legacyBackupRoot = path.join(this.stateRoot, "legacy");
    const legacyBackupPath = path.join(legacyBackupRoot, "presentation.mdx");
    if (await exists(legacyBackupPath)) {
      throw badRequest(".open-slidex/legacy/presentation.mdx already exists; move that backup before upgrading again.");
    }
    await nextAdapter.create(candidate);
    try {
      await mkdir(legacyBackupRoot, { recursive: true });
      await rename(this.adapter.documentPath, legacyBackupPath);
    } catch (error) {
      await rm(nextAdapter.documentPath, { force: true });
      throw error;
    }
    this.adapter = nextAdapter;
    return this.open();
  }

  private async assertRenderedMigrationEquivalent(legacySource: string, reactSource: string, title: string) {
    const comparisonRoot = await mkdtemp(path.join(os.tmpdir(), "slidex-react-migration-"));
    const legacyPath = path.join(comparisonRoot, "legacy.png");
    const reactPath = path.join(comparisonRoot, "react.png");
    try {
      await renderSlideXDocument({ mode: "montage", outputPath: legacyPath, projectRoot: this.root, source: legacySource, title });
      await renderSlideXDocument({ mode: "montage", outputPath: reactPath, projectRoot: this.root, source: reactSource, title });
      const [legacyRender, reactRender] = await Promise.all([readFile(legacyPath), readFile(reactPath)]);
      if (!legacyRender.equals(reactRender)) {
        throw badRequest("Rendered comparison changed after React conversion; the original MDX was not modified.");
      }
    } finally {
      await rm(comparisonRoot, { force: true, recursive: true });
    }
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

  async templatePreview(value: unknown) {
    const reference = parseTemplateRef(value);
    return renderOfficialTemplateCover({
      cacheRoot: path.join(this.stateRoot, "template-covers"),
      projectRoot: this.root,
      slideIndex: 0,
      ...reference
    });
  }

  private async readTemplateLock(): Promise<TemplateRef> {
    return parseTemplateRef(JSON.parse(await readFile(path.join(this.stateRoot, "template-lock.json"), "utf8")));
  }

  async save(input: { expectedRevision: string; source: string; title: string }) {
    await this.assertRevision(input.expectedRevision);
    const source = await this.importEmbeddedImageAssets(normalizeWorkspaceAssetUrls(input.source));
    assertOpenSlideXLocalMedia(source);
    return this.snapshot(await this.adapter.save({ ...input, source }));
  }

  async listAssets() {
    const document = await this.adapter.open();
    const references = listSlideXAssetReferences(document.source);
    const assetsRoot = await this.safeAssetsRoot();
    const entries = await readdir(assetsRoot, { withFileTypes: true });
    const assets = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isAssetFileName(entry.name))
        .map(async (entry) => {
          const source = `assets/${entry.name}`;
          return {
            bytes: (await stat(path.join(assetsRoot, entry.name))).size,
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
    if (isSvgUpload(file)) {
      if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) {
        throw new Error("SVG assets must be between 1 byte and 10 MB.");
      }
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new Error("SVG assets must use UTF-8 encoding.");
      }
      assertSafeMotionDocSvg(source);
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const base = safeExportName(file.name.replace(/\.svg$/i, "")) || "scene";
      const name = `${base.slice(0, 56)}-${hash}.svg`;
      const assetsRoot = await this.safeAssetsRoot();
      await writeFile(resolveInsideRoot(assetsRoot, name), bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      return { bytes: bytes.byteLength, mimeType: "image/svg+xml", name, source: `assets/${name}`, usedBy: [] };
    }
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
    if (/^html-asset-[a-f0-9]{16}\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(fromName)) {
      throw badRequest("Packaged HTML sidecars use content-addressed names and cannot be renamed.");
    }
    const toName = normalizedAssetName(input.to);
    if (fromName === toName) return this.open();
    const assetsRoot = await this.safeAssetsRoot();
    const fromPath = await resolveExistingInsideRoot(assetsRoot, fromName, "file");
    const toPath = resolveInsideRoot(assetsRoot, toName);
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

  async replaceHtmlAsset(input: {
    expectedRevision: string;
    html: string;
    source: string;
  }) {
    const current = await this.assertRevision(input.expectedRevision);
    const fromName = assetName(input.source);
    if (!/\.html?$/i.test(fromName)) throw badRequest("Only an imported HTML source can be edited here.");
    if (!input.html || Buffer.byteLength(input.html, "utf8") > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
      throw Object.assign(new Error("The HTML source must be between 1 byte and 50 MB."), { status: 413 });
    }
    assertSandboxedHtml(input.html, { localAssets: await this.htmlSidecarNames() });
    const document = parseMotionDoc(current.source);
    const referenced = document.scenes.some((scene) => scene.blocks.some(
      (block) => block.type === "HtmlEmbedBlock" && block.props.src === input.source
    ));
    if (!referenced) throw badRequest("The selected HTML source is no longer referenced by presentation.tsx.");

    const bytes = Buffer.from(input.html, "utf8");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const nextName = `source-${hash}.html`;
    const nextSource = `assets/${nextName}`;
    const pureHtmlSource = originalHtmlAsset(document) === input.source;
    const pages = analyzeHtmlPresentation(input.html);
    const assetsRoot = await this.safeAssetsRoot();
    if (nextSource === input.source) {
      await writeFile(resolveInsideRoot(assetsRoot, nextName), bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
      const nextDocument = pureHtmlSource
        ? await this.adapter.save({
            expectedRevision: input.expectedRevision,
            source: createHtmlPresentationMdx(document.title, nextSource, hash, pages),
            title: document.title
          })
        : current;
      return { document: this.snapshot(nextDocument), source: nextSource };
    }

    const nextPath = resolveInsideRoot(assetsRoot, nextName);
    await writeFile(nextPath, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    try {
      const nextDocument = pureHtmlSource
        ? await this.adapter.save({
            expectedRevision: input.expectedRevision,
            source: createHtmlPresentationMdx(document.title, nextSource, hash, pages),
            title: document.title
          })
        : await this.adapter.edit(input.expectedRevision, [
            { from: input.source, to: nextSource, type: "asset.repath" }
          ]);
      await unlink(await resolveExistingInsideRoot(assetsRoot, fromName, "file")).catch(() => undefined);
      return { document: this.snapshot(nextDocument), source: nextSource };
    } catch (error) {
      // The path is content-addressed and may already have been committed by a
      // concurrent save with identical HTML. Removing it here can leave the
      // winning document revision pointing at a missing canonical asset.
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
    if (used || await this.htmlSidecarIsReferenced(name)) throw new Error("The asset is still referenced by this presentation.");
    await unlink(await resolveExistingInsideRoot(await this.safeAssetsRoot(), name, "file"));
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
    try {
      const handle = await this.openAsset(safeName);
      try {
        return await handle.readFile();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw Object.assign(new Error("The requested local asset was not found."), { status: 404 });
      }
      throw error;
    }
  }

  async assetPath(name: string) {
    return resolveExistingInsideRoot(await this.safeAssetsRoot(), assetName(`assets/${name}`), "file");
  }

  async openAsset(name: string) {
    return openExistingFileInsideRoot(await this.safeAssetsRoot(), assetName(`assets/${name}`));
  }

  assetMimeType(name: string) {
    return assetMimeType(assetName(`assets/${name}`));
  }

  async renderHtmlThumbnail(source: string, page: number) {
    const name = assetName(source);
    if (!/\.html?$/i.test(name)) throw badRequest("HTML thumbnails require an imported HTML source.");
    if (!Number.isInteger(page) || page < 1 || page > 200) throw badRequest("HTML thumbnail page must be between 1 and 200.");
    const htmlSidecars = await this.htmlSidecarNames();
    const stamps = await Promise.all([name, ...htmlSidecars].map(async (asset) => {
      const handle = await this.openAsset(asset);
      try {
        return await fileFingerprint(handle);
      } finally {
        await handle.close();
      }
    }));
    const sourceKey = JSON.stringify([name, htmlSidecars, stamps]);
    let prepared = this.thumbnailSources.get(sourceKey);
    if (!prepared) {
      let loading = this.thumbnailSourceLoads.get(sourceKey);
      if (!loading) {
        loading = this.readAsset(name).then((bytes) => {
          const html = bytes.toString("utf8");
          assertSandboxedHtml(html, { localAssets: htmlSidecars });
          const hash = createHash("sha256").update(bytes).update(sourceKey).digest("hex").slice(0, 24);
          const result = { html, hash, htmlSidecars };
          this.thumbnailSources.set(sourceKey, result, (html.length + sourceKey.length) * 2);
          return result;
        }).finally(() => this.thumbnailSourceLoads.delete(sourceKey));
        this.thumbnailSourceLoads.set(sourceKey, loading);
      }
      prepared = await loading;
    }
    const { html, hash } = prepared;
    const cacheRoot = path.join(this.stateRoot, "html-thumbnails", HTML_THUMBNAIL_RENDER_VERSION, hash);
    const outputPath = path.join(cacheRoot, `page-${page}.png`);
    const cached = await stat(outputPath).catch(() => null);
    if (cached?.isFile()) return readFile(outputPath);

    const key = `${hash}:${page}`;
    const existing = this.htmlThumbnailRenders.get(key);
    if (existing) return existing;
    const render = new Promise<Buffer>((resolve, reject) => {
      const pending = this.thumbnailBatches.get(hash);
      const job = { page, outputPath, resolve, reject };
      if (pending) { pending.push(job); return; }
      const jobs = [job];
      this.thumbnailBatches.set(hash, jobs);
      const batch = this.htmlThumbnailRenderQueue.then(async () => {
        // Collect requests from nearby visible pages into one browser load.
        await new Promise((done) => setTimeout(done, 10));
        this.thumbnailBatches.delete(hash);
        const targets = jobs.map((item) => ({ page: item.page, outputPath: `${item.outputPath}.${process.pid}.${Date.now()}.tmp.png` }));
        try {
          await mkdir(cacheRoot, { recursive: true });
          await renderSlideXHtmlThumbnail({
            html,
            localAssets: await Promise.all(htmlSidecars.map(async (asset) => ({ bytes: await this.readAsset(asset), mimeType: this.assetMimeType(asset), name: asset }))),
            ...targets[0],
            additionalPages: targets.slice(1)
          });
          for (let index = 0; index < jobs.length; index++) {
            await rename(targets[index].outputPath, jobs[index].outputPath);
            jobs[index].resolve(await readFile(jobs[index].outputPath));
          }
        } catch (error) { jobs.forEach((item) => item.reject(error)); }
        finally { await Promise.all(targets.map((item) => rm(item.outputPath, { force: true }).catch(() => undefined))); }
      });
      this.htmlThumbnailRenderQueue = batch.catch(() => undefined);
    });
    this.htmlThumbnailRenders.set(key, render);
    try {
      return await render;
    } finally {
      if (this.htmlThumbnailRenders.get(key) === render) this.htmlThumbnailRenders.delete(key);
    }
  }

  private async htmlSidecarNames() {
    const entries = await readdir(await this.safeAssetsRoot(), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /^html-asset-[a-f0-9]{16}\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(entry.name))
      .map((entry) => entry.name);
  }

  private async htmlSidecarIsReferenced(name: string) {
    const assetsRoot = await this.safeAssetsRoot();
    const entries = await readdir(assetsRoot, { withFileTypes: true });
    const expression = new RegExp(`(?:["'(\\s]|^)${escapeRegExp(name)}(?:["')\\s,]|$)`);
    for (const entry of entries) {
      if (!entry.isFile() || !/^source-[a-f0-9]{16}\.html?$/i.test(entry.name)) continue;
      if (expression.test(await readFile(await resolveExistingInsideRoot(assetsRoot, entry.name, "file"), "utf8"))) return true;
    }
    return false;
  }

  private async safeAssetsRoot() {
    return resolveExistingInsideRoot(this.root, this.assetsRoot, "directory");
  }

  async writeCurrent(input: {
    blockIndex?: number;
    nodeId?: string;
    revision: string;
    slideIndex: number;
  }) {
    const next = this.currentWriteQueue.then(() => this.writeCurrentNow(input));
    this.currentWriteQueue = next.catch(() => undefined);
    return next;
  }

  private async writeCurrentNow(input: { blockIndex?: number; nodeId?: string; revision: string; slideIndex: number }) {
    const document = await this.open();
    const key = JSON.stringify([document.revision, input.slideIndex, input.nodeId, input.blockIndex]);
    if (key === this.currentKey) return;
    // Selection is advisory metadata, not a document mutation. A save can
    // advance the revision between React scheduling this request and the
    // server receiving it; resolve against the newest document instead of
    // returning a false conflict to the editor console.
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
      document: path.basename(this.adapter.documentPath),
      revision: document.revision,
      slideId: String(slide.props?.id ?? `slide-${input.slideIndex + 1}`),
      slideIndex: input.slideIndex,
      updatedAt: new Date().toISOString(),
      version: 1
    };
    const temporary = path.join(this.stateRoot, `.current.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path.join(this.stateRoot, "current.json"));
    this.currentKey = key;
  }

  async export(input: {
    fileName: string;
    format: "html" | "mdx" | "pptx";
    htmlMode?: "original" | "player";
    overwrite: boolean;
    source: string;
    target: "download" | "dist";
  }) {
    // Exports use the live canvas source, which can briefly contain an image
    // pasted just before the autosave normalizes it to an assets/*.webp path.
    // Keep export behavior aligned with save so this valid user flow cannot
    // fail with local_media_not_allowed during that short interval.
    const source = await this.importEmbeddedImageAssets(normalizeWorkspaceAssetUrls(input.source));
    assertOpenSlideXLocalMedia(source);
    const fileName = safeExportName(input.fileName);
    const parsedDocument = parseMotionDoc(source);
    const htmlSource = originalHtmlAsset(parsedDocument);
    if (htmlSource && input.format === "pptx") {
      throw badRequest("HTML source presentations can export only HTML or MDX.");
    }
    const originalHtml = input.format === "html" && input.htmlMode !== "player" ? htmlSource : undefined;
    if (originalHtml) {
      const bytes = await this.readAsset(originalHtml.slice("assets/".length));
      const securedBytes = Buffer.from(secureHtmlForStandaloneExport(bytes.toString("utf8")), "utf8");
      if (input.target === "download") return { bytes: securedBytes, output: `${fileName}.html` };
      const outputPath = path.join(this.distRoot, `${fileName}.html`);
      if (!input.overwrite && await exists(outputPath)) throw new Error(`dist/${fileName}.html already exists.`);
      await writeFile(outputPath, securedBytes);
      return { output: `dist/${fileName}.html` };
    }
    const root =
      input.target === "download"
        ? await mkdtemp(path.join(os.tmpdir(), "slidex-export-"))
        : this.distRoot;
    const outputPath = path.join(root, `${fileName}.${input.format}`);
    try {
      await exportSlideXDocument({
        format: input.format,
        keepBrowserWarm: input.format === "pptx",
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
      if (asset.mediaType === "text/html" || asset.mediaType === "image/svg+xml") {
        await writeFile(path.join(this.assetsRoot, asset.fileName), asset.bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error;
        });
        if (asset.source !== `assets/${asset.fileName}`) {
          commands.push({ from: asset.source, to: `assets/${asset.fileName}`, type: "asset.repath" } as const);
        }
        continue;
      }
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

function originalHtmlAsset(document: ReturnType<typeof parseMotionDoc>) {
  return htmlPresentationAsset(document);
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
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

const workspaceAssetUrlAttributePattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*(?:(["'])([^"']*)\2|\{\s*(["'])([^"']*)\4\s*\})/g;
const workspaceAssetUrlPattern = /^(?:(?:https?:)?\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/|\/)(?:api\/v1\/workspace\/presentations\/[A-Za-z0-9._-]+\/editor\/)?assets\/([A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp|mp4|svg|html?))$/i;

/** Workspace previews use routed local URLs, but MotionDoc persists assets by their portable path. */
function normalizeWorkspaceAssetUrls(source: string) {
  return source.replace(workspaceAssetUrlAttributePattern, (attribute, _prop: string, _quote: string, staticValue: string | undefined, _expressionQuote: string, expressionValue: string | undefined) => {
    const value = (staticValue ?? expressionValue ?? "").trim();
    const match = value.match(workspaceAssetUrlPattern);
    return match ? attribute.replace(value, `assets/${match[1]}`) : attribute;
  });
}

function assetName(source: string) {
  if (!/^assets\/[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp|mp4|svg|html?)$/i.test(source)) {
    throw new Error("Asset paths must use a supported file in assets/.");
  }
  return source.slice("assets/".length);
}

function normalizedAssetName(value: string) {
  const name = value.startsWith("assets/") ? value.slice(7) : value;
  const requestedExtension = path.extname(name).toLowerCase();
  const extension = [".mp4", ".svg", ".html", ".htm"].includes(requestedExtension) ? requestedExtension : ".webp";
  const base = name
    .replace(/\.(?:webp|mp4|svg|html?)$/i, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  if (!base) throw new Error("Choose a valid asset name.");
  return `${base}${extension}`;
}

function isAssetFileName(value: string) {
  return /^[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp|mp4|svg|html?)$/i.test(value);
}

function assetMimeType(value: string) {
  const extension = path.extname(value).toLowerCase();
  if (extension === ".avif") return "image/avif";
  if (extension === ".gif") return "image/gif";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".html" || extension === ".htm") return "text/html; charset=utf-8";
  return "image/webp";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMp4Upload(file: File) {
  return file.type.toLowerCase().split(";", 1)[0] === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
}

function isSvgUpload(file: File) {
  return file.type.toLowerCase().split(";", 1)[0] === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
}

function exists(filePath: string) {
  return access(filePath).then(() => true, () => false);
}
