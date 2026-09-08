import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D
} from "@napi-rs/canvas";
import { pdf as rasterizePdf } from "pdf-to-img";

const maximumPdfPages = 200;
const maximumEmbeddedImages = 100;
const maximumFallbackPages = 50;
const defaultMaximumDecodedPixels = 100_000_000;
const defaultMaximumOutputBytes = 64 * 1024 * 1024;
const defaultMaximumDurationMs = 30_000;
const defaultMaximumTextDurationMs = 15_000;
const defaultMaximumTextItems = 500_000;
const defaultMaximumTextOutputBytes = 8 * 1024 * 1024;

export type PdfMediaExtractionLimits = {
  maximumDecodedPixels?: number;
  maximumDurationMs?: number;
  maximumOutputBytes?: number;
  signal?: AbortSignal;
};

export type PdfTextExtractionLimits = {
  maximumDurationMs?: number;
  maximumItems?: number;
  maximumOutputBytes?: number;
  signal?: AbortSignal;
};

export type PdfMediaCandidate = {
  bytes: Uint8Array;
  fileName: string;
  kind: "embedded" | "page-fallback";
  page: number;
};

export async function extractPdfTextPages(
  bytes: Uint8Array,
  limits: PdfTextExtractionLimits = {}
) {
  limits.signal?.throwIfAborted();
  const maximumDurationMs = positiveLimit(limits.maximumDurationMs, defaultMaximumTextDurationMs);
  const maximumItems = positiveLimit(limits.maximumItems, defaultMaximumTextItems);
  const maximumOutputBytes = positiveLimit(limits.maximumOutputBytes, defaultMaximumTextOutputBytes);
  const deadline: PdfDeadline = {
    label: "PDF text extraction",
    maximumDurationMs,
    signal: limits.signal,
    startedAt: Date.now()
  };
  const { document } = await openPdf(bytes, deadline);
  try {
    const pages: string[] = [];
    let extractedItems = 0;
    let outputBytes = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      assertWithinDuration(deadline);
      const page = await withPdfDeadline(document.getPage(pageNumber), deadline);
      const strings: string[] = [];
      const reader = page.streamTextContent({ disableNormalization: false }).getReader();
      let completed = false;
      try {
        while (true) {
          const chunk = await withPdfDeadline(reader.read(), deadline);
          if (chunk.done) {
            completed = true;
            break;
          }
          for (const item of chunk.value.items as unknown[]) {
            if (!isTextItem(item)) continue;
            assertWithinBudget(extractedItems, 1, maximumItems, "text item", deadline.label);
            const addition = Buffer.byteLength(item.str) + (strings.length ? 1 : 0);
            assertWithinBudget(outputBytes, addition, maximumOutputBytes, "output byte", deadline.label);
            extractedItems += 1;
            outputBytes += addition;
            strings.push(item.str);
          }
        }
      } finally {
        if (completed) reader.releaseLock();
      }
      pages.push(strings
        .join(" ")
        .replace(/\s+/g, " ")
        .trim());
    }
    return pages;
  } finally {
    await document.destroy().catch(() => undefined);
  }
}

