import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

import {
  importSlideXImageAsset,
  SlideXImageAssetError,
  type ImportSlideXImageAssetInput,
  type SlideXImageAsset
} from "./nodeImageAsset";
import {
  importSlideXVideoAsset,
  SlideXVideoAssetError,
  type ImportSlideXVideoAssetInput,
  type SlideXVideoAsset
} from "./nodeVideoAsset";
import {
  ensureDirectoryInsideRoot,
  openExistingFileInsideRoot,
  resolveExistingInsideRoot,
  resolveInsideRoot
} from "./nodePath";
import {
  applySlideXBatch,
  ensureMotionDocSourceBlockIds,
  motionDocToReactPresentationSource,
  parseMotionDoc,
  reactPresentationToMotionDocSource,
  summarizeMotionDoc,
  type SlideXDocument,
  type SlideXDocumentAdapter,
  type SlideXEditCommand,
  type SlideXRevision
} from "./index";
import { buildMotionDocHtml } from "@/core/motion-doc/infrastructure/export/motionDocExport";
import { applyMotionDocTitle } from "@/core/motion-doc/application/motionDocAutomation";
import { exportMotionDocPptx } from "@/core/motion-doc/infrastructure/export/nodePptxExport";
import {
  buildMotionDocRasterHtml,
  MOTION_DOC_PNG_HEIGHT,
  MOTION_DOC_PNG_WIDTH
} from "@/core/motion-doc/infrastructure/export/motionDocExport";
import { prepareSlideXPageForStaticExport, withSlideXChromiumPage } from "./nodeBrowser";
import { embedSlideXProjectMedia } from "./nodeMedia";
import { withSlideXFileLock } from "./nodeFileLock";

export {
  analyzeSlideXDocumentQuality,
  getSlideXQualityCacheStats,
  slideXQualityIssueCodes,
  type AnalyzeSlideXDocumentQualityInput,
  type SlideXQualityIssue,
  type SlideXQualityIssueCode,
  type SlideXQualityReport
} from "./nodeQuality";
export { closeSlideXChromiumPool } from "./nodeBrowser";
export { withSlideXFileLock } from "./nodeFileLock";

export {
  importSlideXImageAsset,
  ensureDirectoryInsideRoot,
  openExistingFileInsideRoot,
  resolveExistingInsideRoot,
  resolveInsideRoot,
  SlideXImageAssetError,
  type ImportSlideXImageAssetInput,
  type SlideXImageAsset
};

export const importOpenSlideXImageAsset = importSlideXImageAsset;
export type ImportOpenSlideXImageAssetInput = ImportSlideXImageAssetInput;
export type OpenSlideXImageAsset = SlideXImageAsset;
export { importSlideXVideoAsset, SlideXVideoAssetError, type ImportSlideXVideoAssetInput, type SlideXVideoAsset };
export const importOpenSlideXVideoAsset = importSlideXVideoAsset;
export type ImportOpenSlideXVideoAssetInput = ImportSlideXVideoAssetInput;
export type OpenSlideXVideoAsset = SlideXVideoAsset;

export type SlideXFileDocumentAdapterOptions = {
  documentPath?: string;
  projectRoot: string;
};

export class SlideXRevisionConflictError extends Error {
  readonly currentRevision: SlideXRevision;

  constructor(currentRevision: SlideXRevision) {
    super(
      `presentation.tsx changed. Current revision is ${currentRevision}; open it again before saving.`
    );
    this.name = "SlideXRevisionConflictError";
    this.currentRevision = currentRevision;
  }
}

export class SlideXFileDocumentAdapter implements SlideXDocumentAdapter {
  readonly documentPath: string;
  readonly projectRoot: string;

  constructor(options: SlideXFileDocumentAdapterOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.documentPath = resolveInsideRoot(
      this.projectRoot,
      options.documentPath ?? "presentation.tsx"
    );
  }

