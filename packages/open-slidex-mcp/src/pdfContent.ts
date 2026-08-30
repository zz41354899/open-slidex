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

export type PdfMediaCandidate = {
  bytes: Uint8Array;
  fileName: string;
  kind: "embedded" | "page-fallback";
  page: number;
};

export async function extractPdfTextPages(bytes: Uint8Array) {
  const { document } = await openPdf(bytes);
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent({ disableNormalization: false });
      pages.push(text.items
        .flatMap((item: unknown) => isTextItem(item) ? [item.str] : [])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim());
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

export async function extractPdfMedia(bytes: Uint8Array, stem = "pdf") {
  const { document, pdfjs } = await openPdf(bytes);
  const candidates: PdfMediaCandidate[] = [];
  const warnings: string[] = [];
  let embeddedCount = 0;
  let fallbackCount = 0;
  let fallbackDocument: Awaited<ReturnType<typeof rasterizePdf>> | undefined;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const operatorList = await page.getOperatorList();
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
          image = await pageObject(page.objs, objectId).catch(() => undefined);
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
        const png = imageToPng(image);
        if (!png) {
          needsFallback = true;
          continue;
        }
        embeddedCount += 1;
        candidates.push({
          bytes: png,
          fileName: `${safeStem(stem)}-page-${pageNumber}-image-${embeddedCount}-${safeStem(identity)}.png`,
          kind: "embedded",
          page: pageNumber
        });
      }

      if (needsFallback && fallbackCount < maximumFallbackPages) {
        fallbackCount += 1;
        fallbackDocument ??= await rasterizePdf(new Uint8Array(bytes), { scale: 2 });
        if (fallbackDocument.length < pageNumber) {
          throw new Error(`PDF page ${pageNumber} is unavailable for fallback rendering.`);
        }
        candidates.push({
          bytes: new Uint8Array(await fallbackDocument.getPage(pageNumber)),
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
    await document.destroy();
  }
}

async function openPdf(bytes: Uint8Array) {
  installCanvasGlobals();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true
  });
  const document = await loading.promise;
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
