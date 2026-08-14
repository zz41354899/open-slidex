import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SlideXRevisionConflictError } from "@open-slidex/sdk/node";
import sharp from "sharp";

import { SlideXProject } from "./project";

const source = `# Workbench project

<Slide id="opening">
  <Text id="title" role="title">Local source</Text>
  <ImageBlock id="hero" src="assets/hero.webp" alt="Hero" />
</Slide>`;

test("Workbench project keeps document, context, and asset renames revision-safe", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-project-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    await writeFile(path.join(project.assetsRoot, "hero.webp"), "asset", "utf8");

    const opened = await project.open();
    assert.equal(opened.validation.isValid, true);
    assert.equal((await project.listAssets())[0]?.usedBy.length, 1);

    await project.writeCurrent({
      nodeId: "hero",
      revision: opened.revision,
      slideIndex: 0
    });
    const current = JSON.parse(
      await readFile(path.join(project.stateRoot, "current.json"), "utf8")
    );
    assert.equal(current.blockId, "hero");
    assert.equal(current.slideId, "opening");

    await project.writeCurrent({
      nodeId: "removed-layer",
      revision: opened.revision,
      slideIndex: 0
    });
    const staleSelection = JSON.parse(
      await readFile(path.join(project.stateRoot, "current.json"), "utf8")
    );
    assert.equal(staleSelection.blockId, undefined);
    assert.equal(staleSelection.blockType, undefined);
    assert.equal(staleSelection.slideId, "opening");

    const renamed = await project.renameAsset({
      expectedRevision: opened.revision,
      from: "assets/hero.webp",
      to: "assets/renamed.webp"
    });
    assert.match(renamed.source, /assets\/renamed\.webp/);
    await assert.rejects(
      () => access(path.join(project.assetsRoot, "hero.webp")),
      { code: "ENOENT" }
    );
    await access(path.join(project.assetsRoot, "renamed.webp"));

    await assert.rejects(
      () =>
        project.renameAsset({
          expectedRevision: opened.revision,
          from: "assets/renamed.webp",
          to: "assets/stale.webp"
        }),
      SlideXRevisionConflictError
    );
    await assert.rejects(
      () => project.importAsset(new File(["not-read"], "stale.png", { type: "image/png" }), opened.revision),
      SlideXRevisionConflictError
    );
    await assert.rejects(
      () => project.deleteAsset("assets/renamed.webp", renamed.revision),
      /still referenced/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project rejects invalid saves and preserves the last valid file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-invalid-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const opened = await project.open();

    await assert.rejects(
      () =>
        project.save({
          expectedRevision: opened.revision,
          source: "# Invalid\n\n<Slide><Widget /></Slide>",
          title: "Invalid"
        }),
      /invalid/
    );
    assert.equal((await project.open()).revision, opened.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project saves HTTPS image and video links", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-local-media-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const opened = await project.open();

    const saved = await project.save({
      expectedRevision: opened.revision,
      source: source
        .replace("assets/hero.webp", "https://images.unsplash.com/remote.webp")
        .replace("</Slide>", "  <VideoBlock id=\"video\" src=\"https://cdn.example.com/launch.mp4\" poster=\"https://images.unsplash.com/poster.webp\" />\n</Slide>"),
      title: "Remote media"
    });
    assert.match(saved.source, /https:\/\/images\.unsplash\.com\/remote\.webp/);
    assert.match(saved.source, /https:\/\/cdn\.example\.com\/launch\.mp4/);
    assert.match(saved.source, /https:\/\/images\.unsplash\.com\/poster\.webp/);

    assert.equal((await project.open()).revision, saved.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project imports an MP4 for a local VideoBlock", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-video-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const opened = await project.open();
    const asset = await project.importAsset(
      new File([minimalMp4()], "launch.mp4", { type: "video/mp4" }),
      opened.revision
    );
    const saved = await project.save({
      expectedRevision: opened.revision,
      source: `# Video\n\n<Slide><VideoBlock src="${asset.source}" controls="true" /></Slide>`,
      title: "Video"
    });

    assert.equal(asset.mimeType, "video/mp4");
    assert.match(asset.source, /^assets\/launch-[a-f0-9]{16}\.mp4$/);
    assert.equal((await project.listAssets()).find((item) => item.source === asset.source)?.mimeType, "video/mp4");
    assert.match(saved.source, new RegExp(asset.source));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project extracts pasted Base64 images into local WebP assets before saving", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-base64-save-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const opened = await project.open();
    const png = await sharp({
      create: {
        background: { alpha: 1, b: 190, g: 120, r: 40 },
        channels: 4,
        height: 32,
        width: 32
      }
    }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const pasted = `# Pasted images

<Slide backgroundImage="${dataUrl}">
  <ImageBlock id="hero" src="${dataUrl}" alt="Pasted image" />
</Slide>`;

    const saved = await project.save({
      expectedRevision: opened.revision,
      source: pasted,
      title: "Pasted images"
    });
    const assets = (await readdir(project.assetsRoot)).filter((name) => name.endsWith(".webp"));

    assert.equal(assets.length, 1);
    assert.doesNotMatch(saved.source, /data:image\/png;base64/i);
    assert.equal(saved.source.match(new RegExp(`assets/${assets[0]}`, "g"))?.length, 2);
    assert.equal((await readFile(path.join(project.assetsRoot, assets[0]!))).subarray(0, 4).toString("ascii"), "RIFF");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project exports a just-pasted image as portable MDX while materializing its project asset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-base64-export-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const png = await sharp({
      create: {
        background: { alpha: 1, b: 190, g: 120, r: 40 },
        channels: 4,
        height: 32,
        width: 32
      }
    }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const pasted = `# Pasted image export

<Slide>
  <ImageBlock id="hero" src="${dataUrl}" alt="Pasted image" />
</Slide>`;

    const result = await project.export({
      fileName: "pasted-image",
      format: "mdx",
      overwrite: true,
      source: pasted,
      target: "dist"
    });
    const exported = await readFile(path.join(root, result.output), "utf8");
    const assets = (await readdir(project.assetsRoot)).filter((name) => name.endsWith(".webp"));

    assert.equal(result.output, "dist/pasted-image.mdx");
    assert.equal(assets.length, 1);
    assert.doesNotMatch(exported, /data:image\/png;base64/i);
    assert.match(exported, /src="data:image\/webp;base64,/i);
    assert.doesNotMatch(exported, new RegExp(`src="assets/${assets[0]}"`));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Workbench project switches its AI design system without changing presentation content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-template-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), "# New deck\n\n<Slide></Slide>\n", "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const initialCatalog = await project.templateCatalog("en");
    assert.equal(initialCatalog.canSelect, true);
    const summerTemplate = initialCatalog.templates.find((template) => template.id === "summer-time-report");
    assert.ok(summerTemplate);
    assert.equal(summerTemplate.slideCount, 7);
    assert.match(summerTemplate.cover, /^\/api\/v1\/templates\/.+\/cover\.svg\?/);
    assert.match(project.templatePreview({ id: "summer-time-report", locale: "en", version: "1.0.0" }), /^<svg/);
    assert.match(project.templatePreview({ id: "moodboard", locale: "en", version: "1.0.0" }), /^<svg/);

    const selected = await project.selectTemplate({ id: "moodboard", locale: "en", version: "1.0.0" });
    assert.equal(selected.id, "moodboard");
    assert.deepEqual((await project.templateCatalog("en")).current, selected);

    const opened = await project.open();
    await project.save({
      expectedRevision: opened.revision,
      source: "# Started\n\n<Slide><Text role=\"title\">Content</Text></Slide>\n",
      title: "Started"
    });
    const beforeSwitch = await project.open();
    const switched = await project.selectTemplate({ id: "moodboard", locale: "zh-TW", version: "1.0.0" });
    const afterSwitch = await project.open();
    assert.equal(switched.id, "moodboard");
    assert.equal((await project.templateCatalog("en")).canSelect, true);
    assert.deepEqual((await project.templateCatalog("en")).current, switched);
    assert.equal(afterSwitch.source, beforeSwitch.source);
    assert.equal(afterSwitch.revision, beforeSwitch.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function minimalMp4() {
  return new Uint8Array([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d]);
}
