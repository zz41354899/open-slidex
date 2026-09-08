import { extname, posix, relative } from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import JSZip, { type JSZipObject } from "jszip";
import sharp from "sharp";
import { importSlideXImageAsset, resolveInsideRoot } from "@open-slidex/sdk/node";

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_PPTX_ENTRIES = 2_000;
const MAX_PPTX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_PPTX_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_PPTX_MEDIA_BYTES = 25 * 1024 * 1024;
const MAX_PPTX_IMAGE_FRAMES = 1_000;
const MAX_PPTX_UNIQUE_MEDIA = 256;
const MAX_PPTX_IMAGE_PIXELS = 120_000_000;
const MAX_PPTX_IMAGE_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_PPTX_IMAGE_PIXELS_PER_MEDIA = 40_000_000;
const PPTX_SLIDE_CONCURRENCY = 4;
const PPTX_IMAGE_CONCURRENCY = 2;
const MAX_SLIDES = 200;
const MAX_TEXT_PER_SLIDE = 16_000;
const defaultPageSize = { cx: 13_333_333, cy: 7_500_000 };

export type OpenSlideXImportImage = {
  alt: string;
  geometry: { h: number; w: number; x: number; y: number };
  geometryWarning?: string;
  id: string;
  imageBlock?: string;
  reason?: string;
  source?: string;
  sourceName: string;
  status: "imported" | "missing" | "not_imported" | "unsupported";
  zIndex: number;
};
export type OpenSlideXImportTextFrame = {
  alignment?: "center" | "justify" | "left" | "right";
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: number;
  geometry: { h: number; w: number; x: number; y: number };
  geometryWarning?: string;
  id: string;
  text: string;
  textBlock: string;
  titleHint: boolean;
  zIndex: number;
};
export type OpenSlideXImportSlide = { imageCount: number; images: OpenSlideXImportImage[]; index: number; text: string[]; textFrames: OpenSlideXImportTextFrame[]; title?: string };
export type OpenSlideXSourceImport = {
  conversionBoundary: string; format: "pptx"; sourceFile: string; sourceTitle?: string;
  summary: { imageCount: number; slideCount: number; textBlockCount: number }; warnings: string[]; slides: OpenSlideXImportSlide[];
};

export async function readOpenSlideXSourceImport(projectRoot: string, requestedPath: string, options: { importMedia?: boolean } = {}): Promise<OpenSlideXSourceImport> {
  if (!requestedPath || /^(?:data|blob|https?):/i.test(requestedPath)) throw new Error("filePath must be a root-confined local .pptx file.");
  const extension = extname(requestedPath).toLowerCase();
  if (extension !== ".pptx") throw new Error("Source import supports .pptx files only.");
  const inputPath = resolveInsideRoot(projectRoot, requestedPath);
  const inputStats = await stat(inputPath);
  if (!inputStats.isFile() || inputStats.size < 1 || inputStats.size > MAX_SOURCE_BYTES) throw new Error("The source file must be a regular file between 1 byte and 100 MB.");
  const canonicalRoot = await realpath(projectRoot);
  const canonicalInput = resolveInsideRoot(canonicalRoot, await realpath(inputPath));
  const sourceFile = relative(canonicalRoot, canonicalInput).split("\\").join("/");
  return readPptxSource(await readFile(canonicalInput), sourceFile, canonicalRoot, Boolean(options.importMedia));
}

