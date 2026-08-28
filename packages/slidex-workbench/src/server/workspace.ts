import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  applySlideXBatch,
  blankPresentationMdx,
  buildMotionDocPngSvg,
  getOfficialTemplatePackage,
  isOpenSlideXLocalAssetSource,
  listSlideXAssetReferences,
  officialTemplatePackages,
  parseMotionDoc,
  stripNonLocalMotionDocMedia,
  validateOpenSlideXLocalMedia,
  type TemplatePackageLocale
} from "@open-slidex/sdk";
import {
  importOpenSlideXImageAsset,
  importOpenSlideXVideoAsset,
  renderSlideXDocument
} from "@open-slidex/sdk/node";

import { SlideXProject } from "./project";
import { assertSandboxedHtml } from "./htmlImportPolicy";
import { renderOfficialTemplateCover } from "./templateCover";
import { copyBundledOfficialTemplateAssets } from "./officialTemplateAssets";
import { readWorkspaceImport, type WorkspaceHtmlSidecar } from "./workspaceImport";

export type LocalWorkspacePresentation = {
  cover: string;
  id: string;
  slideCount: number;
  title: string;
  updatedAt: string;
};

export type LocalWorkspaceTemplate = {
  author: string;
  category: string;
  cover: string;
  description: string;
  featured: boolean;
  id: string;
  name: string;
  slideCount: number;
  tags: string[];
  useCase: string;
  version: string;
};

export type LocalWorkspaceSnapshot = {
  locale: TemplatePackageLocale;
  name: string;
  presentations: LocalWorkspacePresentation[];
  root: string;
  templates: LocalWorkspaceTemplate[];
};

export type CreateWorkspacePresentationInput = {
  locale?: unknown;
  templateId?: unknown;
  templateVersion?: unknown;
  title?: unknown;
};

export type RenameWorkspacePresentationInput = {
  title?: unknown;
};

export type DeleteWorkspacePresentationInput = {
  confirmationTitle?: unknown;
};

const PRESENTATION_COVER_RENDER_VERSION = 2;

export class OpenSlideXWorkspace {
  private readonly presentationCoverCache = new Map<string, { revision: string; svg: string }>();
  private readonly presentationCoverRenders = new Map<string, Promise<string>>();
  readonly mcpPresentationRoot?: string;
  readonly root: string;
  readonly stateRoot: string;
  readonly templateRoot: string;
  readonly workspaceUrl?: string;

  constructor(input: { mcpPresentationRoot?: string; root: string; templateRoot: string; workspaceUrl?: string }) {
    this.mcpPresentationRoot = input.mcpPresentationRoot ? path.resolve(input.mcpPresentationRoot) : undefined;
    this.root = path.resolve(input.root);
    this.stateRoot = path.join(this.root, ".open-slidex-workspace");
    this.templateRoot = path.resolve(input.templateRoot);
    this.workspaceUrl = input.workspaceUrl;
  }

  async prepare() {
    await mkdir(this.root, { recursive: true });
    await mkdir(this.stateRoot, { recursive: true });
  }

  async snapshot(locale: TemplatePackageLocale): Promise<LocalWorkspaceSnapshot> {
    return {
      locale,
      name: path.basename(this.root) || "OpenSlideX Workspace",
      presentations: await this.listPresentations(),
      root: this.root,
      templates: officialTemplatePackages.map((template) => ({
        author: template.catalog.author,
        category: template.catalog.category,
        cover: `/api/v1/workspace/templates/${template.id}/cover.svg?locale=${encodeURIComponent(locale)}&version=${encodeURIComponent(template.version)}&preview=2`,
        description: template.locales[locale].description,
        featured: template.catalog.featured,
        id: template.id,
        name: template.locales[locale].name,
        slideCount: template.catalog.slideCount,
        tags: [...template.catalog.tags],
        useCase: template.locales[locale].useCase,
        version: template.version
      }))
    };
  }