export async function extractPdfMedia(
  bytes: Uint8Array,
  stem = "pdf",
  limits: PdfMediaExtractionLimits = {}
) {
  limits.signal?.throwIfAborted();
  const maximumDecodedPixels = positiveLimit(limits.maximumDecodedPixels, defaultMaximumDecodedPixels);
  const maximumOutputBytes = positiveLimit(limits.maximumOutputBytes, defaultMaximumOutputBytes);
  const maximumDurationMs = positiveLimit(limits.maximumDurationMs, defaultMaximumDurationMs);
  const startedAt = Date.now();
  const deadline: PdfDeadline = {
    label: "PDF visual extraction",
    maximumDecodedPixels,
    maximumDurationMs,
    signal: limits.signal,
    startedAt
  };
  const { document, pdfjs } = await openPdf(bytes, deadline);
  const candidates: PdfMediaCandidate[] = [];
  const warnings: string[] = [];
  let decodedPixels = 0;
  let outputBytes = 0;
  let embeddedCount = 0;
  let fallbackCount = 0;
  let fallbackDocument: Awaited<ReturnType<typeof rasterizePdf>> | undefined;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      assertWithinDuration(deadline);
      const page = await withPdfDeadline(document.getPage(pageNumber), deadline);
      const operatorList = await withPdfDeadline(page.getOperatorList(), deadline);
      const imageObjects = new Map<string, unknown>();
      let needsFallback = hasNonImageVisualPainting(operatorList.fnArray, pdfjs.OPS);

      for (let index = 0; index < operatorList.fnArray.length; index += 1) {
        const operation = operatorList.fnArray[index];
        const args = operatorList.argsArray[index] ?? [];
        let image: unknown;
        let identity = `inline-${index + 1}`;
        if (operation === pdfjs.OPS.paintInlineImageXObject) {
          image = args[0];
        } else if (
          operation === pdfjs.OPS.paintImageXObject
          || operation === pdfjs.OPS.paintImageXObjectRepeat
        ) {
          const objectId = args[0];
          if (typeof objectId !== "string") {
            needsFallback = true;
            continue;
          }
          identity = objectId;
          if (imageObjects.has(objectId)) continue;
          image = await withPdfDeadline(pageObject(page.objs, objectId), deadline).catch(() => undefined);
          imageObjects.set(objectId, image);
        } else if (
          operation === pdfjs.OPS.paintImageMaskXObject
          || operation === pdfjs.OPS.paintImageMaskXObjectGroup
        ) {
          needsFallback = true;
        } else {
          continue;
        }

        if (embeddedCount >= maximumEmbeddedImages) {
          needsFallback = true;
          continue;
        }
        const pixels = pdfImagePixels(image);
        if (pixels) assertWithinBudget(decodedPixels, pixels, maximumDecodedPixels, "decoded pixel", deadline.label);
        if (pixels && isPdfImage(image)) {
          assertWithinBudget(outputBytes, maximumPngAllocation(pixels, image.height), maximumOutputBytes, "output byte", deadline.label);
        }
        const png = imageToPng(image);
        assertWithinDuration(deadline);
        if (!png) {
          needsFallback = true;
          continue;
        }
        assertWithinBudget(outputBytes, png.byteLength, maximumOutputBytes, "output byte", deadline.label);
        decodedPixels += pixels;
        outputBytes += png.byteLength;
        embeddedCount += 1;
        candidates.push({
          bytes: png,
          fileName: `${safeStem(stem)}-page-${pageNumber}-image-${embeddedCount}-${safeStem(identity)}.png`,
          kind: "embedded",
          page: pageNumber
        });
      }

      if (needsFallback && fallbackCount < maximumFallbackPages) {
        assertWithinDuration(deadline);
        const viewport = page.getViewport({ scale: 2 });
        const fallbackPixels = Math.ceil(viewport.width) * Math.ceil(viewport.height);
        assertWithinBudget(decodedPixels, fallbackPixels, maximumDecodedPixels, "decoded pixel", deadline.label);
        assertWithinBudget(outputBytes, maximumPngAllocation(fallbackPixels, Math.ceil(viewport.height)), maximumOutputBytes, "output byte", deadline.label);
        fallbackCount += 1;
        fallbackDocument ??= await withPdfDeadline(rasterizePdf(new Uint8Array(bytes), { scale: 2 }), deadline);
        if (fallbackDocument.length < pageNumber) {
          throw new Error(`PDF page ${pageNumber} is unavailable for fallback rendering.`);
        }
        const fallbackBytes = new Uint8Array(await withPdfDeadline(fallbackDocument.getPage(pageNumber), deadline));
        assertWithinDuration(deadline);
        assertWithinBudget(outputBytes, fallbackBytes.byteLength, maximumOutputBytes, "output byte", deadline.label);
        decodedPixels += fallbackPixels;
        outputBytes += fallbackBytes.byteLength;
        candidates.push({
          bytes: fallbackBytes,
          fileName: `${safeStem(stem)}-page-${pageNumber}.png`,
          kind: "page-fallback",
          page: pageNumber
        });
      } else if (needsFallback) {
        warnings.push(`PDF page ${pageNumber} needed a visual fallback, but the ${maximumFallbackPages}-page fallback limit was reached.`);
      }
    }
    if (embeddedCount >= maximumEmbeddedImages) {
      warnings.push(`PDF embedded-image extraction stopped at ${maximumEmbeddedImages} images.`);
    }
    return { candidates, warnings };
  } finally {
    await document.destroy().catch(() => undefined);
  }
}

