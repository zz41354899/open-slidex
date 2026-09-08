import { createHash } from "node:crypto";
import { lstat, mkdir, opendir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractPdfTextPages } from "./pdfContent";

type KnowledgeChunk = {
  content: string;
  end: number;
  hash: string;
  page?: number;
  path: string;
  section?: string;
  source: "workspace";
  start: number;
};

type KnowledgeIndex = {
  chunks: KnowledgeChunk[];
  generatedAt: string;
  version: 1;
};

const allowedExtensions = new Set([".csv", ".md", ".markdown", ".pdf", ".txt"]);
const maximumKnowledgeFileBytes = 20 * 1024 * 1024;
const defaultMaximumKnowledgeDurationMs = 30_000;
const defaultMaximumKnowledgeFiles = 256;
const defaultMaximumKnowledgeInputBytes = 64 * 1024 * 1024;
const defaultMaximumKnowledgeOutputBytes = 16 * 1024 * 1024;
const defaultMaximumKnowledgeEntries = 4_096;
const defaultMaximumKnowledgeDirectories = 512;
const defaultMaximumKnowledgeDepth = 16;
const defaultMaximumKnowledgeChunks = 10_000;

export type KnowledgeIndexLimits = {
  maximumDurationMs?: number;
  maximumFiles?: number;
  maximumInputBytes?: number;
  maximumOutputBytes?: number;
  maximumEntries?: number;
  maximumDirectories?: number;
  maximumDepth?: number;
  maximumChunks?: number;
};

export async function searchOpenSlideXKnowledge(projectRoot: string, query: string, limit = 8) {
  const index = await buildOpenSlideXKnowledgeIndex(projectRoot);
  const terms = tokenize(query);
  const results = index.chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, terms)
    }))
    .filter((chunk) => terms.length === 0 || chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, Math.min(Math.max(limit, 1), 20))
    .map(({ content, ...chunk }) => ({
      ...chunk,
      resourcePath: `knowledge/${chunk.path}`,
      snippet: content.length > 600 ? `${content.slice(0, 597)}...` : content
    }));

  return {
    generatedAt: index.generatedAt,
    query,
    results
  };
}

export async function readOpenSlideXKnowledgeResource(
  projectRoot: string,
  resourcePath: string,
  cursor = 0,
  limit = 4
) {
  if (
    resourcePath.includes("\\") ||
    path.posix.normalize(resourcePath) !== resourcePath ||
    !resourcePath.startsWith("knowledge/")
  ) {
    throw new Error("resourcePath must be an exact knowledge/... path returned by open_slidex_read.");
  }
  if (!Number.isInteger(cursor) || cursor < 0) throw new Error("resourceCursor must be a non-negative integer.");
  const relativePath = resourcePath.slice("knowledge/".length);
  if (!relativePath) throw new Error("resourcePath must name one knowledge file.");
  const index = await buildOpenSlideXKnowledgeIndex(projectRoot);
  const chunks = index.chunks.filter((chunk) => chunk.path === relativePath);
  if (chunks.length === 0) {
    throw new Error("The requested knowledge resource is unavailable or has no readable content.");
  }
  if (cursor >= chunks.length) throw new Error("resourceCursor is past the end of this knowledge resource.");
  const selected = chunks.slice(cursor, cursor + Math.min(Math.max(limit, 1), 8));
  const nextCursor = cursor + selected.length < chunks.length ? cursor + selected.length : undefined;
  return {
    chunks: selected,
    mode: "resource" as const,
    nextCursor,
    resourcePath,
    totalChunks: chunks.length
  };
}

