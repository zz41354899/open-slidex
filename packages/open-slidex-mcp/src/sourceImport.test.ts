import assert from "node:assert/strict";
import { access, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import JSZip from "jszip";
import sharp from "sharp";

import { parseMotionDoc } from "@open-slidex/sdk";

import { readBoundedPptxEntry, readOpenSlideXSourceImport } from "./sourceImport";

test("rejects HTML and accepts PPTX as the only source-import format", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-source-format-"));
  try {
    await writeFile(path.join(root, "brief.html"), "<h1>Unsupported</h1>");
    await assert.rejects(() => readOpenSlideXSourceImport(root, "brief.html"), /supports \.pptx files only/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("converts an embedded PPTX image into WebP and supplies valid ImageBlock geometry", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-source-pptx-"));
  try {
    const archive = new JSZip();
    archive.file("docProps/core.xml", `<cp:coreProperties xmlns:dc="x"><dc:title>Roadmap</dc:title></cp:coreProperties>`);
    archive.file("ppt/presentation.xml", `<p:presentation xmlns:p="x" xmlns:r="y"><p:sldSz cx="13333333" cy="7500000"/><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
    archive.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`);
    archive.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="x" xmlns:a="y" xmlns:r="z"><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="1333333" y="750000"/><a:ext cx="8000000" cy="1000000"/></a:xfrm></p:spPr><p:txBody><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="3200" b="1"/><a:t>First title</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="5" name="Cover" descr="Roadmap cover"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId5"/></p:blipFill><p:spPr><a:xfrm><a:off x="1333333" y="750000"/><a:ext cx="6666667" cy="3750000"/></a:xfrm></p:spPr></p:pic><p:pic><p:nvPicPr><p:cNvPr id="6" name="Repeated cover"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId5"/></p:blipFill><p:spPr><a:xfrm><a:off x="6666667" y="3750000"/><a:ext cx="3333333" cy="1875000"/></a:xfrm></p:spPr></p:pic></p:sld>`);
    archive.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships><Relationship Id="rId5" Target="../media/image1.png"/></Relationships>`);
    archive.file("ppt/media/image1.png", await sharp({ create: { background: "#3457d5", channels: 4, height: 80, width: 160 } }).png().toBuffer());
    await writeFile(path.join(root, "roadmap.pptx"), await archive.generateAsync({ type: "nodebuffer" }));
    const inspected = await readOpenSlideXSourceImport(root, "roadmap.pptx");
    assert.equal(inspected.format, "pptx");
    assert.equal(inspected.sourceTitle, "Roadmap");
    assert.equal(inspected.slides[0]?.title, "First title");
    assert.deepEqual(inspected.slides[0]?.textFrames[0]?.geometry, { x: 10, y: 10, w: 60, h: 13.3333 });
    assert.equal(inspected.slides[0]?.textFrames[0]?.fontSizePt, 32);
    assert.equal(inspected.slides[0]?.textFrames[0]?.fontWeight, 700);
    assert.equal(inspected.slides[0]?.textFrames[0]?.alignment, "center");
    assert.equal(inspected.slides[0]?.textFrames[0]?.titleHint, true);
    assert.match(inspected.slides[0]?.textFrames[0]?.textBlock ?? "", /<Text id="pptx-slide-1-text-1" role="title"/);
    assert.equal(inspected.slides[0]?.images[0]?.status, "not_imported");
    assert.deepEqual(inspected.slides[0]?.images[0]?.geometry, { x: 10, y: 10, w: 50, h: 50 });

    const imported = await readOpenSlideXSourceImport(root, "roadmap.pptx", { importMedia: true });
    const image = imported.slides[0]?.images[0];
    assert.equal(image?.status, "imported");
    assert.match(image?.source ?? "", /^assets\/image1-[a-f0-9]{16}\.webp$/);
    assert.match(image?.imageBlock ?? "", /<ImageBlock id="pptx-slide-1-image-1"/);
    await access(path.join(root, image!.source!));
    assert.equal(imported.slides[0]?.images[1]?.source, image?.source);
    assert.equal((await readdir(path.join(root, "assets"))).filter((name) => name.endsWith(".webp")).length, 1);
    const mdx = `# Imported Roadmap\n\n<Slide duration={5} background="#ffffff">${image!.imageBlock}</Slide>`;
    assert.equal(parseMotionDoc(mdx).scenes.length, 1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("bounds actual PPTX entry output even when ZIP metadata understates it", async () => {
  const archive = new JSZip();
  archive.file("payload.bin", "x".repeat(128 * 1024));
  const bytes = Buffer.from(await archive.generateAsync({ compression: "DEFLATE", type: "nodebuffer" }));
  for (let offset = 0; offset <= bytes.length - 4; offset += 1) {
    const signature = bytes.readUInt32LE(offset);
    if (signature === 0x04034b50) bytes.writeUInt32LE(1, offset + 22);
    if (signature === 0x02014b50) bytes.writeUInt32LE(1, offset + 24);
  }
  const loaded = await JSZip.loadAsync(bytes, { createFolders: false });
  const entry = loaded.file("payload.bin");
  assert.ok(entry);
  await assert.rejects(
    () => readBoundedPptxEntry(entry!, { add() {} }, 64 * 1024),
    /entry exceeds 65536 bytes/
  );
});

test("rejects PPTX files with an excessive number of picture frames", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-source-pptx-frames-"));
  try {
    const archive = new JSZip();
    archive.file("ppt/presentation.xml", `<p:presentation xmlns:p="x" xmlns:r="y"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
    archive.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/></Relationships>`);
    const picture = `<p:pic><p:nvPicPr><p:cNvPr id="1" name="Repeated"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId5"/></p:blipFill></p:pic>`;
    archive.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="x" xmlns:a="y" xmlns:r="z">${picture.repeat(1_001)}</p:sld>`);
    archive.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships><Relationship Id="rId5" Target="../media/image1.png"/></Relationships>`);
    archive.file("ppt/media/image1.png", "unused");
    await writeFile(path.join(root, "frames.pptx"), await archive.generateAsync({ type: "nodebuffer" }));
    await assert.rejects(
      () => readOpenSlideXSourceImport(root, "frames.pptx"),
      /more than 1000 picture frames/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