  async listPresentations(): Promise<LocalWorkspacePresentation[]> {
    const entries = await readdir(this.root, { withFileTypes: true });
    const presentations = await Promise.all(entries.flatMap((entry) => {
      if (!entry.isDirectory() || entry.name.startsWith(".")) return [];
      return [this.presentationSummary(entry.name)];
    }));
    return presentations
      .filter((item): item is LocalWorkspacePresentation => Boolean(item))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(value: CreateWorkspacePresentationInput) {
    const title = parseTitle(value.title);
    const locale = parseLocale(value.locale);
    const template = parseTemplate(value.templateId, value.templateVersion);
    const id = await this.availableProjectId(title);
    const target = this.projectPath(id);

    await this.seedProject(target);
    try {
      await resetGeneratedProjectState(target);
      await replaceProjectName(target, id);
      if (template) await copyBundledOfficialTemplateAssets(template, target);
      const source = withDocumentTitle(
        template ? template.sources[locale] : blankPresentationMdx,
        title
      );
      await writeFile(path.join(target, "presentation.mdx"), source, "utf8");
      if (template) {
        await writeJson(path.join(target, ".open-slidex", "template-lock.json"), {
          id: template.id,
          locale,
          version: template.version
        });
      }
    } catch (error) {
      await rm(target, { force: true, recursive: true });
      throw error;
    }

    const presentation = await this.presentationSummary(id);
    if (!presentation) throw new Error("The local presentation was created but could not be opened.");
    return presentation;
  }

  async importMdx(file: File, htmlSidecars: WorkspaceHtmlSidecar[] = []) {
    const imported = await readWorkspaceImport(
      file,
      (source) => listSlideXAssetReferences(source).map((reference) => reference.source),
      (source) => this.recoverWorkspaceAsset(source),
      { htmlSidecars, mdxSidecars: htmlSidecars }
    );
    const source = imported.source;

    let document: ReturnType<typeof parseMotionDoc>;
    try {
      document = parseMotionDoc(source);
    } catch (error) {
      throw Object.assign(new Error(error instanceof Error ? `Invalid MotionDoc MDX: ${error.message}` : "Invalid MotionDoc MDX."), { status: 400 });
    }
    if (!document.scenes.length) {
      throw Object.assign(new Error("The MDX file does not contain any valid <Slide> scenes."), { status: 400 });
    }

    const fallbackTitle = file.name.replace(/\.mdx$/i, "") || "Imported presentation";
    const title = parseTitle(document.title || fallbackTitle);
    const normalizedSource = document.title ? source : withDocumentTitle(source, title);
    const id = await this.availableProjectId(title);
    const target = this.projectPath(id);

    await this.seedProject(target);
    try {
      await resetGeneratedProjectState(target);
      await replaceProjectName(target, id);
      if (imported.html) {
        await writeFile(path.join(target, imported.html.source), imported.html.bytes);
      }
      const commands = [];
      for (const asset of imported.assets) {
        if (asset.preserveOriginal || asset.mediaType === "image/svg+xml" || asset.mediaType === "text/html") {
          await writeFile(path.join(target, asset.source), asset.bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
            if (error.code !== "EEXIST") throw error;
          });
          continue;
        }
        if (asset.mediaType === "video/mp4") {
          const stored = await importOpenSlideXVideoAsset({
            bytes: asset.bytes,
            fileName: asset.fileName,
            mediaType: asset.mediaType,
            projectRoot: target
          });
          if (stored.source !== asset.source) {
            commands.push({ from: asset.source, to: stored.source, type: "asset.repath" } as const);
          }
          continue;
        }
        const stored = await importOpenSlideXImageAsset({
          bytes: asset.bytes,
          fileName: asset.fileName,
          mediaType: asset.mediaType,
          projectRoot: target
        });
        if (stored.source !== asset.source) {
          commands.push({ from: asset.source, to: stored.source, type: "asset.repath" } as const);
        }
      }
      const importedSource = commands.length > 0
        ? applySlideXBatch(normalizedSource, commands).source
        : normalizedSource;
      const localMedia = validateOpenSlideXLocalMedia(importedSource);
      if (!localMedia.isValid) {
        throw Object.assign(new Error(localMedia.issues[0]?.message ?? "The imported presentation contains unsupported media."), { status: 400 });
      }
      await writeFile(path.join(target, "presentation.mdx"), importedSource, "utf8");
    } catch (error) {
      await rm(target, { force: true, recursive: true });
      throw error;
    }

    const presentation = await this.presentationSummary(id);
    if (!presentation) throw new Error("The presentation was imported but could not be opened.");
    return presentation;
  }