async function readPptxSource(bytes: Buffer, sourceFile: string, projectRoot: string, importMedia: boolean) {
  let archive: JSZip;
  try { archive = await JSZip.loadAsync(bytes, { createFolders: false }); } catch { throw new Error("The source .pptx is not a valid Office Open XML archive."); }
  const entries = Object.values(archive.files);
  if (entries.length > MAX_PPTX_ENTRIES) throw new Error(`The source .pptx contains more than ${MAX_PPTX_ENTRIES} entries.`);
  let uncompressedBytes = 0;
  for (const entry of entries) {
    assertSafeArchiveEntry(entry);
    uncompressedBytes += uncompressedSize(entry);
    if (uncompressedBytes > MAX_PPTX_UNCOMPRESSED_BYTES) throw new Error("The expanded source .pptx exceeds 100 MB.");
  }
  const reader = new PptxArchiveReader(MAX_PPTX_UNCOMPRESSED_BYTES);
  const orderedSlides = await pptxSlideEntries(archive, reader);
  if (!orderedSlides.length) throw new Error("The source .pptx contains no readable slides.");
  if (orderedSlides.length > MAX_SLIDES) throw new Error(`The source .pptx contains more than ${MAX_SLIDES} slides.`);
  const pageSize = pptxPageSize(await reader.text(archive.file("ppt/presentation.xml")));
  const media = new PptxMediaImporter(archive, reader, projectRoot, importMedia);
  const parsed = await mapWithConcurrency(orderedSlides, PPTX_SLIDE_CONCURRENCY, async ({ entry, path }, index) => pptxSlide({
    archive,
    index,
    media,
    pageSize,
    reader,
    slidePath: path,
    xml: await reader.text(entry) ?? ""
  }));
  return completeImport(sourceFile, firstText(await reader.text(archive.file("docProps/core.xml"))), parsed.map(({ slide }) => slide), [
    "PPTX text frames preserve recovered geometry, typography hints, reading order, and ready-to-review native Text blocks; image frames preserve geometry and z-order.",
    "Themes, animations, SmartArt, and unsupported charts remain semantic or visual references and are not copied verbatim.",
    importMedia ? "Only images with status imported have portable assets/... sources and may be authored as ImageBlock layers." : "Image frames include original geometry but no assets are written. Call import-media before authoring ImageBlock layers.",
    ...parsed.flatMap(({ warnings }) => warnings)
  ]);
}

async function pptxSlideEntries(archive: JSZip, reader: PptxArchiveReader): Promise<Array<{ entry: JSZipObject; path: string }>> {
  const presentation = await reader.text(archive.file("ppt/presentation.xml"));
  const relationships = await reader.text(archive.file("ppt/_rels/presentation.xml.rels"));
  if (presentation && relationships) {
    const targets = new Map<string, string>();
    for (const match of relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/gi)) {
      const id = attribute(match[1] ?? "", "Id"); const target = attribute(match[1] ?? "", "Target");
      if (id && target && /^slides\/slide\d+\.xml$/i.test(target)) targets.set(id, `ppt/${target}`);
    }
    const ordered = [...presentation.matchAll(/<p:sldId\b([^>]*)\/?>(?:<\/p:sldId>)?/gi)]
      .map((match) => attribute(match[1] ?? "", "r:id")).flatMap((id) => id && targets.get(id) ? [targets.get(id)!] : [])
      .flatMap((entryPath) => { const entry = archive.file(entryPath); return entry ? [{ entry, path: entryPath }] : []; });
    if (ordered.length) return ordered;
  }
  return Object.values(archive.files).filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((left, right) => numericSlideName(left.name) - numericSlideName(right.name)).map((entry) => ({ entry, path: entry.name }));
}

async function pptxSlide(input: { archive: JSZip; index: number; media: PptxMediaImporter; pageSize: { cx: number; cy: number }; reader: PptxArchiveReader; slidePath: string; xml: string }) {
  const textFrames = [...input.xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/gi)]
    .map((shape, zIndex) => pptxTextFrame(shape[0], input.index, zIndex, input.pageSize))
    .filter((frame): frame is OpenSlideXImportTextFrame => Boolean(frame));
  const blocks = textFrames.length ? textFrames.map((frame) => frame.text) : [textFromXml(input.xml)].filter(Boolean).map(limitText);
  const imported = await pptxSlideImages(input);
  const title = textFrames.find((frame) => frame.titleHint)?.text ?? blocks[0];
  return { slide: { imageCount: imported.images.length, images: imported.images, index: input.index, text: blocks, textFrames, ...(title ? { title } : {}) }, warnings: imported.warnings };
}

