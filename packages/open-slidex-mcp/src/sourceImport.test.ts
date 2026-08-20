import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import JSZip from "jszip";
import sharp from "sharp";

import { parseMotionDoc } from "@open-slidex/sdk";

import { readOpenSlideXSourceImport } from "./sourceImport";

test("reads semantic HTML sections without executing source", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-source-html-"));
  try {
    await writeFile(path.join(root, "brief.html"), `<!doctype html><html><head><title>Plan &amp; Launch</title><script>globalThis.bad = true</script></head><body>
      <section><h1>First</h1><p>Keep &amp; grow.</p><img src="first.png"></section>
      <section><h2>Second</h2><ul><li>One</li><li>Two</li></ul></section>
    </body></html>`);
    const result = await readOpenSlideXSourceImport(root, "brief.html");
    assert.equal(result.format, "html");
    assert.equal(result.sourceTitle, "Plan & Launch");
    assert.equal(result.summary.slideCount, 2);
    assert.deepEqual(result.slides[0]?.text, ["First", "Keep & grow."]);
    assert.equal(result.slides[0]?.imageCount, 1);
    assert.equal(result.slides[1]?.title, "Second");
    await assert.rejects(() => readOpenSlideXSourceImport(root, "../outside.html"), /escapes the configured root/);
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
    archive.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="x" xmlns:a="y" xmlns:r="z"><p:sp><p:txBody><a:p><a:r><a:t>First title</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="5" name="Cover" descr="Roadmap cover"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId5"/></p:blipFill><p:spPr><a:xfrm><a:off x="1333333" y="750000"/><a:ext cx="6666667" cy="3750000"/></a:xfrm></p:spPr></p:pic></p:sld>`);
    archive.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships><Relationship Id="rId5" Target="../media/image1.png"/></Relationships>`);
    archive.file("ppt/media/image1.png", await sharp({ create: { background: "#3457d5", channels: 4, height: 80, width: 160 } }).png().toBuffer());
    await writeFile(path.join(root, "roadmap.pptx"), await archive.generateAsync({ type: "nodebuffer" }));
    const inspected = await readOpenSlideXSourceImport(root, "roadmap.pptx");
    assert.equal(inspected.format, "pptx");
    assert.equal(inspected.sourceTitle, "Roadmap");
    assert.equal(inspected.slides[0]?.images[0]?.status, "not_imported");
    assert.deepEqual(inspected.slides[0]?.images[0]?.geometry, { x: 10, y: 10, w: 50, h: 50 });

    const imported = await readOpenSlideXSourceImport(root, "roadmap.pptx", { importMedia: true });
    const image = imported.slides[0]?.images[0];
    assert.equal(image?.status, "imported");
    assert.match(image?.source ?? "", /^assets\/image1-[a-f0-9]{16}\.webp$/);
    assert.match(image?.imageBlock ?? "", /<ImageBlock id="pptx-slide-1-image-1"/);
    await access(path.join(root, image!.source!));
    const mdx = `# Imported Roadmap\n\n<Slide duration={5} background="#ffffff">${image!.imageBlock}</Slide>`;
    assert.equal(parseMotionDoc(mdx).scenes.length, 1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
