import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import sharp from "sharp";

import { blankPresentationMdx } from "./index";
import {
  analyzeSlideXDocumentQuality,
  closeSlideXChromiumPool,
  exportSlideXDocument,
  importSlideXImageAsset,
  importSlideXVideoAsset,
  renderSlideXDocument,
  SlideXFileDocumentAdapter,
  SlideXImageAssetError,
  SlideXRevisionConflictError
} from "./node";

const execFileAsync = promisify(execFile);

test.after(async () => {
  await closeSlideXChromiumPool();
  const packagedRuntime = await import("../../open-slidex/runtime/sdk/node.js");
  await packagedRuntime.closeSlideXChromiumPool();
});

test("Paper shader rendering freezes a real frame instead of a flat fallback", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-shader-render-"));
  const outputPath = path.join(root, "shader.png");
  try {
    await renderSlideXDocument({
      mode: "slide",
      outputPath,
      slideIndex: 0,
      source: `# Shader render

<Slide theme="light" background="#38BDF8" shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={1200} shaderSpeed={0.1} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447">
</Slide>`
    });
    const stats = await sharp(outputPath).stats();
    assert.ok(
      stats.channels.slice(0, 3).some((channel) => channel.stdev > 8),
      "expected the frozen shader frame to contain visible color variation"
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("PowerPoint shader backgrounds are stored as real PNG media", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-pptx-shader-"));
  const outputPath = path.join(root, "shader.pptx");
  try {
    // PPTX uses the generated browser bundle, so exercise the packaged runtime
    // that users receive after the release build.
    const { exportSlideXDocument: exportPackagedSlideXDocument } = await import(
      "../../open-slidex/runtime/sdk/node.js"
    );
    await exportPackagedSlideXDocument({
      format: "pptx",
      outputPath,
      source: `# Shader PowerPoint

<Slide theme="light" background="#38BDF8" shader="mesh-gradient" shaderPreset="Beach" shaderFrame={1200} shaderSpeed={0.1} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447">
</Slide>`
    });
    const { stdout: archiveEntries } = await execFileAsync("unzip", ["-Z1", outputPath]);
    const backgroundEntry = archiveEntries
      .split("\n")
      .find((entry) => /^ppt\/media\/.*\.png$/.test(entry));
    assert.ok(backgroundEntry, "expected the shader background image in the PPTX archive");
    const { stdout: image } = await execFileAsync(
      "unzip",
      ["-p", outputPath, backgroundEntry],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }
    );
    assert.deepEqual(Buffer.from(image).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("PowerPoint paper-texture backgrounds do not freeze an opaque black placeholder", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-pptx-paper-texture-"));
  const outputPath = path.join(root, "paper-texture.pptx");
  try {
    const { exportSlideXDocument: exportPackagedSlideXDocument } = await import(
      "../../open-slidex/runtime/sdk/node.js"
    );
    await exportPackagedSlideXDocument({
      format: "pptx",
      outputPath,
      source: `# Paper texture PowerPoint

<Slide theme="light" background="#DCE5F2" shader="paper-texture" shaderPreset="Default" shaderFrame={0} shaderSpeed={0} shaderScale={1} shaderIntensity={0.5} shaderSoftness={0.5} shaderDetail={0.5} shaderColor1="#DCE5F2" shaderColor2="#AAB8CC" shaderColor3="#DCE5F2" shaderColor4="#DCE5F2" shaderColor5="#DCE5F2" shaderColor6="#DCE5F2">
  <Text x={5} y={28} w={64} h={16} fontSize={56} fontFamily="Dancing Script" color="#FFF9F2">Welcome</Text>
</Slide>`
    });
    const { stdout: archiveEntries } = await execFileAsync("unzip", ["-Z1", outputPath]);
    const backgroundEntry = archiveEntries
      .split("\n")
      .find((entry) => /^ppt\/media\/.*\.png$/.test(entry));
    assert.ok(backgroundEntry, "expected the paper-texture background image in the PPTX archive");
    const { stdout: image } = await execFileAsync(
      "unzip",
      ["-p", outputPath, backgroundEntry],
      { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 }
    );
    const { data, info } = await sharp(Buffer.from(image)).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1280, "expected the performance-optimized PPTX raster width");
    assert.equal(info.height, 720, "expected the performance-optimized PPTX raster height");
    let opaqueBlackPixels = 0;
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index] < 8 && data[index + 1] < 8 && data[index + 2] < 8 && data[index + 3] > 250) {
        opaqueBlackPixels += 1;
      }
    }
    assert.ok(
      opaqueBlackPixels / (info.width * info.height) < 0.01,
      "expected the paper-texture background to avoid a large opaque black rectangle"
    );
    const { stdout: slideXml } = await execFileAsync(
      "unzip",
      ["-p", outputPath, "ppt/slides/slide1.xml"],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    assert.match(
      slideXml,
      /<a:t>Welcome<\/a:t>/,
      "expected text above the rasterized paper texture to remain a native editable PowerPoint shape"
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("quality analysis honors a pre-aborted run before Chromium work", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => analyzeSlideXDocumentQuality({ signal: controller.signal, source: blankPresentationMdx }),
    { name: "AbortError" }
  );
});

test("file adapter uses revision CAS and does not persist a stale save", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-"));
  try {
    const adapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const created = await adapter.create(blankPresentationMdx);
    const saved = await adapter.save({
      expectedRevision: created.revision,
      source: blankPresentationMdx.replace("Untitled Presentation", "Saved"),
      title: "Saved"
    });
    await assert.rejects(
      () =>
        adapter.save({
          expectedRevision: created.revision,
          source: blankPresentationMdx.replace("Untitled Presentation", "Stale"),
          title: "Stale"
        }),
      SlideXRevisionConflictError
    );
    assert.equal((await adapter.open()).revision, saved.revision);
    assert.match(await readFile(path.join(root, "presentation.mdx"), "utf8"), /^# Saved/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("file adapter preserves CommonMark while assigning stable editable identities", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-markdown-"));
  const source = `# Authored source

<Slide duration={5} theme="light">

## Keep this Markdown

A **bold** sentence and a [link](https://example.com).

- First
- Second

</Slide>`;
  try {
    const adapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const created = await adapter.create(source);
    assert.match(created.source, /## Keep this Markdown <!-- slidex-block-id:block-/);
    assert.match(created.source, /A \*\*bold\*\* sentence/);
    assert.match(created.source, /- First <!-- slidex-block-id:block-/);
    assert.equal(
      await readFile(path.join(root, "presentation.mdx"), "utf8"),
      created.source
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("file adapter validates the complete batch before atomic persistence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-"));
  try {
    const adapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const created = await adapter.create(blankPresentationMdx);
    await assert.rejects(
      () =>
        adapter.edit(created.revision, [
          { title: "Partial", type: "document.setTitle" },
          { slideIndex: 9, type: "slide.delete" }
        ]),
      /commands\[1\]/
    );
    assert.equal((await adapter.open()).revision, created.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("file adapter rejects an unknown command without changing the file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-unknown-"));
  try {
    const adapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const created = await adapter.create(blankPresentationMdx);
    await assert.rejects(
      () =>
        adapter.edit(created.revision, [
          { type: "slide.teleport" } as never
        ]),
      /Unknown command type: slide\.teleport/
    );
    assert.equal((await adapter.open()).revision, created.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("exports reject invalid motion before writing an output", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-export-"));
  const outputPath = path.join(root, "invalid.html");
  try {
    await assert.rejects(
      () =>
        exportSlideXDocument({
          format: "html",
          outputPath,
          source: `# Invalid

<Slide slideTransition="explode"><Text>Invalid</Text></Slide>`
        }),
      /slideTransition must be one of/
    );
    await assert.rejects(() => readFile(outputPath), { code: "ENOENT" });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("export preparation embeds an absolute project image path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-absolute-image-"));
  const imagePath = path.join(root, "hero.png");
  const outputPath = path.join(root, "deck.html");
  try {
    await sharp({
      create: { background: "#3355aa", channels: 3, height: 8, width: 8 }
    })
      .png()
      .toFile(imagePath);

    await exportSlideXDocument({
      format: "html",
      outputPath,
      projectRoot: root,
      source: `# Absolute image

<Slide>
  <ImageBlock src="${imagePath}" alt="Hero" />
  <Shape shape="rectangle" shapeImageSrc="${imagePath}" />
</Slide>`
    });

    const html = await readFile(outputPath, "utf8");
    assert.match(html, /data:image\/png;base64,/);
    assert.doesNotMatch(html, new RegExp(imagePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("MDX export embeds project images into one portable source file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-portable-mdx-"));
  const assetsRoot = path.join(root, "assets");
  const imagePath = path.join(assetsRoot, "portable.webp");
  const outputPath = path.join(root, "portable.mdx");
  try {
    await mkdir(assetsRoot, { recursive: true });
    await sharp({
      create: { background: "#224924", channels: 3, height: 8, width: 8 }
    })
      .webp()
      .toFile(imagePath);

    await exportSlideXDocument({
      format: "mdx",
      outputPath,
      projectRoot: root,
      source: `# Portable MDX\n\n<Slide><ImageBlock src="assets/portable.webp" alt="Portable image" /></Slide>\n`
    });

    const portableMdx = await readFile(outputPath, "utf8");
    assert.match(portableMdx, /src="data:image\/webp;base64,/);
    assert.doesNotMatch(portableMdx, /assets\/portable\.webp/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("two concurrent writers cannot both commit the same revision", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-concurrent-"));
  try {
    const firstAdapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const secondAdapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const initial = await firstAdapter.create(blankPresentationMdx);
    const results = await Promise.allSettled([
      firstAdapter.save({
        expectedRevision: initial.revision,
        source: initial.source.replace("Untitled Presentation", "First writer"),
        title: "First writer"
      }),
      secondAdapter.save({
        expectedRevision: initial.revision,
        source: initial.source.replace("Untitled Presentation", "Second writer"),
        title: "Second writer"
      })
    ]);

    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1
    );
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.match(String(rejected.reason), /presentation\.mdx changed/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("file adapter recovers a lock left by a dead process", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-stale-lock-"));
  try {
    const adapter = new SlideXFileDocumentAdapter({ projectRoot: root });
    const initial = await adapter.create(blankPresentationMdx);
    await writeFile(`${adapter.documentPath}.lock`, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      ownerId: "crashed-writer",
      pid: 2_147_483_647
    })}\n`, "utf8");
    const saved = await adapter.save({
      expectedRevision: initial.revision,
      source: initial.source.replace("Untitled Presentation", "Recovered"),
      title: "Recovered"
    });
    assert.equal(saved.title, "Recovered");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("image imports use binary input, normalize to WebP, and deduplicate by content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-image-"));
  try {
    const source = await sharp({
      create: {
        background: "#cc5533",
        channels: 4,
        height: 1600,
        width: 3200
      }
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "remove me" } } })
      .toBuffer();

    const imported = await importSlideXImageAsset({
      bytes: source,
      fileName: "Launch Hero.jpg",
      mediaType: "image/jpeg",
      projectRoot: root
    });
    assert.equal(imported.mimeType, "image/webp");
    assert.equal(imported.inputMimeType, "image/jpeg");
    assert.equal(imported.optimized, true);
    assert.equal(imported.targetOutputBytes, 2 * 1024 * 1024);
    assert.ok(imported.bytes <= imported.targetOutputBytes);
    assert.equal(imported.deduplicated, false);
    assert.match(imported.name, /^Launch-Hero-[a-f0-9]{16}\.webp$/);
    assert.equal(imported.source, `assets/${imported.name}`);
    assert.doesNotMatch(imported.source, /^(?:data:|https?:)/);

    const stored = await readFile(imported.outputPath);
    const metadata = await sharp(stored).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 2304);
    assert.equal(metadata.height, 1152);
    assert.equal(metadata.exif, undefined);

    const duplicate = await importSlideXImageAsset({
      bytes: source,
      fileName: "Launch Hero.jpg",
      mediaType: "image/jpeg",
      projectRoot: root
    });
    assert.equal(duplicate.outputPath, imported.outputPath);
    assert.equal(duplicate.deduplicated, true);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("MP4 imports stay local, preserve bytes, and deduplicate by content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-video-"));
  try {
    const bytes = minimalMp4();
    const imported = await importSlideXVideoAsset({
      bytes,
      fileName: "Launch clip.mp4",
      mediaType: "video/mp4",
      projectRoot: root
    });
    assert.equal(imported.mimeType, "video/mp4");
    assert.match(imported.name, /^Launch-clip-[a-f0-9]{16}\.mp4$/);
    assert.equal(imported.source, `assets/${imported.name}`);
    assert.deepEqual(await readFile(imported.outputPath), Buffer.from(bytes));

    const duplicate = await importSlideXVideoAsset({
      bytes,
      fileName: "Launch clip.mp4",
      mediaType: "video/mp4",
      projectRoot: root
    });
    assert.equal(duplicate.deduplicated, true);
    await assert.rejects(
      () => importSlideXVideoAsset({ bytes: new Uint8Array([0, 1, 2]), fileName: "broken.mp4", mediaType: "video/mp4", projectRoot: root }),
      /valid MP4 container/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function minimalMp4() {
  return new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d]);
}

test("image imports use quality and dimension ladders to honor a custom output budget", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-image-budget-"));
  try {
    const width = 1600;
    const height = 1000;
    const source = await sharp(randomBytes(width * height * 3), {
      raw: { channels: 3, height, width }
    }).png().toBuffer();
    const targetOutputBytes = 96 * 1024;
    const imported = await importSlideXImageAsset({
      bytes: source,
      fileName: "noisy.png",
      mediaType: "image/png",
      projectRoot: root,
      targetOutputBytes
    });

    assert.equal(imported.targetOutputBytes, targetOutputBytes);
    assert.ok(imported.bytes <= targetOutputBytes);
    assert.ok(imported.width < width || imported.height < height);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("image imports reject Base64, data URLs, corrupt bytes, and MIME mismatches", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-sdk-image-policy-"));
  try {
    const png = await sharp({
      create: {
        background: "#112233",
        channels: 4,
        height: 16,
        width: 16
      }
    })
      .png()
      .toBuffer();

    await assert.rejects(
      () =>
        importSlideXImageAsset({
          bytes: "data:image/png;base64,AAAA" as never,
          fileName: "inline.png",
          mediaType: "image/png",
          projectRoot: root
        }),
      (error) =>
        error instanceof SlideXImageAssetError &&
        error.code === "invalid_source" &&
        /Base64/.test(error.message)
    );
    await assert.rejects(
      () =>
        importSlideXImageAsset({
          bytes: png,
          fileName: "data:image/png;base64,AAAA",
          mediaType: "image/png",
          projectRoot: root
        }),
      (error) =>
        error instanceof SlideXImageAssetError &&
        error.code === "invalid_source"
    );
    await assert.rejects(
      () =>
        importSlideXImageAsset({
          bytes: png,
          fileName: "wrong.jpg",
          mediaType: "image/jpeg",
          projectRoot: root
        }),
      (error) =>
        error instanceof SlideXImageAssetError &&
        error.code === "invalid_image"
    );
    await assert.rejects(
      () =>
        importSlideXImageAsset({
          bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          fileName: "broken.png",
          mediaType: "image/png",
          projectRoot: root
        }),
      (error) => error instanceof SlideXImageAssetError
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
