import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOpenSlideXKnowledgeIndex,
  readOpenSlideXKnowledgeResource,
  searchOpenSlideXKnowledge
} from "./knowledge";

test("local knowledge search returns compact citations and reads one resource on demand", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-knowledge-"));
  try {
    await mkdir(path.join(root, "knowledge"));
    await writeFile(path.join(root, "knowledge", "brand.md"), "# Brand\n\nUse cobalt for product charts and coral for warnings.\n", "utf8");
    await writeFile(path.join(root, "knowledge", "metrics.csv"), "quarter,revenue\nQ1,42\nQ2,58\n", "utf8");
    await writeFile(
      path.join(root, "knowledge", "research.txt"),
      Array.from({ length: 200 }, (_, index) => `Research line ${index + 1}`).join("\n"),
      "utf8"
    );

    const result = await searchOpenSlideXKnowledge(root, "cobalt coral");
    assert.equal(result.results[0]?.path, "brand.md");
    assert.equal(result.results[0]?.section, "Brand");
    assert.equal(result.results[0]?.source, "workspace");
    assert.match(result.results[0]?.hash ?? "", /^[0-9a-f]{64}$/);
    assert.equal(result.results[0]?.start, 1);
    assert.equal(result.results[0]?.resourcePath, "knowledge/brand.md");
    assert.match(result.results[0]?.snippet ?? "", /cobalt/);
    assert.equal("content" in result.results[0]!, false);

    const resource = await readOpenSlideXKnowledgeResource(root, "knowledge/brand.md");
    assert.equal(resource.mode, "resource");
    assert.equal(resource.totalChunks, 1);
    assert.match(resource.chunks[0]?.content ?? "", /coral for warnings/);
    await assert.rejects(
      () => readOpenSlideXKnowledgeResource(root, "knowledge/../package.json"),
      /exact knowledge/
    );
    const firstPage = await readOpenSlideXKnowledgeResource(root, "knowledge/research.txt");
    assert.equal(firstPage.chunks.length, 4);
    assert.equal(firstPage.nextCursor, 4);
    const secondPage = await readOpenSlideXKnowledgeResource(root, "knowledge/research.txt", firstPage.nextCursor);
    assert.equal(secondPage.chunks.length, 2);
    assert.equal(secondPage.nextCursor, undefined);

    const index = JSON.parse(await readFile(path.join(root, ".open-slidex", "knowledge-index.json"), "utf8"));
    assert.equal(index.version, 1);
    assert.equal(index.chunks.length, 8);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("knowledge index rejects a symlinked workspace state directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-knowledge-boundary-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "open-slidex-outside-"));
  try {
    await mkdir(path.join(root, "knowledge"));
    await symlink(outside, path.join(root, ".open-slidex"));
    await assert.rejects(
      () => searchOpenSlideXKnowledge(root, "chart"),
      /must be a real directory/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outside, { force: true, recursive: true });
  }
});

test("knowledge indexing enforces cumulative file, input, and output budgets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-knowledge-budgets-"));
  try {
    await mkdir(path.join(root, "knowledge"));
    await writeFile(path.join(root, "knowledge", "one.md"), "# One\n\nfirst", "utf8");
    await writeFile(path.join(root, "knowledge", "two.md"), "# Two\n\nsecond", "utf8");

    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumFiles: 1 }),
      /1-file limit/
    );
    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumInputBytes: 1 }),
      /cumulative input byte budget/
    );
    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumOutputBytes: 1 }),
      /cumulative output byte budget/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("knowledge indexing bounds directory traversal, chunk creation, and serialized metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-knowledge-structure-budgets-"));
  try {
    const knowledgeRoot = path.join(root, "knowledge");
    await mkdir(path.join(knowledgeRoot, "one", "two"), { recursive: true });
    await Promise.all([
      writeFile(path.join(knowledgeRoot, "ignored-a.bin"), "a", "utf8"),
      writeFile(path.join(knowledgeRoot, "ignored-b.bin"), "b", "utf8"),
      writeFile(
        path.join(knowledgeRoot, "many-lines.md"),
        Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n"),
        "utf8"
      )
    ]);

    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumEntries: 1 }),
      /1-entry traversal limit/
    );
    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumDepth: 1 }),
      /1-level directory depth limit/
    );
    await assert.rejects(
      () => buildOpenSlideXKnowledgeIndex(root, { maximumChunks: 1 }),
      /cumulative chunk limit/
    );

    await buildOpenSlideXKnowledgeIndex(root, { maximumOutputBytes: 8_192 });
    const serialized = await readFile(path.join(root, ".open-slidex", "knowledge-index.json"));
    assert.ok(serialized.byteLength <= 8_192);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
