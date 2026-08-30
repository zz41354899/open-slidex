import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCanvas, PDFDocument } from "@napi-rs/canvas";

import { searchOpenSlideXKnowledge } from "./knowledge";
import { ingestOpenSlideXSource } from "./sourceIntake";

const revision = `sha256:${"a".repeat(64)}`;

test("source intake moves Markdown to knowledge and imports local and Notion-style remote images", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "open-slidex-intake-"));
  const projectRoot = path.join(workspace, "deck");
  const inboxRoot = path.join(workspace, ".open-slidex-inbox");
  try {
    await Promise.all([mkdir(projectRoot), mkdir(inboxRoot)]);
    const png = imagePng("#2255dd");
    await writeFile(path.join(inboxRoot, "local.png"), png);
    await writeFile(
      path.join(inboxRoot, "brief.md"),
      "# Launch brief\n\nKeep the local diagram.\n\n![Local](local.png)\n![Notion](https://prod-files-secure.s3.us-west-2.amazonaws.com/signed/image.png)\n",
      "utf8"
    );

    const result = await ingestOpenSlideXSource({
      downloadImage: async (url) => ({
        bytes: png,
        fileName: "notion-image.png",
        finalUrl: url,
        mediaType: "image/png",
        originalUrl: url
      }),
      expectedRevision: revision,
      filePath: "brief.md",
      inboxRoot,
      projectRoot
    });

    assert.equal(result.kind, "document");
    assert.match(result.knowledgePath ?? "", /^knowledge\/brief-[0-9a-f]{16}\.md$/);
    assert.equal(result.assets.length, 2);
    assert.deepEqual(result.assets.map((asset) => asset.origin.kind).sort(), ["markdown-local", "markdown-url"]);
    for (const asset of result.assets) {
      assert.match(asset.source, /^assets\/.+\.webp$/);
      assert.equal((await stat(path.join(projectRoot, asset.source))).isFile(), true);
    }
    await assert.rejects(readFile(path.join(inboxRoot, "brief.md")), /ENOENT/);
    assert.equal((await stat(path.join(inboxRoot, "local.png"))).isFile(), true);
    const knowledge = await searchOpenSlideXKnowledge(projectRoot, "launch brief");
    assert.equal(knowledge.results[0]?.resourcePath, result.knowledgePath);
    const provenance = JSON.parse(await readFile(path.join(projectRoot, ".open-slidex", "asset-provenance.json"), "utf8")) as unknown[];
    assert.equal(provenance.length, 2);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("source intake extracts PDF text, embedded images, and a vector page fallback", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "open-slidex-pdf-intake-"));
  const projectRoot = path.join(workspace, "deck");
  const inboxRoot = path.join(workspace, ".open-slidex-inbox");
  try {
    await Promise.all([mkdir(projectRoot), mkdir(inboxRoot)]);
    const pdf = new PDFDocument();
    const page = pdf.beginPage(640, 360);
    const image = createCanvas(80, 40);
    const imageContext = image.getContext("2d");
    imageContext.fillStyle = "#22aa66";
    imageContext.fillRect(0, 0, 80, 40);
    (page as unknown as {
      drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
    }).drawImage(image, 40, 40, 240, 120);
    page.fillStyle = "#ff8844";
    page.fillRect(330, 40, 200, 120);
    page.fillStyle = "#111111";
    page.font = "28px sans-serif";
    page.fillText("Quarterly evidence", 40, 240);
    pdf.endPage();
    await writeFile(path.join(inboxRoot, "report.pdf"), pdf.close());

    const result = await ingestOpenSlideXSource({ expectedRevision: revision, filePath: "report.pdf", inboxRoot, projectRoot });
    assert.equal(result.kind, "document");
    assert.equal(result.assets.some((asset) => asset.origin.kind === "pdf-embedded"), true);
    assert.equal(result.assets.some((asset) => asset.origin.kind === "pdf-page"), true);
    const knowledge = await searchOpenSlideXKnowledge(projectRoot, "Quarterly evidence");
    assert.equal(knowledge.results[0]?.page, 1);
    assert.equal(knowledge.results[0]?.resourcePath, result.knowledgePath);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("source intake imports one public AI image URL and rejects inbox escape", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "open-slidex-image-intake-"));
  const projectRoot = path.join(workspace, "deck");
  const inboxRoot = path.join(workspace, ".open-slidex-inbox");
  try {
    await Promise.all([mkdir(projectRoot), mkdir(inboxRoot)]);
    const png = imagePng("#cc2277");
    const url = "https://cdn.example.com/generated/hero.png";
    const imported = await ingestOpenSlideXSource({
      downloadImage: async () => ({ bytes: png, fileName: "hero.png", finalUrl: url, mediaType: "image/png", originalUrl: url }),
      expectedRevision: revision,
      filePath: url,
      inboxRoot,
      projectRoot
    });
    assert.equal(imported.assets[0]?.origin.kind, "ai-or-local");
    assert.match(imported.assets[0]?.source ?? "", /^assets\/.+\.webp$/);
    await writeFile(path.join(workspace, "outside.txt"), "outside", "utf8");
    await assert.rejects(
      () => ingestOpenSlideXSource({ expectedRevision: revision, filePath: "../outside.txt", inboxRoot, projectRoot }),
      /escapes the configured root/
    );
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

function imagePng(color: string) {
  const canvas = createCanvas(64, 36);
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new Uint8Array(canvas.toBuffer("image/png"));
}