export async function buildOpenSlideXKnowledgeIndex(
  projectRoot: string,
  limits: KnowledgeIndexLimits = {}
) {
  const maximumDurationMs = positiveLimit(limits.maximumDurationMs, defaultMaximumKnowledgeDurationMs);
  const maximumFiles = positiveLimit(limits.maximumFiles, defaultMaximumKnowledgeFiles);
  const maximumInputBytes = positiveLimit(limits.maximumInputBytes, defaultMaximumKnowledgeInputBytes);
  const maximumOutputBytes = positiveLimit(limits.maximumOutputBytes, defaultMaximumKnowledgeOutputBytes);
  const maximumEntries = positiveLimit(limits.maximumEntries, defaultMaximumKnowledgeEntries);
  const maximumDirectories = positiveLimit(limits.maximumDirectories, defaultMaximumKnowledgeDirectories);
  const maximumDepth = positiveLimit(limits.maximumDepth, defaultMaximumKnowledgeDepth);
  const maximumChunks = positiveLimit(limits.maximumChunks, defaultMaximumKnowledgeChunks);
  const startedAt = Date.now();
  const deadlineAt = startedAt + maximumDurationMs;
  const root = path.resolve(projectRoot);
  const knowledgeRoot = path.join(root, "knowledge");
  const stateRoot = path.join(root, ".open-slidex");
  await withKnowledgeDeadline(
    Promise.all([mkdir(knowledgeRoot, { recursive: true }), mkdir(stateRoot, { recursive: true })]),
    deadlineAt,
    maximumDurationMs
  );
  await Promise.all([
    assertRealDirectory(root, knowledgeRoot, "knowledge"),
    assertRealDirectory(root, stateRoot, ".open-slidex")
  ]);
  const actualRoot = await realpath(knowledgeRoot);
  const actualStateRoot = await realpath(stateRoot);
  const files = await listKnowledgeFiles(actualRoot, {
    deadlineAt,
    maximumDirectories,
    maximumDurationMs,
    maximumEntries,
    maximumFiles,
    maximumInputBytes,
    maximumDepth
  });
  const chunks: KnowledgeChunk[] = [];
  let serializedChunkBytes = 0;
  for (const file of files) {
    assertKnowledgeDeadline(deadlineAt, maximumDurationMs);
    const next = await fileChunks(actualRoot, file, {
      deadlineAt,
      maximumChunks: maximumChunks - chunks.length,
      maximumDurationMs,
      maximumOutputBytes: maximumOutputBytes - serializedChunkBytes
    });
    serializedChunkBytes += next.serializedBytes;
    chunks.push(...next.chunks);
  }
  const index: KnowledgeIndex = {
    chunks,
    generatedAt: new Date().toISOString(),
    version: 1
  };
  assertKnowledgeDeadline(deadlineAt, maximumDurationMs);
  const serializedIndex = `${JSON.stringify(index, null, 2)}\n`;
  if (Buffer.byteLength(serializedIndex) > maximumOutputBytes) {
    throw new Error(`Knowledge indexing exceeded the cumulative output byte budget (${maximumOutputBytes}).`);
  }
  await withKnowledgeDeadline(
    writeFile(path.join(actualStateRoot, "knowledge-index.json"), serializedIndex, "utf8"),
    deadlineAt,
    maximumDurationMs
  );
  return index;
}

