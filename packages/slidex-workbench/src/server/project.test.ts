import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SlideXRevisionConflictError } from "@open-slidex/sdk/node";

import { OpenSlideXLocalMediaError, SlideXProject } from "./project";

const source = `# Workbench project

<Slide id="opening">
  <Title id="title">Local source</Title>
  <ImageBlock id="hero" src="assets/hero.webp" alt="Hero" />
  <Notes>Introduce the **local** workflow.</Notes>
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

test("Workbench project rejects remote, data, and blob media before writing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-local-media-"));
  try {
    await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
    const project = new SlideXProject(root);
    await project.prepare();
    const opened = await project.open();

    await assert.rejects(
      () => project.save({
        expectedRevision: opened.revision,
        source: source.replace("assets/hero.webp", "https://images.unsplash.com/remote.webp"),
        title: "Remote image"
      }),
      OpenSlideXLocalMediaError
    );
    assert.equal((await project.open()).revision, opened.revision);
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
    assert.equal(initialCatalog.templates.length, 1);
    assert.match(initialCatalog.templates[0]?.cover ?? "", /^\/api\/v1\/templates\/.+\/cover\.svg\?/);
    assert.match(project.templatePreview({ id: "open-slidex-starter", locale: "en", version: "1.0.0" }), /^<svg/);

    const selected = await project.selectTemplate({ id: "open-slidex-starter", locale: "en", version: "1.0.0" });
    assert.equal(selected.id, "open-slidex-starter");
    assert.deepEqual((await project.templateCatalog("en")).current, selected);

    const opened = await project.open();
    await project.save({
      expectedRevision: opened.revision,
      source: "# Started\n\n<Slide><Title>Content</Title></Slide>\n",
      title: "Started"
    });
    const beforeSwitch = await project.open();
    const switched = await project.selectTemplate({ id: "open-slidex-starter", locale: "zh-TW", version: "1.0.0" });
    const afterSwitch = await project.open();
    assert.equal(switched.id, "open-slidex-starter");
    assert.equal((await project.templateCatalog("en")).canSelect, true);
    assert.deepEqual((await project.templateCatalog("en")).current, switched);
    assert.equal(afterSwitch.source, beforeSwitch.source);
    assert.equal(afterSwitch.revision, beforeSwitch.revision);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
