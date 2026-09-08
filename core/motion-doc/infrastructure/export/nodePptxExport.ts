import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import { summarizeMotionDoc } from "@/core/motion-doc/application/motionDocAutomation";
import { downloadPublicHttpsResource } from "@/common/util/publicHttpsDownload";
import {
  closeSlideXChromiumPool,
  withSlideXChromiumPage
} from "@/packages/slidex-sdk/src/nodeBrowser";

export type ExportMotionDocPptxInput = {
  keepBrowserWarm?: boolean;
  outputPath: string;
  overwrite?: boolean;
  source: string;
  title?: string;
};

const MAX_MEDIA_BYTES = 80 * 1024 * 1024;

export async function exportMotionDocPptx({
  keepBrowserWarm = false,
  outputPath,
  overwrite = false,
  source,
  title
}: ExportMotionDocPptxInput) {
  const resolvedPath = validateOutputPath(outputPath);
  await assertOutputIsWritable(resolvedPath, overwrite);

  const normalizedSource = materializeFreeformSource(source);
  const summary = summarizeMotionDoc(normalizedSource);
  if (!summary.validation.isValid) {
    throw new Error("The MotionDoc source is invalid and cannot be exported to PowerPoint.");
  }

  const portableSource = await prepareNodePptxSource(normalizedSource);
  try {
    return await withSlideXChromiumPage({ acceptDownloads: true }, async (page) => {
      await page.route("**/*", async (route) => {
        const protocol = new URL(route.request().url()).protocol;
        if (protocol === "about:" || protocol === "blob:" || protocol === "data:") {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
      });
      await page.setContent("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
      await page.evaluate(() => {
        if (!globalThis.crypto.randomUUID) {
          Object.defineProperty(globalThis.crypto, "randomUUID", {
            value: () => "10000000-1000-4000-8000-100000000000"
          });
        }
      });
      await page.addScriptTag({ path: browserBundlePath() });

      const downloadPromise = page.waitForEvent("download");
      const exportPromise = page.evaluate(
        ({ deckSource, deckTitle }) => window.__slidexExportPptx({
          source: deckSource,
          title: deckTitle
        }),
        {
          deckSource: portableSource,
          deckTitle: title?.trim() || summary.document.title || "SlideX Deck"
        }
      );
      const [download, result] = await Promise.all([downloadPromise, exportPromise]);
      await download.saveAs(resolvedPath);

      return {
        outputPath: resolvedPath,
        rasterizedSlideIndices: result.rasterizedSlideIndices,
        summary
      };
    });
  } finally {
    if (!keepBrowserWarm) await closeSlideXChromiumPool();
  }
}

export function validateOutputPath(outputPath: string) {
  if (!path.isAbsolute(outputPath) || path.extname(outputPath).toLowerCase() !== ".pptx") {
    throw new Error("outputPath must be an absolute .pptx path.");
  }

  return path.normalize(outputPath);
}

async function assertOutputIsWritable(outputPath: string, overwrite: boolean) {
  await access(path.dirname(outputPath)).catch(() => {
    throw new Error("The outputPath parent directory does not exist.");
  });

  if (overwrite) return;

  await access(outputPath).then(
    () => {
      throw new Error("The outputPath already exists. Pass overwrite=true to replace it.");
    },
    () => undefined
  );
}

function browserBundlePath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "pptx-browser.js");
}

async function prepareNodePptxSource(source: string) {
  const replacements: Array<{ end: number; start: number; value: string }> = [];
  const mediaAttributePattern = /\b(src|poster|backgroundImage|shapeImageSrc)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*(https:\/\/[^{}\s]+)\s*\})/g;

  for (const attributeMatch of source.matchAll(mediaAttributePattern)) {
    const matchStart = attributeMatch.index ?? 0;
    const tagStart = source.lastIndexOf("<", matchStart);
    if (tagStart < 0 || tagStart < source.lastIndexOf(">", matchStart)) continue;
    const attributeName = attributeMatch[1]!;
    const mediaSource = attributeMatch.slice(2).find((value) => value !== undefined) ?? "";
    const valueOffset = attributeMatch[0].indexOf(mediaSource);
    const start = matchStart + valueOffset;
    const tagPrefix = source.slice(tagStart, matchStart);
    const kind = attributeName === "src" && /^<VideoBlock\b/.test(tagPrefix) ? "video" : "image";
    const value = await portableMediaSource(mediaSource, kind);

    replacements.push({ end: start + mediaSource.length, start, value });
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.value}${current.slice(replacement.end)}`,
      source
    );
}

async function portableMediaSource(source: string, kind: "image" | "video") {
  if (!source) return source;

  if (source.startsWith(`data:${kind}/`)) {
    return source;
  }

  if (source.startsWith("blob:") || source.startsWith("/") && !path.isAbsolute(source)) {
    throw new Error("PowerPoint media must use HTTPS, a data URI, or an absolute local path.");
  }

  if (/^https:\/\//i.test(source)) {
    const downloaded = await downloadPublicHttpsResource(source, {
      headers: {
        Accept: kind === "video"
          ? "video/mp4,video/webm,video/ogg,video/*;q=0.8"
          : "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8"
      },
      maximumBytes: MAX_MEDIA_BYTES,
      userAgent: "OpenSlideX/0.6 pptx-export"
    });
    if (!downloaded.mediaType?.startsWith(`${kind}/`)) {
      throw new Error(`A PowerPoint ${kind} URL did not return ${kind} content.`);
    }
    return `data:${downloaded.mediaType};base64,${Buffer.from(downloaded.bytes).toString("base64")}`;
  }

  if (path.isAbsolute(source)) {
    const buffer = await readFile(source).catch(() => {
      throw new Error("A local PowerPoint media file could not be read.");
    });
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("A PowerPoint media source is too large.");
    return `data:${mediaMimeType(source, kind)};base64,${buffer.toString("base64")}`;
  }

  throw new Error("PowerPoint media must use HTTPS, a data URI, or an absolute local path.");
}

function mediaMimeType(source: string, kind: "image" | "video") {
  const extension = path.extname(source).toLowerCase();
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".ogg": kind === "video" ? "video/ogg" : "image/png",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webm": "video/webm",
    ".webp": "image/webp"
  };

  return types[extension] ?? (kind === "video" ? "video/mp4" : "image/png");
}

declare global {
  interface Window {
    __slidexExportPptx: (input: { source: string; title: string }) => Promise<{
      rasterizedSlideIndices: number[];
    }>;
  }
}
