import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readOpenSlideXKnowledgeResource, searchOpenSlideXKnowledge } from "./knowledge";

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