  async presentationCover(id: string) {
    const root = await this.existingProjectRoot(id);
    const document = await new SlideXProject(root).open();
    const cached = this.presentationCoverCache.get(id);
    if (cached?.revision === document.revision) return cached.svg;

    const renderKey = `${id}:${document.revision}`;
    const pending = this.presentationCoverRenders.get(renderKey);
    if (pending) return pending;

    const rendering = this.renderPresentationCover({
      id,
      revision: document.revision,
      root,
      source: stripNonLocalMotionDocMedia(document.source),
      title: document.title
    }).then((svg) => {
      this.presentationCoverCache.set(id, { revision: document.revision, svg });
      return svg;
    }).finally(() => {
      this.presentationCoverRenders.delete(renderKey);
    });
    this.presentationCoverRenders.set(renderKey, rendering);
    return rendering;
  }

  async templateCover(value: { id: string; locale: TemplatePackageLocale; slideIndex?: number; version: string }) {
    return renderOfficialTemplateCover({
      cacheRoot: path.join(this.stateRoot, "template-covers"),
      projectRoot: this.root,
      ...value
    });
  }

  async open(id: string) {
    await this.existingProjectRoot(id);
    const base = this.workspaceUrl?.replace(/\/$/, "") ?? "/workspace";
    return `${base}/${encodeURIComponent(id)}`;
  }

  async project(id: string) {
    const project = new SlideXProject(await this.existingProjectRoot(id));
    await project.prepare();
    return project;
  }

  async renamePresentation(id: string, value: RenameWorkspacePresentationInput) {
    const title = parseTitle(value.title);
    const root = await this.existingProjectRoot(id);
    const project = new SlideXProject(root);
    const document = await project.open();
    if (document.title !== title) {
      await project.save({
        expectedRevision: document.revision,
        source: withDocumentTitle(document.source, title),
        title
      });
    }
    const presentation = await this.presentationSummary(id);
    if (!presentation) throw new Error("The local presentation was renamed but could not be read.");
    return presentation;
  }

  async deletePresentation(id: string, value: DeleteWorkspacePresentationInput) {
    const root = await this.existingProjectRoot(id);
    const document = await new SlideXProject(root).open();
    if (typeof value.confirmationTitle !== "string" || value.confirmationTitle !== document.title) {
      throw Object.assign(new Error("Enter the exact presentation title to confirm deletion."), { status: 400 });
    }

    const trashRoot = path.join(this.stateRoot, "trash");
    await mkdir(trashRoot, { recursive: true });
    const suffix = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const target = path.join(trashRoot, `${id}-${suffix}`);
    await rename(root, target);
    return { deleted: true as const, recoverableFrom: target };
  }

  private async presentationSummary(id: string): Promise<LocalWorkspacePresentation | null> {
    try {
      const root = await this.existingProjectRoot(id);
      const documentPath = path.join(root, "presentation.mdx");
      const [document, fileStats] = await Promise.all([new SlideXProject(root).open(), stat(documentPath)]);
      return {
        cover: `/api/v1/workspace/presentations/${encodeURIComponent(id)}/cover.svg`,
        id,
        slideCount: parseMotionDoc(document.source).scenes.length,
        title: document.title || id,
        updatedAt: fileStats.mtime.toISOString()
      };
    } catch {
      return null;
    }
  }

