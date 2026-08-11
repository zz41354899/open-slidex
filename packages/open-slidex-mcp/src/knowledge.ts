import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type KnowledgeChunk = {
  content: string;
  end: number;
  hash: string;
  page?: number;
  path: string;
  section?: string;
  source: "builtin" | "workspace";
  start: number;
};

type KnowledgeIndex = {
  chunks: KnowledgeChunk[];
  generatedAt: string;
  version: 1;
};

const allowedExtensions = new Set([".csv", ".md", ".markdown", ".pdf", ".txt"]);
const builtInKnowledgeVersion = "motiondoc-v1";
const builtInKnowledge = [
  {
    path: `builtin://${builtInKnowledgeVersion}/components.md`,
    section: "Serializable components",
    content: "OpenSlideX MDX uses built-in serializable MotionDoc JSX blocks. Supported visual blocks include Title, Text, heading, ImageBlock, Icon, Shape, Table, VideoBlock, Group, and Chart. Do not add imports, scripts, JavaScript expressions, or unknown runtime components."
  },
  {
    path: `builtin://${builtInKnowledgeVersion}/charts.md`,
    section: "Chart V1",
    content: "Chart V1 supports bar, line, area, pie, donut, and scatter. Chart data is strict JSON with label and value; scatter may add x, size, and color. Use chartMotion grow for bars, draw for line and area, sweep for pie and donut, and pop for scatter. Preview and HTML animate; PPTX is an editable static final state."
  },
  {
    path: `builtin://${builtInKnowledgeVersion}/motion.md`,
    section: "Motion",
    content: "Use restrained entrance animation and chart motion to clarify hierarchy. Honor reduced-motion preferences. Final-state raster and PPTX export must never hide animated content."
  },
  {
    path: `builtin://${builtInKnowledgeVersion}/layouts.md`,
    section: "Layout",
    content: "Keep every slide inside the 100 by 100 MotionDoc canvas, preserve safe margins, avoid overlap, and favor one clear visual hierarchy. Use Group only for readable layer organization."
  },
  {
    path: `builtin://${builtInKnowledgeVersion}/qa.md`,
    section: "Visual QA",
    content: "Validate source, render a montage, inspect every materially changed slide at desktop size, then verify narrow Workbench layout. Check clipping, contrast, empty states, animation final state, asset portability, HTML, and editable PPTX."
  }
] as const;

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
    .slice(0, Math.min(Math.max(limit, 1), 20));

  return {
    generatedAt: index.generatedAt,
    query,
    results
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
  const chunks = [
    ...builtInKnowledge.map((entry): KnowledgeChunk => ({
      ...entry,
      end: 1,
      hash: createHash("sha256").update(entry.content).digest("hex"),
      source: "builtin",
      start: 1
    })),
    ...(await Promise.all(files.map((file) => fileChunks(actualRoot, file)))).flat()
  ];
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
    const pages = await extractPdfPages(filePath);
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

async function extractPdfPages(filePath: string) {
  const packageName = "pdf-parse";
  const pdfModule = await import(packageName) as unknown as {
    default?: (input: Buffer, options?: { pagerender?: (pageData: PdfPageData) => Promise<string> }) => Promise<{ text?: string }>;
  };
  if (typeof pdfModule.default !== "function") {
    throw new Error("PDF knowledge extraction is unavailable in this installation.");
  }
  let page = 0;
  const marker = "OPENSLIDEX_PAGE_BOUNDARY_";
  const result = await pdfModule.default(await readFile(filePath), {
    pagerender: async (pageData) => {
      const currentPage = ++page;
      const text = await pageData.getTextContent({ disableCombineTextItems: false, normalizeWhitespace: true });
      return `${marker}${currentPage}\n${text.items.map((item) => item.str).join(" ")}`;
    }
  });
  const pages = (result.text ?? "")
    .split(new RegExp(`${marker}\\d+\\n`))
    .map((value) => value.trim())
    .filter(Boolean);
  return pages.length > 0 ? pages : [result.text ?? ""];
}

type PdfPageData = {
  getTextContent(options: { disableCombineTextItems: boolean; normalizeWhitespace: boolean }): Promise<{
    items: Array<{ str: string }>;
  }>;
};

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
