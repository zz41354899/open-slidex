import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { resolveInsideRoot } from "./nodePath";

export async function embedSlideXProjectMedia(source: string, projectRoot: string) {
  const resolvedRoot = await realpath(path.resolve(projectRoot)).catch(() => {
    throw new Error("The projectRoot directory does not exist.");
  });
  const replacements: Array<{ end: number; start: number; value: string }> = [];

  for (const match of source.matchAll(/\b(src|poster|backgroundImage|shapeImageSrc)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g)) {
    const mediaSource = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    if (!mediaSource || /^(?:https:|data:|blob:)/i.test(mediaSource)) continue;

    const requestedPath = path.isAbsolute(mediaSource)
      ? mediaSource
      : resolveInsideRoot(resolvedRoot, mediaSource);
    const absolutePath = await realpath(requestedPath).catch(() => {
      throw new Error(`Referenced project media does not exist: ${mediaSource}`);
    });
    resolveInsideRoot(resolvedRoot, absolutePath);
    const buffer = await readFile(absolutePath);
    const mimeType = mediaMimeType(absolutePath);
    const start = (match.index ?? 0) + match[0].lastIndexOf(mediaSource);
    replacements.push({
      end: start + mediaSource.length,
      start,
      value: `data:${mimeType};base64,${buffer.toString("base64")}`
    });
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.value}${current.slice(replacement.end)}`,
      source
    );
}

function mediaMimeType(filePath: string) {
  const mimeTypes: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webm": "video/webm",
    ".webp": "image/webp"
  };
  const mimeType = mimeTypes[path.extname(filePath).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported project media type: ${filePath}`);
  return mimeType;
}