  private async renderPresentationCover(input: {
    id: string;
    revision: string;
    root: string;
    source: string;
    title: string;
  }) {
    const coverRoot = path.join(this.stateRoot, "covers");
    const coverPath = path.join(coverRoot, `${input.id}.png`);
    const metadataPath = path.join(coverRoot, `${input.id}.json`);
    await mkdir(coverRoot, { recursive: true });

    const metadata = await readCoverMetadata(metadataPath);
    if (
      metadata?.renderVersion === PRESENTATION_COVER_RENDER_VERSION &&
      metadata.revision === input.revision
    ) {
      const cachedPng = await readFile(coverPath).catch(() => null);
      if (cachedPng) return buildEmbeddedPngCoverSvg(cachedPng, input.title);
    }

    const temporaryPath = `${coverPath}.${process.pid}.${Date.now()}.tmp.png`;
    try {
      const htmlCover = firstHtmlCover(input.source);
      if (htmlCover) {
        const png = await new SlideXProject(input.root).renderHtmlThumbnail(htmlCover.source, htmlCover.page);
        await writeFile(temporaryPath, png);
      } else {
        await renderSlideXDocument({
          mode: "slide",
          outputPath: temporaryPath,
          projectRoot: input.root,
          slideIndex: 0,
          source: input.source,
          title: input.title
        });
      }
      await rename(temporaryPath, coverPath);
      await writeFile(metadataPath, `${JSON.stringify({
        renderVersion: PRESENTATION_COVER_RENDER_VERSION,
        revision: input.revision
      })}\n`, "utf8");
      return buildEmbeddedPngCoverSvg(await readFile(coverPath), input.title);
    } catch {
      await rm(temporaryPath, { force: true });
      return buildMotionDocPngSvg(input.source, 0, input.title);
    }
  }

  private async existingProjectRoot(id: string) {
    assertProjectId(id);
    const candidate = this.projectPath(id);
    const [canonicalWorkspace, canonicalProject] = await Promise.all([
      realpath(this.root),
      realpath(candidate).catch(() => "")
    ]);
    if (!canonicalProject || !canonicalProject.startsWith(`${canonicalWorkspace}${path.sep}`)) {
      throw Object.assign(new Error("The requested local presentation was not found."), { status: 404 });
    }
    const documentStats = await stat(path.join(canonicalProject, "presentation.mdx")).catch(() => null);
    if (!documentStats?.isFile()) {
      throw Object.assign(new Error("The requested local presentation was not found."), { status: 404 });
    }
    return canonicalProject;
  }

  private projectPath(id: string) {
    assertProjectId(id);
    return path.join(this.root, id);
  }

  /**
   * A Workspace deck must remain creatable after npm installation even if a
   * packaged starter folder was moved or omitted. The template adds optional
   * project conveniences; the MotionDoc and local state are created below.
   */
  private async seedProject(target: string) {
    const templateStats = await stat(this.templateRoot).catch(() => null);
    if (templateStats?.isDirectory()) {
      await cp(this.templateRoot, target, { errorOnExist: true, force: false, recursive: true });
      return;
    }
    await mkdir(target, { recursive: false });
  }