async function assertRealDirectory(root: string, directory: string, label: string) {
  const directoryStats = await lstat(directory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    throw new Error(`${label}/ must be a real directory inside the OpenSlideX workspace.`);
  }
  const [actualRoot, actual] = await Promise.all([realpath(root), realpath(directory)]);
  const relative = path.relative(actualRoot, actual);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}/ resolves outside the OpenSlideX workspace.`);
  }
}

async function listKnowledgeFiles(root: string, limits: {
  deadlineAt: number;
  maximumDirectories: number;
  maximumDurationMs: number;
  maximumEntries: number;
  maximumFiles: number;
  maximumInputBytes: number;
  maximumDepth: number;
}) {
  const files: Array<{ path: string; size: number }> = [];
  let directories = 0;
  let entries = 0;
  let inputBytes = 0;
  async function visit(directory: string, depth: number) {
    assertKnowledgeDeadline(limits.deadlineAt, limits.maximumDurationMs);
    if (depth > limits.maximumDepth) {
      throw new Error(`Knowledge indexing exceeded the ${limits.maximumDepth}-level directory depth limit.`);
    }
    directories += 1;
    if (directories > limits.maximumDirectories) {
      throw new Error(`Knowledge indexing exceeded the ${limits.maximumDirectories}-directory limit.`);
    }
    const handle = await withKnowledgeDeadline(
      opendir(directory),
      limits.deadlineAt,
      limits.maximumDurationMs
    );
    try {
      for await (const entry of handle) {
        assertKnowledgeDeadline(limits.deadlineAt, limits.maximumDurationMs);
        entries += 1;
        if (entries > limits.maximumEntries) {
          throw new Error(`Knowledge indexing exceeded the ${limits.maximumEntries}-entry traversal limit.`);
        }
        const target = path.join(directory, entry.name);
        const targetStats = await withKnowledgeDeadline(
          lstat(target),
          limits.deadlineAt,
          limits.maximumDurationMs
        );
        if (targetStats.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          await visit(target, depth + 1);
        } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
          if (targetStats.size > maximumKnowledgeFileBytes) continue;
          if (files.length >= limits.maximumFiles) {
            throw new Error(`Knowledge indexing exceeded the ${limits.maximumFiles}-file limit.`);
          }
          if (inputBytes + targetStats.size > limits.maximumInputBytes) {
            throw new Error(`Knowledge indexing exceeded the cumulative input byte budget (${limits.maximumInputBytes}).`);
          }
          inputBytes += targetStats.size;
          files.push({ path: target, size: targetStats.size });
        }
      }
    } finally {
      await handle.close().catch(() => undefined);
    }
  }
  await visit(root, 0);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function fileChunks(
  root: string,
  file: { path: string; size: number },
  limits: {
    deadlineAt: number;
    maximumChunks: number;
    maximumDurationMs: number;
    maximumOutputBytes: number;
  }
) {
  assertKnowledgeDeadline(limits.deadlineAt, limits.maximumDurationMs);
  const filePath = file.path;
  const relativePath = path.relative(root, filePath).split(path.sep).join("/");
  if (relativePath.startsWith("../")) return { chunks: [], serializedBytes: 0 };
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    const bytes = await withKnowledgeDeadline(
      readFile(filePath),
      limits.deadlineAt,
      limits.maximumDurationMs
    );
    const pages = await extractPdfTextPages(new Uint8Array(bytes), {
      maximumDurationMs: Math.min(limits.deadlineAt - Date.now(), 15_000),
      maximumOutputBytes: Math.max(1, limits.maximumOutputBytes)
    });
    return collectChunks(relativePath, pages.map((contents, index) => ({ contents, page: index + 1 })), limits);
  }
  const contents = await withKnowledgeDeadline(
    readFile(filePath, "utf8"),
    limits.deadlineAt,
    limits.maximumDurationMs
  );
  return collectChunks(relativePath, [{ contents }], limits);
}

function positiveLimit(value: number | undefined, fallback: number) {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

function collectChunks(
  relativePath: string,
  sources: Array<{ contents: string; page?: number }>,
  limits: {
    deadlineAt: number;
    maximumChunks: number;
    maximumDurationMs: number;
    maximumOutputBytes: number;
  }
) {
  const chunks: KnowledgeChunk[] = [];
  let serializedBytes = 0;
  for (const { contents, page } of sources) {
    assertKnowledgeDeadline(limits.deadlineAt, limits.maximumDurationMs);
    const normalized = contents.replace(/\r\n?/g, "\n").trim();
    if (!normalized) continue;
    const lines = normalized.split("\n");
    for (let start = 0; start < lines.length; start += 36) {
      assertKnowledgeDeadline(limits.deadlineAt, limits.maximumDurationMs);
      if (chunks.length >= limits.maximumChunks) {
        throw new Error("Knowledge indexing exceeded the cumulative chunk limit.");
      }
      const selected = lines.slice(start, start + 48);
      const content = selected.join("\n").trim().slice(0, 8_000);
      if (!content) continue;
      const chunk: KnowledgeChunk = {
        content,
        end: start + selected.length,
        hash: createHash("sha256").update(content).digest("hex"),
        page,
        path: relativePath,
        section: selected.find((line) => /^#{1,6}\s+/.test(line))?.replace(/^#{1,6}\s+/, ""),
        source: "workspace",
        start: start + 1
      };
      const addition = Buffer.byteLength(JSON.stringify(chunk));
      if (!Number.isSafeInteger(addition) || serializedBytes + addition > limits.maximumOutputBytes) {
        throw new Error(`Knowledge indexing exceeded the cumulative output byte budget (${limits.maximumOutputBytes}).`);
      }
      serializedBytes += addition;
      chunks.push(chunk);
    }
  }
  return { chunks, serializedBytes };
}

function assertKnowledgeDeadline(deadlineAt: number, maximumDurationMs: number) {
  if (Date.now() >= deadlineAt) {
    throw new Error(`Knowledge indexing exceeded the ${maximumDurationMs} ms time budget.`);
  }
}

function withKnowledgeDeadline<T>(operation: Promise<T>, deadlineAt: number, maximumDurationMs: number) {
  assertKnowledgeDeadline(deadlineAt, maximumDurationMs);
  return new Promise<T>((resolve, reject) => {
    const remaining = Math.max(1, deadlineAt - Date.now());
    const timer = setTimeout(
      () => reject(new Error(`Knowledge indexing exceeded the ${maximumDurationMs} ms time budget.`)),
      remaining
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function tokenize(value: string) {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? [])];
}

function scoreChunk(chunk: KnowledgeChunk, terms: string[]) {
  const haystack = `${chunk.path}\n${chunk.content}`.toLowerCase();
  return terms.reduce((score, term) => {
    const matches = haystack.split(term).length - 1;
    const pathBonus = chunk.path.toLowerCase().includes(term) ? 3 : 0;
    return score + Math.min(matches, 12) + pathBonus;
  }, 0);
}