type PdfDeadline = {
  label: "PDF text extraction" | "PDF visual extraction";
  maximumDecodedPixels?: number;
  maximumDurationMs: number;
  signal?: AbortSignal;
  startedAt: number;
};

async function openPdf(bytes: Uint8Array, deadline?: PdfDeadline) {
  installCanvasGlobals();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    canvasMaxAreaInBytes: Math.min(deadline?.maximumDecodedPixels ?? 40_000_000, 40_000_000) * 4,
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    maxImageSize: Math.min(deadline?.maximumDecodedPixels ?? 40_000_000, 40_000_000),
    useSystemFonts: true
  });
  void loading.promise.catch(() => undefined);
  let document: Awaited<typeof loading.promise>;
  try {
    document = deadline
      ? await withPdfDeadline(loading.promise, deadline)
      : await loading.promise;
  } catch (error) {
    await loading.destroy().catch(() => undefined);
    throw error;
  }
  if (document.numPages < 1 || document.numPages > maximumPdfPages) {
    await document.destroy();
    throw new Error(`PDF sources must contain between 1 and ${maximumPdfPages} pages.`);
  }
  return { document, pdfjs };
}

function installCanvasGlobals() {
  const canvasGlobals = globalThis as unknown as Record<string, unknown>;
  canvasGlobals.DOMMatrix ??= DOMMatrix;
  canvasGlobals.ImageData ??= ImageData;
  canvasGlobals.Path2D ??= Path2D;
}

function isTextItem(value: unknown): value is { str: string } {
  return typeof value === "object" && value !== null && "str" in value && typeof value.str === "string";
}

function pageObject(objects: { get(id: string, callback?: (value: unknown) => void): unknown }, id: string) {
  try {
    return Promise.resolve(objects.get(id));
  } catch {
    // Rendering resolves lazy PDF image objects. Keep a callback fallback for
    // PDFs that deliver the object shortly after the operator list.
  }
  return new Promise<unknown>((resolve, reject) => {
    try {
      const immediate = objects.get(id, resolve);
      if (immediate !== null && immediate !== undefined) resolve(immediate);
    } catch (error) {
      reject(error);
    }
  });
}

function imageToPng(value: unknown) {
  if (!isPdfImage(value)) return undefined;
  const pixels = rgbaPixels(value);
  if (!pixels) return undefined;
  const canvas = createCanvas(value.width, value.height);
  const context = canvas.getContext("2d");
  context.putImageData(new ImageData(pixels, value.width, value.height), 0, 0);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

function pdfImagePixels(value: unknown) {
  if (!isPdfImage(value)) return 0;
  const pixels = value.width * value.height;
  if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > 40_000_000) {
    throw new Error("PDF visual extraction exceeded the per-image decoded pixel budget (40000000).");
  }
  return pixels;
}

function maximumPngAllocation(pixels: number, height: number) {
  const maximum = pixels * 4 + height + 65_536;
  return Number.isSafeInteger(maximum) ? maximum : Number.POSITIVE_INFINITY;
}