  /**
   * Lightweight MDX exports retain local asset paths. Reuse a typed asset from
   * another active or recoverable deck so HTML can round-trip without Base64
   * or a second archive format.
   */
  private async recoverWorkspaceAsset(source: string) {
    if (!isOpenSlideXLocalAssetSource(source)) return undefined;
    const extension = path.posix.extname(source).toLowerCase();
    const mediaType = extension === ".webp"
      ? "image/webp"
      : extension === ".html" || extension === ".htm"
        ? "text/html"
        : undefined;
    if (!mediaType) return undefined;
    const fileName = path.posix.basename(source);
    for (const projectRoot of await this.workspaceProjectRoots()) {
      const candidate = path.join(projectRoot, "assets", fileName);
      const [canonicalProjectRoot, canonicalAssetPath] = await Promise.all([
        realpath(projectRoot).catch(() => ""),
        realpath(candidate).catch(() => "")
      ]);
      if (!canonicalProjectRoot || !canonicalAssetPath.startsWith(`${canonicalProjectRoot}${path.sep}`)) continue;
      const assetStats = await lstat(canonicalAssetPath).catch(() => null);
      const maximumBytes = mediaType === "text/html" ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
      if (!assetStats?.isFile() || assetStats.size > maximumBytes) continue;
      const bytes = new Uint8Array(await readFile(canonicalAssetPath));
      if (mediaType === "text/html") {
        try {
          assertSandboxedHtml(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          continue;
        }
      }
      return {
        bytes,
        fileName,
        mediaType,
        source
      };
    }
    return undefined;
  }

  private async workspaceProjectRoots() {
    const [activeProjects, recoverableProjects] = await Promise.all([
      directChildDirectories(this.root),
      directChildDirectories(path.join(this.stateRoot, "trash"))
    ]);
    return [...activeProjects, ...recoverableProjects];
  }

  private async availableProjectId(title: string) {
    const base = projectSlug(title);
    for (let index = 0; index < 1_000; index += 1) {
      const id = index === 0 ? base : `${base}-${index + 1}`;
      if (!await stat(this.projectPath(id)).then(() => true, () => false)) return id;
    }
    throw new Error("Could not allocate a local presentation folder.");
  }

}

async function readCoverMetadata(filePath: string) {
  const contents = await readFile(filePath, "utf8").catch(() => "");
  if (!contents) return null;
  try {
    const value = JSON.parse(contents) as { renderVersion?: unknown; revision?: unknown };
    return typeof value.revision === "string" ? {
      renderVersion: typeof value.renderVersion === "number" ? value.renderVersion : 1,
      revision: value.revision
    } : null;
  } catch {
    return null;
  }
}

function firstHtmlCover(source: string) {
  const firstScene = parseMotionDoc(source).scenes[0];
  const block = firstScene?.blocks.find((candidate) => candidate.type === "HtmlEmbedBlock");
  if (!block || typeof block.props.src !== "string") return null;
  const page = Number(block.props.page ?? 1);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    source: block.props.src
  };
}

function buildEmbeddedPngCoverSvg(png: Buffer, title: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <title>${escapeXml(title || "OpenSlideX presentation cover")}</title>
  <image width="1920" height="1080" href="data:image/png;base64,${png.toString("base64")}" preserveAspectRatio="xMidYMid slice" />
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function directChildDirectories(root: string) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(root, entry.name));
}

function parseLocale(value: unknown): TemplatePackageLocale {
  return value === "zh-TW" ? "zh-TW" : "en";
}

function parseTemplate(id: unknown, version: unknown) {
  if (id === undefined || id === null || id === "") return undefined;
  if (typeof id !== "string" || typeof version !== "string") {
    throw Object.assign(new Error("A template id and version are required together."), { status: 400 });
  }
  const template = getOfficialTemplatePackage(id, version);
  if (!template) throw Object.assign(new Error(`Official template is unavailable: ${id}@${version}`), { status: 404 });
  return template;
}

function parseTitle(value: unknown) {
  if (typeof value !== "string") throw Object.assign(new Error("A presentation title is required."), { status: 400 });
  const title = value.replace(/[\r\n\t]+/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 80);
  if (!title) throw Object.assign(new Error("A presentation title is required."), { status: 400 });
  return title;
}

function projectSlug(title: string) {
  const ascii = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  if (ascii) return ascii;
  return `presentation-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
}

function assertProjectId(id: string) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(id) || id === "." || id === "..") {
    throw Object.assign(new Error("The requested local presentation was not found."), { status: 404 });
  }
}

function withDocumentTitle(source: string, title: string) {
  return /^#\s+.*$/m.test(source) ? source.replace(/^#\s+.*$/m, `# ${title}`) : `# ${title}\n\n${source}`;
}

async function resetGeneratedProjectState(root: string) {
  const stateRoot = path.join(root, ".open-slidex");
  await rm(stateRoot, { force: true, recursive: true });
  await Promise.all([
    mkdir(stateRoot, { recursive: true }),
    mkdir(path.join(root, "assets"), { recursive: true }),
    mkdir(path.join(root, "dist"), { recursive: true }),
    mkdir(path.join(root, "knowledge"), { recursive: true })
  ]);
}

async function replaceProjectName(root: string, projectName: string) {
  const packagePath = path.join(root, "package.json");
  const parsed = JSON.parse(await readFile(packagePath, "utf8").catch(() => "{}")) as Record<string, unknown>;
  parsed.name = projectName;
  parsed.private = true;
  await writeFile(packagePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

async function writeJson(filePath: string, value: unknown) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}