async function pptxSlideImages(input: { archive: JSZip; index: number; media: PptxMediaImporter; pageSize: { cx: number; cy: number }; reader: PptxArchiveReader; slidePath: string; xml: string }) {
  const relationships = await input.reader.text(input.archive.file(relationshipPath(input.slidePath)));
  const targets = new Map<string, string>();
  if (relationships) for (const match of relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/gi)) {
    const id = attribute(match[1] ?? "", "Id"); const target = attribute(match[1] ?? "", "Target"); const targetMode = attribute(match[1] ?? "", "TargetMode");
    if (id && target && targetMode?.toLowerCase() !== "external") targets.set(id, resolvePptxTarget(input.slidePath, target));
  }
  const warnings: string[] = [];
  const pictures = [...input.xml.matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/gi)];
  input.media.reserveFrames(pictures.length);
  const images = await Promise.all(pictures.map(async (picture, zIndex) => {
    const fragment = picture[0]; const embedId = attribute(fragment.match(/<a:blip\b([^>]*)\/?>(?:<\/a:blip>)?/i)?.[1] ?? "", "r:embed");
    const sourceName = posix.basename(targets.get(embedId ?? "") ?? `pptx-image-${zIndex + 1}`); const geometry = frameGeometry(fragment, input.pageSize);
    const base = { alt: pictureAlt(fragment, sourceName), geometry: geometry.value, ...(geometry.warning ? { geometryWarning: geometry.warning } : {}), id: `pptx-slide-${input.index + 1}-image-${zIndex + 1}`, sourceName, zIndex };
    const target = embedId ? targets.get(embedId) : undefined; const media = target ? input.archive.file(target) : undefined;
    if (!media || media.dir) { const reason = "The PowerPoint image relationship does not point to an embedded media file."; warnings.push(`Slide ${input.index + 1} image ${zIndex + 1}: ${reason}`); return { ...base, reason, status: "missing" as const }; }
    const mediaType = imageMediaType(sourceName);
    if (!mediaType) { const reason = `Unsupported PPTX image format: ${extname(sourceName) || "unknown"}.`; warnings.push(`Slide ${input.index + 1} image ${zIndex + 1}: ${reason}`); return { ...base, reason, status: "unsupported" as const }; }
    if (!input.media.enabled) return { ...base, status: "not_imported" as const };
    try {
      const asset = await input.media.import(target!, sourceName, mediaType);
      const image = { ...base, source: asset.source, status: "imported" as const };
      return { ...image, imageBlock: imageBlockMdx(image) };
    }
    catch (error) {
      if (error instanceof PptxResourceLimitError) throw error;
      const reason = error instanceof Error ? error.message : "The image could not be converted to WebP.";
      warnings.push(`Slide ${input.index + 1} image ${zIndex + 1}: ${reason}`);
      return { ...base, reason, status: "unsupported" as const };
    }
  }));
  return { images, warnings };
}

class PptxResourceLimitError extends Error {}

class PptxArchiveReader {
  private readonly cache = new Map<string, Promise<Uint8Array>>();
  private expandedBytes = 0;

  constructor(private readonly maximumExpandedBytes: number) {}

  bytes(entry: JSZipObject, maximumEntryBytes = MAX_PPTX_ENTRY_BYTES) {
    const existing = this.cache.get(entry.name);
    if (existing) return existing;
    const pending = readBoundedPptxEntry(entry, {
      add: (bytes) => {
        if (this.expandedBytes + bytes > this.maximumExpandedBytes) {
          throw new PptxResourceLimitError("The expanded source .pptx exceeds 100 MB.");
        }
        this.expandedBytes += bytes;
      }
    }, maximumEntryBytes);
    this.cache.set(entry.name, pending);
    return pending;
  }

  async text(entry: JSZipObject | null | undefined) {
    if (!entry || entry.dir) return undefined;
    return Buffer.from(await this.bytes(entry)).toString("utf8");
  }
}