function positiveLimit(value: number | undefined, fallback: number) {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

function assertWithinBudget(
  current: number,
  addition: number,
  maximum: number,
  label: string,
  operation = "PDF visual extraction"
) {
  if (!Number.isSafeInteger(addition) || addition < 0 || current + addition > maximum) {
    throw new Error(`${operation} exceeded the cumulative ${label} budget (${maximum}).`);
  }
}

function assertWithinDuration(deadline: PdfDeadline) {
  deadline.signal?.throwIfAborted();
  if (Date.now() - deadline.startedAt > deadline.maximumDurationMs) {
    throw new Error(`${deadline.label} exceeded the ${deadline.maximumDurationMs} ms time budget.`);
  }
}

async function withPdfDeadline<T>(operation: Promise<T>, deadline: PdfDeadline): Promise<T> {
  assertWithinDuration(deadline);
  const remaining = Math.max(1, deadline.maximumDurationMs - (Date.now() - deadline.startedAt));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      deadline.signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => finish(() => reject(deadline.signal?.reason ?? new Error("PDF visual extraction was cancelled.")));
    const timer = setTimeout(
      () => finish(() => reject(new Error(`${deadline.label} exceeded the ${deadline.maximumDurationMs} ms time budget.`))),
      remaining
    );
    deadline.signal?.addEventListener("abort", abort, { once: true });
    if (deadline.signal?.aborted) abort();
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => {
        if (deadline.signal?.aborted) {
          reject(deadline.signal.reason ?? new Error("PDF visual extraction was cancelled."));
          return;
        }
        if (Date.now() - deadline.startedAt >= deadline.maximumDurationMs) {
          reject(new Error(`${deadline.label} exceeded the ${deadline.maximumDurationMs} ms time budget.`));
          return;
        }
        reject(error);
      })
    );
  });
}

function rgbaPixels(image: PdfImage) {
  const pixels = image.width * image.height;
  if (pixels < 1 || pixels > 40_000_000) return undefined;
  const source = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const rgba = new Uint8ClampedArray(pixels * 4);
  if (image.kind === 3 && source.byteLength >= pixels * 4) {
    rgba.set(source.subarray(0, pixels * 4));
    return rgba;
  }
  if (image.kind === 2 && source.byteLength >= pixels * 3) {
    for (let sourceIndex = 0, targetIndex = 0; targetIndex < rgba.length; sourceIndex += 3, targetIndex += 4) {
      rgba[targetIndex] = source[sourceIndex]!;
      rgba[targetIndex + 1] = source[sourceIndex + 1]!;
      rgba[targetIndex + 2] = source[sourceIndex + 2]!;
      rgba[targetIndex + 3] = 255;
    }
    return rgba;
  }
  if (image.kind === 1 && source.byteLength * 8 >= pixels) {
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      const on = (source[Math.floor(pixel / 8)]! >> (7 - pixel % 8)) & 1;
      const shade = on ? 0 : 255;
      const offset = pixel * 4;
      rgba[offset] = shade;
      rgba[offset + 1] = shade;
      rgba[offset + 2] = shade;
      rgba[offset + 3] = 255;
    }
    return rgba;
  }
  return undefined;
}

function isPdfImage(value: unknown): value is PdfImage {
  if (typeof value !== "object" || value === null) return false;
  const image = value as Partial<PdfImage>;
  return (
    Number.isInteger(image.width)
    && Number.isInteger(image.height)
    && typeof image.kind === "number"
    && image.data instanceof Uint8Array
  );
}

type PdfImage = {
  data: Uint8Array;
  height: number;
  kind: number;
  width: number;
};

function hasNonImageVisualPainting(functions: number[], operations: Record<string, number>) {
  const visual = new Set([
    operations.stroke,
    operations.closeStroke,
    operations.fill,
    operations.eoFill,
    operations.fillStroke,
    operations.eoFillStroke,
    operations.closeFillStroke,
    operations.closeEOFillStroke,
    operations.shadingFill,
    operations.paintSolidColorImageMask,
    operations.paintFormXObjectBegin,
    operations.constructPath
  ].filter((value): value is number => typeof value === "number"));
  return functions.some((operation) => visual.has(operation));
}

function safeStem(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "pdf";
}
