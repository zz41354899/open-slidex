import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

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
import { resolveInsideRoot } from "./nodePath";
import {
  applySlideXBatch,
  ensureMotionDocSourceBlockIds,
  parseMotionDoc,
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
      `presentation.mdx changed. Current revision is ${currentRevision}; open it again before saving.`
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
      options.documentPath ?? "presentation.mdx"
    );
  }

  async exists() {
    return access(this.documentPath).then(
      () => true,
      () => false
    );
  }

  async open(): Promise<SlideXDocument> {
    const source = await readFile(this.documentPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new Error(`presentation.mdx does not exist at ${this.documentPath}.`);
      }
      throw error;
    });
    return createSlideXDocument(source);
  }

  async create(source: string, replace = false) {
    await mkdir(path.dirname(this.documentPath), { recursive: true });
    return this.withDocumentLock(async () => {
      if (!replace && (await this.exists())) {
        throw new Error("presentation.mdx already exists. Pass replace=true to replace it.");
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
    const normalizedSource = ensureMotionDocSourceBlockIds(source);
    const summary = summarizeMotionDoc(normalizedSource);
    if (!summary.validation.isValid) {
      throw new Error("The MotionDoc source is invalid and was not written.");
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

  const portableSource = input.projectRoot
    ? await embedSlideXProjectMedia(input.source, input.projectRoot, {
        // Standalone MDX imports currently materialize embedded images. Keep
        // video paths as editable placeholders unless a project bundle carries
        // the video bytes.
        includeVideo: input.format !== "mdx"
      })
    : input.source;

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