class PptxMediaImporter {
  private frameCount = 0;
  private imageOutputBytes = 0;
  private imagePixels = 0;
  private readonly cache = new Map<string, Promise<Awaited<ReturnType<typeof importSlideXImageAsset>>>>();
  private readonly run = concurrencyLimiter(PPTX_IMAGE_CONCURRENCY);

  constructor(
    private readonly archive: JSZip,
    private readonly reader: PptxArchiveReader,
    private readonly projectRoot: string,
    readonly enabled: boolean
  ) {}

  reserveFrames(count: number) {
    this.frameCount += count;
    if (this.frameCount > MAX_PPTX_IMAGE_FRAMES) {
      throw new PptxResourceLimitError(`The source .pptx contains more than ${MAX_PPTX_IMAGE_FRAMES} picture frames.`);
    }
  }

  import(target: string, sourceName: string, mediaType: NonNullable<ReturnType<typeof imageMediaType>>) {
    const existing = this.cache.get(target);
    if (existing) return existing;
    if (this.cache.size >= MAX_PPTX_UNIQUE_MEDIA) {
      throw new PptxResourceLimitError(`The source .pptx contains more than ${MAX_PPTX_UNIQUE_MEDIA} unique embedded images.`);
    }
    const media = this.archive.file(target);
    if (!media || media.dir) throw new Error("The PowerPoint image relationship does not point to an embedded media file.");
    const pending = this.run(async () => {
      const bytes = await this.reader.bytes(media, MAX_PPTX_MEDIA_BYTES);
      let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
      try {
        metadata = await sharp(bytes, {
          animated: true,
          failOn: "error",
          limitInputPixels: MAX_PPTX_IMAGE_PIXELS_PER_MEDIA
        }).metadata();
      } catch {
        throw new Error("The embedded PowerPoint image could not be decoded safely.");
      }
      const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      if (!pixels || pixels > MAX_PPTX_IMAGE_PIXELS_PER_MEDIA || (metadata.pages ?? 1) !== 1) {
        throw new Error("The embedded PowerPoint image dimensions are not allowed.");
      }
      if (this.imagePixels + pixels > MAX_PPTX_IMAGE_PIXELS) {
        throw new PptxResourceLimitError("The source .pptx exceeds the aggregate embedded-image pixel budget.");
      }
      this.imagePixels += pixels;
      const asset = await importSlideXImageAsset({
        bytes,
        fileName: sourceName,
        mediaType,
        projectRoot: this.projectRoot
      });
      if (this.imageOutputBytes + asset.bytes > MAX_PPTX_IMAGE_OUTPUT_BYTES) {
        throw new PptxResourceLimitError("The source .pptx exceeds the aggregate embedded-image budget.");
      }
      this.imageOutputBytes += asset.bytes;
      return asset;
    });
    this.cache.set(target, pending);
    return pending;
  }
}

export function readBoundedPptxEntry(
  entry: JSZipObject,
  budget: { add(bytes: number): void },
  maximumEntryBytes: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const stream = entry.nodeStream("nodebuffer");
    let bytes = 0;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(error);
    };
    stream
      .on("data", (chunk: Buffer) => {
        if (settled) return;
        try {
          if (bytes + chunk.byteLength > maximumEntryBytes) {
            throw new PptxResourceLimitError(`The expanded source .pptx entry exceeds ${maximumEntryBytes} bytes: ${entry.name}`);
          }
          budget.add(chunk.byteLength);
          bytes += chunk.byteLength;
          chunks.push(chunk);
        } catch (error) {
          fail(error);
        }
      })
      .on("error", (error: Error) => fail(new Error(`The source .pptx entry could not be expanded safely: ${entry.name}`, { cause: error })))
      .on("end", () => {
        if (settled) return;
        settled = true;
        const output = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.byteLength;
        }
        resolve(output);
      })
      .resume();
  });
}

