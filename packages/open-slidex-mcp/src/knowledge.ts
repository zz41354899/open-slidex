import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
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

export async function buildOpenSlideXKnowledgeIndex(projectRoot: string) {
  const root = path.resolve(projectRoot);
  const knowledgeRoot = path.join(root, "knowledge");
  const stateRoot = path.join(root, ".open-slidex");
  await Promise.all([mkdir(knowledgeRoot, { recursive: true }), mkdir(stateRoot, { recursive: true })]);
  await Promise.all([
    assertRealDirectory(root, knowledgeRoot, "knowledge"),
    assertRealDirectory(root, stateRoot, ".open-slidex")
  ]);
  const actualRoot = await realpath(knowledgeRoot);
  const actualStateRoot = await realpath(stateRoot);
  const files = await listKnowledgeFiles(actualRoot);
  const chunks = (await Promise.all(files.map((file) => fileChunks(actualRoot, file)))).flat();
  const index: KnowledgeIndex = {
    chunks,
    generatedAt: new Date().toISOString(),
    version: 1
  };
  await writeFile(path.join(actualStateRoot, "knowledge-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
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

async function listKnowledgeFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const targetStats = await lstat(target);
      if (targetStats.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(target);
      } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(target);
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function fileChunks(root: string, filePath: string) {
  const relativePath = path.relative(root, filePath).split(path.sep).join("/");
  if (relativePath.startsWith("../")) return [];
  const fileStats = await stat(filePath);
  if (fileStats.size > 20 * 1024 * 1024) return [];
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    const pages = await extractPdfTextPages(new Uint8Array(await readFile(filePath)));
    return pages.flatMap((contents, pageIndex) => chunksFromText(relativePath, contents, pageIndex + 1));
  }
  return chunksFromText(relativePath, await readFile(filePath, "utf8"));
}

function chunksFromText(relativePath: string, contents: string, page?: number) {
  const normalized = contents.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const chunks: KnowledgeChunk[] = [];
  for (let start = 0; start < lines.length; start += 36) {
    const selected = lines.slice(start, start + 48);
    const content = selected.join("\n").trim();
    if (!content) continue;
    chunks.push({
      content: content.slice(0, 8_000),
      end: start + selected.length,
      hash: createHash("sha256").update(content).digest("hex"),
      page,
      path: relativePath,
      section: selected.find((line) => /^#{1,6}\s+/.test(line))?.replace(/^#{1,6}\s+/, ""),
      source: "workspace",
      start: start + 1
    });
  }
  return chunks;
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