  async exists() {
    return resolveExistingInsideRoot(this.projectRoot, this.documentPath, "file").then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    );
  }

  async open(): Promise<SlideXDocument> {
    const handle = await openExistingFileInsideRoot(this.projectRoot, this.documentPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error(`${path.basename(this.documentPath)} does not exist at ${this.documentPath}.`);
      }
      throw error;
    });
    try {
      return createSlideXDocument(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
  }

  async create(source: string, replace = false) {
    await ensureDirectoryInsideRoot(this.projectRoot, path.dirname(this.documentPath));
    return this.withDocumentLock(async () => {
      if (!replace && (await this.exists())) {
        throw new Error(`${path.basename(this.documentPath)} already exists. Pass replace=true to replace it.`);
      }
      return this.writeValidated(source);
    });
  }

  async save(input: {
    expectedRevision: string;
    source: string;
    title: string;
  }): Promise<SlideXDocument> {
    return this.withDocumentLock(async () => {
      const current = await this.open();
      if (current.revision !== input.expectedRevision) {
        throw new SlideXRevisionConflictError(current.revision);
      }
      const titledSource =
        parseMotionDoc(input.source).title === input.title
          ? input.source
          : applyMotionDocTitle(input.source, input.title).source;
      return this.writeValidated(titledSource);
    });
  }

  async edit(expectedRevision: string, commands: readonly SlideXEditCommand[]) {
    return this.withDocumentLock(async () => {
      const current = await this.open();
      if (current.revision !== expectedRevision) {
        throw new SlideXRevisionConflictError(current.revision);
      }
      const result = applySlideXBatch(current.source, commands);
      return this.writeValidated(result.source);
    });
  }

  private async writeValidated(source: string) {
    const canonicalSource = path.extname(this.documentPath) === ".tsx"
      ? motionDocToReactPresentationSource(source)
      : source;
    if (path.extname(this.documentPath) === ".tsx") {
      await assertReactPresentationCompiles(canonicalSource, path.basename(this.documentPath));
    }
    const normalizedSource = ensureMotionDocSourceBlockIds(canonicalSource);
    const summary = summarizeMotionDoc(normalizedSource);
    if (!summary.validation.isValid) {
      throw new Error("The MotionDoc source is invalid and was not written.");
    }

    const existing = await lstat(this.documentPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
      throw new Error(`The presentation source path is unsafe: ${this.documentPath}`);
    }

    const temporaryPath = path.join(
      path.dirname(this.documentPath),
      `.${path.basename(this.documentPath)}.${process.pid}.${Date.now()}.tmp`
    );
    await writeFile(temporaryPath, normalizedSource, { encoding: "utf8", mode: 0o644 });
    try {
      await rename(temporaryPath, this.documentPath);
      return createSlideXDocument(normalizedSource);
    } finally {
      await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  private async withDocumentLock<T>(action: () => Promise<T>): Promise<T> {
    return withSlideXFileLock(`${this.documentPath}.lock`, action);
  }
}

async function assertReactPresentationCompiles(source: string, sourcefile: string) {
  try {
    await transform(source, {
      format: "esm",
      jsx: "automatic",
      loader: "tsx",
      sourcefile,
      target: "es2022"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`presentation.tsx did not compile and was not written: ${message}`);
  }
}

export function createSlideXRevision(source: string): SlideXRevision {
  return `sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`;
}

export function createSlideXDocument(source: string): SlideXDocument {
  return {
    revision: createSlideXRevision(source),
    source,
    title: parseMotionDoc(source).title
  };
}

export type ExportSlideXDocumentInput = {
  format: "html" | "mdx" | "pptx";
  keepBrowserWarm?: boolean;
  outputPath: string;
  overwrite?: boolean;
  projectRoot?: string;
  source: string;
  title?: string;
};

export async function exportSlideXDocument(input: ExportSlideXDocumentInput) {
  assertValidMotionDoc(input.source);
  const outputPath = path.resolve(input.outputPath);
  if (!input.overwrite && (await fileExists(outputPath))) {
    throw new Error("The output file already exists. Pass overwrite=true to replace it.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });

  const motionDocSource = reactPresentationToMotionDocSource(input.source);
  let portableSource = input.projectRoot
    ? await embedSlideXProjectMedia(motionDocSource, input.projectRoot, {
        // Standalone MDX imports currently materialize embedded images. Keep
        // video paths as editable placeholders unless a project bundle carries
        // the video bytes.
        includeVideo: input.format !== "mdx"
      })
    : motionDocSource;

  if (input.format === "pptx") {
    return exportMotionDocPptx({
      keepBrowserWarm: input.keepBrowserWarm,
      outputPath,
      overwrite: input.overwrite,
      source: portableSource,
      title: input.title
    });
  }

  const contents =
    input.format === "html"
      ? buildMotionDocHtml(portableSource, input.title)
      : portableSource;
  await writeFile(outputPath, contents, "utf8");
  return {
    format: input.format,
    outputPath,
    revision: createSlideXRevision(input.source)
  };
}

export type RenderSlideXDocumentInput = {
  mode: "montage" | "slide";
  outputPath: string;
  projectRoot?: string;
  slideIndex?: number;
  source: string;
  title?: string;
  signal?: AbortSignal;
};

export type RenderSlideXHtmlThumbnailInput = {
  html: string;
  additionalPages?: Array<{ page: number; outputPath: string }>;
  localAssets?: Array<{ bytes: Uint8Array; mimeType: string; name: string }>;
  maximumDurationMs?: number;
  outputPath: string;
  page: number;
  signal?: AbortSignal;
};

const defaultHtmlThumbnailDurationMs = 30_000;
const maximumHtmlThumbnailDurationMs = 60_000;

/** Renders one sandbox-compatible HTML page with its browser-native network resources. */
export async function renderSlideXHtmlThumbnail(input: RenderSlideXHtmlThumbnailInput) {
  const maximumDurationMs = Math.min(
    Number.isSafeInteger(input.maximumDurationMs) && input.maximumDurationMs! > 0
      ? input.maximumDurationMs!
      : defaultHtmlThumbnailDurationMs,
    maximumHtmlThumbnailDurationMs
  );
  const deadlineController = new AbortController();
  const deadlineTimer = setTimeout(() => {
    deadlineController.abort(new Error(`HTML thumbnail rendering exceeded the ${maximumDurationMs} ms time budget.`));
  }, maximumDurationMs);
  deadlineTimer.unref?.();
  const renderSignal = input.signal
    ? AbortSignal.any([input.signal, deadlineController.signal])
    : deadlineController.signal;
  try {
    renderSignal.throwIfAborted();
    if (!input.html.trim()) throw new Error("The HTML source is empty.");
    if (!Number.isInteger(input.page) || input.page < 1) throw new Error("HTML thumbnail page must be a positive integer.");
    const targets = [{ page: input.page, outputPath: input.outputPath }, ...(input.additionalPages ?? [])];
    for (const target of targets) {
      if (!Number.isInteger(target.page) || target.page < 1) throw new Error("HTML thumbnail page must be a positive integer.");
      await mkdir(path.dirname(target.outputPath), { recursive: true });
    }
    await mkdir(path.dirname(input.outputPath), { recursive: true });

    return await withSlideXChromiumPage({
    viewport: { height: MOTION_DOC_PNG_HEIGHT, width: MOTION_DOC_PNG_WIDTH }
  }, async (page) => {
    const localAssetOrigin = "https://open-slidex.local";
    const localAssets = new Map((input.localAssets ?? []).map((asset) => [asset.name, asset]));
    const browserSession = await page.context().newCDPSession(page);
    await browserSession.send("Network.enable");
    await browserSession.send("Network.setBlockedURLs", { urls: ["ws://*", "wss://*"] });
    await page.routeWebSocket(/.*/, async (socket) => {
      await socket.close({ code: 1008, reason: "OpenSlideX HTML thumbnails are offline" });
    });
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      const parsed = new URL(url);
      if (parsed.origin === localAssetOrigin && parsed.pathname.startsWith("/assets/")) {
        const asset = localAssets.get(decodeURIComponent(parsed.pathname.slice("/assets/".length)));
        if (asset) {
          await route.fulfill({ body: Buffer.from(asset.bytes), contentType: asset.mimeType });
          return;
        }
        await route.abort("blockedbyclient");
        return;
      }
      if (/^(?:about:|blob:|data:)/i.test(url)) await route.continue();
      else await route.abort("blockedbyclient");
    });
    const assetBasedHtml = localAssets.size ? injectThumbnailAssetBase(input.html, `${localAssetOrigin}/assets/`) : input.html;
    const html = injectThumbnailOfflinePolicy(assetBasedHtml, localAssetOrigin);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    for (const target of targets) {
    renderSignal.throwIfAborted();
    await page.evaluate(async (requestedPage) => {
      document.querySelectorAll("style[data-open-slidex-thumbnail]").forEach((node) => node.remove());
      const pageNumber = Math.max(1, Math.floor(requestedPage));
      const oldURL = location.href;
      const explicit = [...document.querySelectorAll<HTMLElement>("[data-slidex-page]")]
        .filter((element) => element !== document.documentElement);
      const gamma = [...document.querySelectorAll<HTMLElement>(".gcard.page")]
        .filter((element) => !explicit.includes(element));
      const declared = [...explicit, ...gamma];
      const generic = declared.length || document.querySelector("[data-slidex-slide-index]")
        ? []
        : [...document.querySelectorAll<HTMLElement>(".slide")];
      [...declared, ...generic].forEach((element, index) => {
        const value = Number(element.dataset.slidexPage ?? element.dataset.page ?? index + 1);
        const active = value === pageNumber;
        element.dataset.on = active ? "1" : "0";
        element.setAttribute("aria-hidden", active ? "false" : "true");
        if (element.matches(".gcard.page")) element.classList.toggle("active", active);
        if (generic.length) {
          element.classList.toggle("active", active);
          element.classList.toggle("is-active", active);
          element.style.setProperty("display", active ? "" : "none", active ? "" : "important");
        }
      });
      const nativeSlides = [...document.querySelectorAll<HTMLElement>("[data-slidex-slide-index]")];
      const nativeTarget = nativeSlides.find((element) => Number(element.dataset.slidexSlideIndex) + 1 === pageNumber);
      if (nativeTarget) {
        const targetIndex = pageNumber - 1;
        const dot = document.querySelector<HTMLElement>(`[data-slide-target="${targetIndex}"]`);
        dot?.click();
        nativeSlides.forEach((element) => {
          element.classList.toggle("is-active", element === nativeTarget);
          element.classList.remove("is-leaving");
        });
        document.documentElement.style.height = "100%";
        document.body.style.height = "100%";
        document.body.style.minHeight = "0";
        document.body.style.overflow = "hidden";
        const player = document.querySelector<HTMLElement>(".player");
        const stage = document.querySelector<HTMLElement>(".stage");
        const viewport = document.querySelector<HTMLElement>(".viewport");
        if (player) {
          player.style.height = "100%";
          player.style.minHeight = "0";
          player.style.width = "100%";
        }
        if (stage) {
          stage.style.height = "100%";
          stage.style.minHeight = "0";
          stage.style.padding = "0";
          stage.style.width = "100%";
        }
        if (viewport) {
          viewport.style.setProperty("border-radius", "0", "important");
          viewport.style.setProperty("box-shadow", "none", "important");
          viewport.style.setProperty("height", "100%", "important");
          viewport.style.setProperty("width", "100%", "important");
        }
        document.querySelectorAll<HTMLElement>(".controls,.slide-dots").forEach((element) => {
          element.style.setProperty("display", "none", "important");
        });
        window.dispatchEvent(new Event("resize"));
      }
      document.documentElement.dataset.slidexPage = String(pageNumber);
      const hash = /^#\d+$/.test(location.hash) ? `#${pageNumber}` : `#p${pageNumber}`;
      // A thumbnail may temporarily inject a virtual asset base. Resolve the
      // navigation hash against the document URL, not that asset base.
      if (location.hash !== hash) history.replaceState(null, "", `${oldURL.split("#", 1)[0]}${hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: location.href }));
      await Promise.race([
        document.fonts.ready.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 3_000))
      ]);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const activeCard = document.querySelector<HTMLElement>(
        `.gcard.page[data-on="1"],[data-slidex-page="${pageNumber}"][data-on="1"]`
      );
      const stage = Number(activeCard?.dataset.stage ?? 4);
      const benchmarkWindow = window as Window & {
        IDATree?: { apply?: (stage: number) => void; stop?: () => void };
      };
      if (typeof benchmarkWindow.IDATree?.apply === "function") benchmarkWindow.IDATree.apply(stage);
      benchmarkWindow.IDATree?.stop?.();
      document.getAnimations().forEach((animation) => {
        try { animation.finish(); animation.pause(); } catch { /* Animation may be infinite. */ }
      });
      document.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
        try {
          svg.setCurrentTime?.(1_000_000);
          svg.pauseAnimations?.();
        } catch { /* Unsupported SVG animation API. */ }
      });
      const freeze = document.createElement("style");
      freeze.dataset.openSlidexThumbnail = "";
      freeze.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
      (document.head || document.documentElement).appendChild(freeze);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, target.page);
    renderSignal.throwIfAborted();
    await page.screenshot({ path: target.outputPath, type: "png" });
    }
    return {
      height: MOTION_DOC_PNG_HEIGHT,
      outputPath: input.outputPath,
      page: input.page,
      width: MOTION_DOC_PNG_WIDTH
    };
    }, renderSignal);
  } finally {
    clearTimeout(deadlineTimer);
  }
}

function injectThumbnailOfflinePolicy(source: string, localAssetOrigin: string) {
  const policy = [
    "default-src 'none'",
    `base-uri ${localAssetOrigin}`,
    "connect-src 'none'",
    `font-src data: blob: ${localAssetOrigin}`,
    "form-action 'none'",
    "frame-src 'none'",
    `img-src data: blob: ${localAssetOrigin}`,
    `media-src data: blob: ${localAssetOrigin}`,
    "object-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob:",
    "style-src 'unsafe-inline' data: blob:",
    "worker-src data: blob:"
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  if (/<head\b[^>]*>/i.test(source)) return source.replace(/<head\b[^>]*>/i, (head) => `${head}${meta}`);
  return source.replace(/<html\b[^>]*>/i, (html) => `${html}<head>${meta}</head>`);
}

function injectThumbnailAssetBase(html: string, href: string) {
  if (/<base\b/i.test(html)) throw new Error("Packaged HTML sidecars cannot be combined with a remote <base href>.");
  const base = `<base href="${href}">`;
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (head) => `${head}${base}`);
  return html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${base}</head>`);
}

export async function renderSlideXDocument(input: RenderSlideXDocumentInput) {
  input.signal?.throwIfAborted();
  assertValidMotionDoc(input.source);
  const document = parseMotionDoc(input.source);
  if (document.scenes.length === 0) {
    throw new Error("The MotionDoc has no slides to render.");
  }
  const slideIndex = input.slideIndex ?? 0;
  if (
    input.mode === "slide" &&
    (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= document.scenes.length)
  ) {
    throw new Error(`slideIndex ${slideIndex} is outside the slide range.`);
  }

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  const portableSource = input.projectRoot
    ? await embedSlideXProjectMedia(input.source, input.projectRoot)
    : input.source;
  if (input.mode === "slide") {
    return withSlideXChromiumPage({
        viewport: { height: MOTION_DOC_PNG_HEIGHT, width: MOTION_DOC_PNG_WIDTH }
      }, async (page) => {
      await page.setContent(
        buildMotionDocRasterHtml(portableSource, input.title, [slideIndex]),
        { waitUntil: "networkidle" }
      );
      await prepareSlideXPageForStaticExport(page, input.signal);
      input.signal?.throwIfAborted();
      await page.screenshot({ path: input.outputPath, type: "png" });
      return {
        height: MOTION_DOC_PNG_HEIGHT,
        outputPath: input.outputPath,
        slideIndices: [slideIndex],
        width: MOTION_DOC_PNG_WIDTH
      };
    }, input.signal);
  }

    const columns = document.scenes.length === 1 ? 1 : 2;
    const thumbWidth = 960;
    const thumbHeight = 540;
    const gap = 32;
    const labelHeight = 44;
    const rows = Math.ceil(document.scenes.length / columns);
    const width = columns * thumbWidth + (columns + 1) * gap;
    const height = rows * (thumbHeight + labelHeight) + (rows + 1) * gap;
    const images: string[] = [];

    for (let index = 0; index < document.scenes.length; index += 1) {
      input.signal?.throwIfAborted();
      const buffer = await withSlideXChromiumPage({
        viewport: { height: MOTION_DOC_PNG_HEIGHT, width: MOTION_DOC_PNG_WIDTH }
      }, async (page) => {
        await page.setContent(
          buildMotionDocRasterHtml(portableSource, input.title, [index]),
          { waitUntil: "networkidle" }
        );
        await prepareSlideXPageForStaticExport(page, input.signal);
        input.signal?.throwIfAborted();
        return page.screenshot({ type: "png" });
      }, input.signal);
      images.push(`data:image/png;base64,${buffer.toString("base64")}`);
    }

    await withSlideXChromiumPage({ viewport: { height, width } }, async (page) => {
      await page.setContent(buildMontageHtml(images, columns, thumbWidth, thumbHeight, gap));
      input.signal?.throwIfAborted();
      await page.screenshot({ path: input.outputPath, type: "png" });
    }, input.signal);
    return {
      height,
      outputPath: input.outputPath,
      slideIndices: document.scenes.map((_scene, index) => index),
      width
    };
}

function assertValidMotionDoc(source: string) {
  const summary = summarizeMotionDoc(source);
  if (summary.validation.isValid) return;

  const messages = summary.validation.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message)
    .join(" ");
  throw new Error(`The MotionDoc source is invalid. ${messages}`.trim());
}

async function fileExists(filePath: string) {
  return access(filePath).then(
    () => true,
    () => false
  );
}

function buildMontageHtml(
  images: readonly string[],
  columns: number,
  width: number,
  height: number,
  gap: number
) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #111; }
    main { display: grid; grid-template-columns: repeat(${columns}, ${width}px); gap: ${gap}px; padding: ${gap}px; }
    figure { margin: 0; }
    img { display: block; width: ${width}px; height: ${height}px; object-fit: cover; }
    figcaption { color: #fff; font: 600 24px/44px system-ui; height: 44px; }
  </style>
</head>
<body>
  <main>${images
    .map(
      (image, index) =>
        `<figure><img alt="Slide ${index + 1}" src="${image}"><figcaption>${index + 1}</figcaption></figure>`
    )
    .join("")}</main>
</body>
</html>`;
}

export {
  createSlideXDocument as createOpenSlideXDocument,
  createSlideXRevision as createOpenSlideXRevision,
  exportSlideXDocument as exportOpenSlideXDocument,
  renderSlideXDocument as renderOpenSlideXDocument,
  SlideXFileDocumentAdapter as OpenSlideXFileDocumentAdapter,
  SlideXRevisionConflictError as OpenSlideXRevisionConflictError
};