function concurrencyLimiter(limit: number) {
  const queue: Array<() => void> = [];
  let active = 0;
  const next = () => {
    while (active < limit && queue.length) {
      active += 1;
      queue.shift()!();
    }
  };
  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        void task().then(resolve, reject).finally(() => {
          active -= 1;
          next();
        });
      });
      next();
    });
  };
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T, index: number) => Promise<R>) {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await mapper(values[index]!, index);
    }
  }));
  return output;
}

function pptxTextFrame(fragment: string, slideIndex: number, zIndex: number, pageSize: { cx: number; cy: number }): OpenSlideXImportTextFrame | undefined {
  const text = limitText(textFromXml(fragment));
  if (!text) return undefined;
  const geometry = frameGeometry(fragment, pageSize);
  const placeholder = attribute(fragment.match(/<p:ph\b([^>]*)\/?>(?:<\/p:ph>)?/i)?.[1] ?? "", "type")?.toLowerCase();
  const runProperties = fragment.match(/<a:(?:rPr|defRPr|endParaRPr)\b([^>]*)\/?>(?:<\/a:(?:rPr|defRPr|endParaRPr)>)?/i)?.[1] ?? "";
  const size = Number(attribute(runProperties, "sz"));
  const typeface = attribute(fragment.match(/<a:latin\b([^>]*)\/?>(?:<\/a:latin>)?/i)?.[1] ?? "", "typeface");
  const alignmentValue = attribute(fragment.match(/<a:pPr\b([^>]*)\/?>(?:<\/a:pPr>)?/i)?.[1] ?? "", "algn")?.toLowerCase();
  const alignment = ({ ctr: "center", just: "justify", l: "left", r: "right" } as const)[alignmentValue as "ctr" | "just" | "l" | "r"];
  const titleHint = placeholder === "title" || placeholder === "ctrtitle" || (zIndex === 0 && Number.isFinite(size) && size >= 2800);
  const frame = {
    alignment,
    fontFamily: typeface,
    fontSizePt: Number.isFinite(size) && size > 0 ? Number((size / 100).toFixed(2)) : undefined,
    fontWeight: /\bb\s*=\s*(["'])1\1/i.test(runProperties) ? 700 : undefined,
    geometry: geometry.value,
    geometryWarning: geometry.warning,
    id: `pptx-slide-${slideIndex + 1}-text-${zIndex + 1}`,
    text,
    titleHint,
    zIndex
  };
  return { ...frame, textBlock: textBlockMdx(frame) };
}
function pptxPageSize(xml: string | undefined) { const tag = xml?.match(/<p:sldSz\b([^>]*)\/?>(?:<\/p:sldSz>)?/i)?.[1] ?? ""; const cx = Number(attribute(tag, "cx")); const cy = Number(attribute(tag, "cy")); return Number.isFinite(cx) && cx > 0 && Number.isFinite(cy) && cy > 0 ? { cx, cy } : defaultPageSize; }
function frameGeometry(fragment: string, pageSize: { cx: number; cy: number }) { const transform = fragment.match(/<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/i)?.[1]; const off = transform?.match(/<a:off\b([^>]*)\/?>(?:<\/a:off>)?/i)?.[1] ?? ""; const ext = transform?.match(/<a:ext\b([^>]*)\/?>(?:<\/a:ext>)?/i)?.[1] ?? ""; const raw = [Number(attribute(off, "x")), Number(attribute(off, "y")), Number(attribute(ext, "cx")), Number(attribute(ext, "cy"))]; if (raw.some((value) => !Number.isFinite(value) || value < 0)) return { value: { x: 0, y: 0, w: 100, h: 100 }, warning: "PPTX frame geometry was missing; a full-slide frame was used." }; return { value: { x: percentage(raw[0]!, pageSize.cx), y: percentage(raw[1]!, pageSize.cy), w: percentage(raw[2]!, pageSize.cx), h: percentage(raw[3]!, pageSize.cy) } }; }
function pictureAlt(fragment: string, fallback: string) { const props = fragment.match(/<p:cNvPr\b([^>]*)\/?>(?:<\/p:cNvPr>)?/i)?.[1] ?? ""; return decodeEntities(attribute(props, "descr") || attribute(props, "name") || fallback); }
function relationshipPath(slidePath: string) { return `${posix.dirname(slidePath)}/_rels/${posix.basename(slidePath)}.rels`; }
function resolvePptxTarget(slidePath: string, target: string) { const resolved = posix.normalize(posix.join(posix.dirname(slidePath), target)); return resolved.startsWith("ppt/") && !resolved.includes("..") ? resolved : ""; }
function imageMediaType(name: string) { return ({ ".avif": "image/avif", ".gif": "image/gif", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" } as const)[extname(name).toLowerCase()]; }
function percentage(value: number, total: number) { return Number(Math.max(0, Math.min(100, value / total * 100)).toFixed(4)); }
function imageBlockMdx(image: { alt: string; geometry: { h: number; w: number; x: number; y: number }; id: string; source: string }) {
  const attributeValue = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const { h, w, x, y } = image.geometry;
  return `<ImageBlock id="${attributeValue(image.id)}" alt="${attributeValue(image.alt)}" src="${attributeValue(image.source)}" fit="cover" x={${x}} y={${y}} w={${w}} h={${h}} />`;
}
function textBlockMdx(frame: Omit<OpenSlideXImportTextFrame, "textBlock">) {
  const attributeValue = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const textValue = (value: string) => attributeValue(value).replace(/>/g, "&gt;");
  const { h, w, x, y } = frame.geometry;
  const optional = [
    frame.titleHint ? ' role="title"' : "",
    frame.fontFamily ? ` fontFamily="${attributeValue(frame.fontFamily)}"` : "",
    frame.fontSizePt ? ` fontSize={${frame.fontSizePt}}` : "",
    frame.fontWeight ? ` fontWeight={${frame.fontWeight}}` : "",
    frame.alignment ? ` textAlign="${frame.alignment}"` : ""
  ].join("");
  return `<Text id="${attributeValue(frame.id)}"${optional} x={${x}} y={${y}} w={${w}} h={${h}}>${textValue(frame.text)}</Text>`;
}
function completeImport(sourceFile: string, sourceTitle: string | undefined, slides: OpenSlideXImportSlide[], warnings: string[]): OpenSlideXSourceImport { return { conversionBoundary: "This is semantic PPTX evidence, not a finished MotionDoc deck. Review recovered Text blocks and imported ImageBlock layers, then recompose them through open_slidex_edit and exactly one selected thirty-page core reference.", format: "pptx", sourceFile, ...(sourceTitle ? { sourceTitle } : {}), summary: { imageCount: slides.reduce((total, slide) => total + slide.imageCount, 0), slideCount: slides.length, textBlockCount: slides.reduce((total, slide) => total + slide.text.length, 0) }, warnings, slides }; }
function firstText(xml: string | undefined) { const title = xml?.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]; return title ? textFromMarkup(title) : undefined; }
function textFromXml(value: string) { return decodeEntities([...value.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi)].map((match) => match[1] ?? "").join(" ")).replace(/\s+/g, " ").trim(); }
function textFromMarkup(value: string) { return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function attribute(source: string, name: string) { const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return source.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2]; }
function decodeEntities(value: string) { return value.replace(/&nbsp;/gi, " ").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&"); }
function limitText(value: string) { return value.length > MAX_TEXT_PER_SLIDE ? `${value.slice(0, MAX_TEXT_PER_SLIDE - 1)}…` : value; }
function numericSlideName(name: string) { return Number(name.match(/slide(\d+)\.xml$/i)?.[1] ?? Number.MAX_SAFE_INTEGER); }
function assertSafeArchiveEntry(entry: JSZipObject) { const originalName = (entry as JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name; const normalized = originalName.replace(/\/$/, ""); if (!normalized || normalized.includes("\\") || normalized.includes("\0") || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("The source .pptx contains an unsafe archive path."); }
function uncompressedSize(entry: JSZipObject) { if (entry.dir) return 0; const value = (entry as JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize; if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`The source .pptx has invalid size metadata: ${entry.name}`); return value; }
