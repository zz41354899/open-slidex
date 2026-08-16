import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { blankPresentationMdx, parseMotionDoc, validateOpenSlideXLocalMedia } from "@open-slidex/sdk";
import {
  closeSlideXChromiumPool,
  exportSlideXDocument
} from "@open-slidex/sdk/node";
import JSZip from "jszip";
import sharp from "sharp";

import { OpenSlideXWorkspace } from "./workspace";
import { startWorkspaceServer } from "./workspaceHttp";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-workspace-"));
  const workspaceRoot = path.join(root, "presentations");
  const templateRoot = path.join(root, "starter");
  await mkdir(path.join(templateRoot, ".open-slidex"), { recursive: true });
  await Promise.all([
    mkdir(path.join(templateRoot, "assets"), { recursive: true }),
    mkdir(path.join(templateRoot, "dist"), { recursive: true }),
    mkdir(path.join(templateRoot, "knowledge"), { recursive: true })
  ]);
  await writeFile(path.join(templateRoot, "package.json"), `${JSON.stringify({ name: "__PROJECT_NAME__", private: true }, null, 2)}\n`, "utf8");
  await writeFile(path.join(templateRoot, "presentation.mdx"), "# Stale starter\n\n<Slide></Slide>\n", "utf8");
  await writeFile(path.join(templateRoot, ".open-slidex", "current.json"), "{}\n", "utf8");
  await writeFile(path.join(templateRoot, ".open-slidex", "template-lock.json"), `${JSON.stringify({ id: "stale" })}\n`, "utf8");
  await mkdir(path.join(templateRoot, ".agents", "skills", "slidex-deck-design", "references"), { recursive: true });
  await writeFile(
    path.join(templateRoot, ".agents", "skills", "slidex-deck-design", "SKILL.md"),
    "---\nname: slidex-deck-design\ndescription: Test deck design.\n---\n",
    "utf8"
  );
  await writeFile(
    path.join(templateRoot, ".agents", "skills", "slidex-deck-design", "references", "source-to-story.md"),
    "# Source to story\n",
    "utf8"
  );
  const workspace = new OpenSlideXWorkspace({
    root: workspaceRoot,
    templateRoot,
    workspaceUrl: "http://127.0.0.1:4172/workspace"
  });
  await workspace.prepare();
  return { root, workspace, workspaceRoot };
}

test("local workspace creates isolated blank presentations without inherited runtime state", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "zh-TW", title: "我的 新簡報" });
  const projectRoot = path.join(workspaceRoot, created.id);
  const source = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");

  assert.equal(parseMotionDoc(source).title, "我的 新簡報");
  assert.equal(parseMotionDoc(source).scenes.length, 1);
  await assert.rejects(access(path.join(projectRoot, ".open-slidex", "current.json")));
  await assert.rejects(access(path.join(projectRoot, ".open-slidex", "template-lock.json")));
  assert.equal(JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")).name, created.id);
  await access(path.join(projectRoot, ".agents", "skills", "slidex-deck-design", "SKILL.md"));
  assert.match(
    await readFile(path.join(projectRoot, ".agents", "skills", "slidex-deck-design", "references", "source-to-story.md"), "utf8"),
    /Source to story/
  );
});

test("local workspace still creates and imports decks when the starter folder is unavailable", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-workspace-no-template-"));
  const workspaceRoot = path.join(root, "presentations");
  const workspace = new OpenSlideXWorkspace({
    root: workspaceRoot,
    templateRoot: path.join(root, "missing-starter")
  });
  context.after(async () => rm(root, { force: true, recursive: true }));
  await workspace.prepare();

  const first = await workspace.create({ locale: "en", title: "First local deck" });
  await workspace.deletePresentation(first.id, { confirmationTitle: "First local deck" });
  const created = await workspace.create({ locale: "en", title: "Recreated local deck" });
  const imported = await workspace.importMdx(new File([blankPresentationMdx], "imported.mdx", { type: "text/mdx" }));

  await access(path.join(workspaceRoot, created.id, "presentation.mdx"));
  await access(path.join(workspaceRoot, created.id, "package.json"));
  await access(path.join(workspaceRoot, imported.id, "presentation.mdx"));
});

test("local workspace opens each deck through its stable same-origin route", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "en", title: "Stable route" });

  assert.equal(
    await workspace.open(created.id),
    `http://127.0.0.1:4172/workspace/${created.id}`
  );
});

test("local workspace creates a new deck from the bundled public template", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({
    locale: "en",
    templateId: "moodboard",
    templateVersion: "1.0.0",
    title: "Quarterly launch"
  });
  const source = await readFile(path.join(workspaceRoot, created.id, "presentation.mdx"), "utf8");
  const lock = JSON.parse(await readFile(path.join(workspaceRoot, created.id, ".open-slidex", "template-lock.json"), "utf8"));
  const snapshot = await workspace.snapshot("en");

  assert.equal(parseMotionDoc(source).title, "Quarterly launch");
  assert.deepEqual(lock, { id: "moodboard", locale: "en", version: "1.0.0" });
  assert.equal(snapshot.presentations[0]?.id, created.id);
  const template = snapshot.templates.find((item) => item.id === "moodboard");
  assert.ok(template);
  assert.equal(parseMotionDoc(source).scenes.length, template.slideCount);
  assert.deepEqual(validateOpenSlideXLocalMedia(source).issues, []);
});

test("local workspace renders each official template slide for the preview gallery", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const cover = await workspace.templateCover({ id: "moodboard", locale: "en", slideIndex: 0, version: "1.0.0" });
  const laterSlide = await workspace.templateCover({ id: "moodboard", locale: "en", slideIndex: 1, version: "1.0.0" });

  assert.match(cover, /^<svg/);
  assert.match(laterSlide, /^<svg/);
  assert.notEqual(laterSlide, cover);
  await assert.rejects(
    () => workspace.templateCover({ id: "moodboard", locale: "en", slideIndex: 99, version: "1.0.0" }),
    /template slide was not found/i
  );
});

test("local workspace renders and caches the official template's real shader cover", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const { root, workspace } = await fixture();
  context.after(async () => {
    await closeSlideXChromiumPool();
    await rm(root, { force: true, recursive: true });
  });

  const cover = await workspace.templateCover({
    id: "summer-time-report",
    locale: "en",
    slideIndex: 0,
    version: "1.0.0"
  });
  const encodedPng = cover.match(/href="data:image\/png;base64,([^"]+)"/)?.[1];
  assert.ok(encodedPng);
  const png = Buffer.from(encodedPng, "base64");
  const metadata = await sharp(png).metadata();
  const stats = await sharp(png).stats();

  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert.ok(stats.channels.some((channel) => channel.stdev > 8));
  assert.equal(await workspace.templateCover({ id: "summer-time-report", locale: "en", slideIndex: 0, version: "1.0.0" }), cover);
  assert.ok((await readdir(path.join(workspace.stateRoot, "template-covers"))).some((name) => name.endsWith(".png")));
});

test("local workspace renders and caches the presentation's real shader cover", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const { root, workspace } = await fixture();
  context.after(async () => {
    await closeSlideXChromiumPool();
    await rm(root, { force: true, recursive: true });
  });
  const source = `# Shader cover

<Slide duration={5} theme="light" background="#38BDF8" shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={18897} shaderSpeed={0} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447" shaderColor5="#BCECF6" shaderColor6="#FFFFFF"></Slide>`;
  const presentation = await workspace.importMdx(new File([source], "shader-cover.mdx", { type: "text/mdx" }));

  const cover = await workspace.presentationCover(presentation.id);
  const encodedPng = cover.match(/href="data:image\/png;base64,([^"]+)"/)?.[1];
  assert.ok(encodedPng);
  const png = Buffer.from(encodedPng, "base64");
  const metadata = await sharp(png).metadata();
  const stats = await sharp(png).stats();

  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert.ok(stats.channels.some((channel) => channel.stdev > 8));
  assert.equal(await workspace.presentationCover(presentation.id), cover);
  await access(path.join(workspace.stateRoot, "covers", `${presentation.id}.png`));
});

test("local workspace imports only valid MotionDoc MDX into an isolated project", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const source = blankPresentationMdx.replace(/^#\s+.*$/m, "# 匯入的簡報");
  const imported = await workspace.importMdx(new File([source], "launch.mdx", { type: "text/mdx" }));
  const stored = await readFile(path.join(workspaceRoot, imported.id, "presentation.mdx"), "utf8");

  assert.equal(imported.title, "匯入的簡報");
  assert.equal(parseMotionDoc(stored).scenes.length, 1);
  assert.equal(stored, source);
  await assert.rejects(
    workspace.importMdx(new File([source], "launch.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })),
    /\.mdx.*\.zip.*\.slidex/i
  );
  await assert.rejects(
    workspace.importMdx(new File(["# Empty"], "empty.mdx", { type: "text/mdx" })),
    /valid <Slide>/i
  );
});

test("local workspace imports a project bundle with referenced images", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const source = `# Imported with image

<Slide>
  <ImageBlock src="assets/photo.png" alt="Imported image" x={10} y={10} w={80} h={80} />
</Slide>
`;
  const archive = new JSZip();
  archive.file("portable-deck/presentation.mdx", source);
  archive.file("portable-deck/assets/photo.png", await tinyPng());
  const bytes = await archive.generateAsync({ type: "uint8array" });

  const imported = await workspace.importMdx(new File([Buffer.from(bytes)], "portable-deck.slidex", { type: "application/zip" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const assets = (await readdir(path.join(projectRoot, "assets"))).filter((name) => name.endsWith(".webp"));

  assert.equal(imported.title, "Imported with image");
  assert.equal(assets.length, 1);
  assert.match(assets[0]!, /^photo-[a-f0-9]{16}\.webp$/);
  assert.match(stored, new RegExp(`src="assets/${assets[0]}"`));
  assert.equal((await readFile(path.join(projectRoot, "assets", assets[0]!))).subarray(0, 4).toString("ascii"), "RIFF");
});

test("local workspace extracts Base64 images from a standalone MDX import", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const png = await tinyPng();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const source = `# Embedded image

<Slide backgroundImage="${dataUrl}">
  <ImageBlock src="${dataUrl}" alt="Embedded Base64 image" x={10} y={10} w={80} h={80} />
</Slide>
`;

  const imported = await workspace.importMdx(new File([source], "embedded.mdx", { type: "text/mdx" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const assets = (await readdir(path.join(projectRoot, "assets"))).filter((name) => name.endsWith(".webp"));

  assert.equal(assets.length, 1);
  assert.doesNotMatch(stored, /data:image\/png;base64/i);
  assert.match(stored, new RegExp(`backgroundImage="assets/${assets[0]}"`));
  assert.match(stored, new RegExp(`src="assets/${assets[0]}"`));
});

test("portable MDX export carries project images through Workspace import", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const original = await workspace.create({ locale: "en", title: "Portable source" });
  const originalRoot = path.join(workspaceRoot, original.id);
  const originalAsset = path.join(originalRoot, "assets", "portable.webp");
  await writeFile(originalAsset, await tinyWebp());
  const originalSource = `# Portable source\n\n<Slide><ImageBlock src="assets/portable.webp" alt="Portable" /></Slide>\n`;
  await writeFile(path.join(originalRoot, "presentation.mdx"), originalSource, "utf8");

  const exportPath = path.join(root, "portable.mdx");
  await exportSlideXDocument({
    format: "mdx",
    outputPath: exportPath,
    projectRoot: originalRoot,
    source: originalSource
  });
  const portableSource = await readFile(exportPath, "utf8");
  assert.match(portableSource, /data:image\/webp;base64,/);

  const imported = await workspace.importMdx(new File([portableSource], "portable.mdx", { type: "text/mdx" }));
  const importedRoot = path.join(workspaceRoot, imported.id);
  const storedSource = await readFile(path.join(importedRoot, "presentation.mdx"), "utf8");
  const storedAssets = (await readdir(path.join(importedRoot, "assets"))).filter((name) => name.endsWith(".webp"));
  assert.equal(storedAssets.length, 1);
  assert.match(storedSource, new RegExp(`src="assets/${storedAssets[0]}"`));
});

test("local workspace extracts Base64 shape images from JSX literal expressions", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const png = await tinyPng();
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const source = `# Embedded shape image

<Slide>
  <Shape shape="rectangle" shapeImageSrc={"${dataUrl}"} shapeImageFit="cover" x={10} y={10} w={35} h={80} />
  <Shape shape="rectangle" shapeImageSrc={'${dataUrl}'} shapeImageFit="contain" x={55} y={10} w={35} h={80} />
</Slide>
`;

  const imported = await workspace.importMdx(new File([source], "embedded-shapes.mdx", { type: "text/mdx" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const assets = (await readdir(path.join(projectRoot, "assets"))).filter((name) => name.endsWith(".webp"));

  assert.equal(assets.length, 1);
  assert.doesNotMatch(stored, /data:image\/png;base64/i);
  assert.equal(stored.match(new RegExp(`shapeImageSrc="assets/${assets[0]}"`, "g"))?.length, 2);
});

test("local workspace imports an MDX that reuses a recoverable local image asset", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const original = await workspace.create({ locale: "en", title: "Cached image source" });
  const originalRoot = path.join(workspaceRoot, original.id);
  await writeFile(path.join(originalRoot, "assets", "carry-over.webp"), await tinyWebp());
  await workspace.deletePresentation(original.id, { confirmationTitle: "Cached image source" });

  const source = `# Recovered image

<Slide>
  <ImageBlock src="assets/carry-over.webp" alt="Recovered image" x={10} y={10} w={80} h={80} />
</Slide>
`;
  const imported = await workspace.importMdx(new File([source], "recovered.mdx", { type: "text/mdx" }));
  const importedRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(importedRoot, "presentation.mdx"), "utf8");
  const assets = (await readdir(path.join(importedRoot, "assets"))).filter((name) => name.endsWith(".webp"));

  assert.equal(assets.length, 1);
  assert.match(stored, new RegExp(`src="assets/${assets[0]}"`));
});

test("local workspace imports MDX with unavailable local assets as editable placeholders", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const source = `# Missing image

<Slide backgroundImage="assets/background.jpg">
  <ImageBlock src="assets/missing.png" alt="Missing" />
  <VideoBlock src="assets/missing.mp4" poster="assets/poster.png" />
  <Shape shapeImageSrc={"assets/shape.png"} />
</Slide>
`;
  const importedMdx = await workspace.importMdx(new File([source], "missing.mdx", { type: "text/mdx" }));
  const standaloneSource = await readFile(path.join(workspace.root, importedMdx.id, "presentation.mdx"), "utf8");
  assert.doesNotMatch(standaloneSource, /assets\/(?:background|missing|poster|shape)\./);
  assert.match(standaloneSource, /<ImageBlock\s+alt="Missing"\s*\/>/);
  assert.match(standaloneSource, /<VideoBlock\s*\/>/);
  assert.match(standaloneSource, /<Shape\s*\/>/);

  const archive = new JSZip();
  archive.file("presentation.mdx", source);
  const bytes = await archive.generateAsync({ type: "uint8array" });
  const importedBundle = await workspace.importMdx(new File([Buffer.from(bytes)], "missing.zip", { type: "application/zip" }));
  const bundleSource = await readFile(path.join(workspace.root, importedBundle.id, "presentation.mdx"), "utf8");
  assert.doesNotMatch(bundleSource, /assets\/(?:background|missing|poster|shape)\./);
});

test("local workspace rejects unsafe project bundle paths", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const archive = new JSZip();
  archive.file("../presentation.mdx", blankPresentationMdx);
  const bytes = await archive.generateAsync({ type: "uint8array" });

  await assert.rejects(
    workspace.importMdx(new File([Buffer.from(bytes)], "unsafe.slidex", { type: "application/zip" })),
    /unsafe path/i
  );
});

test("local workspace confines presentation access to direct child project folders", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  await assert.rejects(workspace.presentationCover("../outside"), /not found/i);
  await assert.rejects(workspace.open(".."), /not found/i);
});

test("local workspace renames a presentation without changing its stable folder id", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "zh-TW", title: "原始名稱" });
  const renamed = await workspace.renamePresentation(created.id, { title: "新的簡報名稱" });
  const source = await readFile(path.join(workspaceRoot, created.id, "presentation.mdx"), "utf8");

  assert.equal(renamed.id, created.id);
  assert.equal(renamed.title, "新的簡報名稱");
  assert.equal(parseMotionDoc(source).title, "新的簡報名稱");
});

test("local workspace deletion requires the exact title and moves the deck to recovery storage", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "zh-TW", title: "需要確認" });
  await assert.rejects(
    workspace.deletePresentation(created.id, { confirmationTitle: "需要确认" }),
    /exact presentation title/i
  );
  await access(path.join(workspaceRoot, created.id, "presentation.mdx"));

  const deleted = await workspace.deletePresentation(created.id, { confirmationTitle: "需要確認" });
  assert.equal(deleted.deleted, true);
  await assert.rejects(access(path.join(workspaceRoot, created.id, "presentation.mdx")));
  await access(path.join(deleted.recoverableFrom, "presentation.mdx"));
});

test("local workspace accepts its assigned API port, MDX import, and proxied UI origin", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  const uiPort = 4321;
  const running = await startWorkspaceServer({ port: 0, uiPort, workspace });
  context.after(async () => {
    await running.close();
    await rm(root, { force: true, recursive: true });
  });

  for (const origin of [
    `http://127.0.0.1:${running.port}`,
    `http://127.0.0.1:${uiPort}`
  ]) {
    const response = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations`, {
      body: "{}",
      headers: { "content-type": "application/json", origin },
      method: "POST"
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /title is required/i);
  }

  const rejected = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations`, {
    body: "{}",
    headers: { "content-type": "application/json", origin: "https://example.com" },
    method: "POST"
  });
  assert.equal(rejected.status, 403);

  const templateCover = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/templates/moodboard/cover.svg?locale=en&version=1.0.0`);
  const templateSlide = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/templates/moodboard/cover.svg?locale=en&version=1.0.0&slide=1`);
  assert.equal(templateCover.status, 200);
  assert.equal(templateSlide.status, 200);
  assert.equal(templateCover.headers.get("cache-control"), "no-store");
  assert.equal(templateCover.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  assert.notEqual(await templateSlide.text(), await templateCover.text());

  const invalidTemplateSlide = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/templates/moodboard/cover.svg?locale=en&version=1.0.0&slide=invalid`);
  assert.equal(invalidTemplateSlide.status, 400);

  const mcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=macos`);
  assert.equal(mcpSetup.status, 200);
  const mcpPayload = await mcpSetup.json();
  assert.equal(mcpPayload.configPath, "~/.codex/config.toml");
  assert.equal(mcpPayload.workspaceRoot, workspaceRoot);
  assert.match(mcpPayload.config, /\[mcp_servers\.open_slidex_workspace\]/);
  assert.match(mcpPayload.config, /open-slidex@latest/);
  assert.match(mcpPayload.config, /--workspace/);

  const windowsMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=windows`);
  assert.equal((await windowsMcpSetup.json()).configPath, "%USERPROFILE%\\.codex\\config.toml");

  const invalidMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=unknown&platform=macos`);
  assert.equal(invalidMcpSetup.status, 400);

  const importForm = new FormData();
  const importedSource = blankPresentationMdx.replace(/^#\s+.*$/m, "# Imported through API");
  importForm.set("file", new File([importedSource], "api-import.mdx", { type: "text/mdx" }));
  const imported = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/import`, {
    body: importForm,
    headers: { origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(imported.status, 201);
  const importedPayload = await imported.json();
  assert.equal(importedPayload.presentation.title, "Imported through API");
  assert.equal(await readFile(path.join(workspaceRoot, importedPayload.presentation.id, "presentation.mdx"), "utf8"), importedSource);

  const relaxedImportForm = new FormData();
  relaxedImportForm.set("file", new File([
    `# API import with unavailable image\n\n<Slide><ImageBlock src="assets/unavailable.png" alt="Unavailable" /></Slide>\n`
  ], "unavailable-assets.mdx", { type: "text/mdx" }));
  const relaxedImport = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/import`, {
    body: relaxedImportForm,
    headers: { origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(relaxedImport.status, 201);

  const missingImport = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/import`, {
    body: new FormData(),
    headers: { origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(missingImport.status, 400);
  assert.deepEqual(await missingImport.json(), {
    code: "invalid_request",
    message: "Choose one .mdx file or .zip/.slidex OpenSlideX project bundle."
  });

  const embeddedImage = Buffer.concat([await tinyPng(), Buffer.alloc(2.5 * 1024 * 1024)]);
  const largeMdxForm = new FormData();
  largeMdxForm.set("file", new File([
    `# Large embedded image\n\n<Slide><ImageBlock src="data:image/png;base64,${embeddedImage.toString("base64")}" alt="Large image" /></Slide>\n`
  ], "large-embedded.mdx", { type: "text/mdx" }));
  const largeMdxImport = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/import`, {
    body: largeMdxForm,
    headers: { origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(largeMdxImport.status, 201);

  const created = await workspace.create({ locale: "en", title: "API title" });
  const editorDocument = await fetch(
    `http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${created.id}/editor/api/v1/document`,
    { headers: { origin: `http://127.0.0.1:${uiPort}` } }
  );
  assert.equal(editorDocument.status, 200);
  assert.equal((await editorDocument.json()).title, "API title");

  const renamed = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${created.id}`, {
    body: JSON.stringify({ title: "Renamed through API" }),
    headers: { "content-type": "application/json", origin: `http://127.0.0.1:${uiPort}` },
    method: "PATCH"
  });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).presentation.title, "Renamed through API");

  const deleted = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${created.id}`, {
    body: JSON.stringify({ confirmationTitle: "Renamed through API" }),
    headers: { "content-type": "application/json", origin: `http://127.0.0.1:${uiPort}` },
    method: "DELETE"
  });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted, true);
});

test("starter Workspace MCP setup uses the exact installed presentation path", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  const projectRoot = path.join(root, "my-deck");
  await mkdir(projectRoot, { recursive: true });
  await writeFile(path.join(projectRoot, "presentation.mdx"), blankPresentationMdx, "utf8");
  const projectScopedWorkspace = new OpenSlideXWorkspace({
    mcpPresentationRoot: projectRoot,
    root: workspaceRoot,
    templateRoot: workspace.templateRoot,
    workspaceUrl: "http://127.0.0.1:4172/workspace"
  });
  await projectScopedWorkspace.prepare();
  const running = await startWorkspaceServer({ port: 0, uiPort: 4172, workspace: projectScopedWorkspace });
  context.after(async () => {
    await running.close();
    await rm(root, { force: true, recursive: true });
  });

  const response = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=macos`);
  assert.equal(response.status, 200);
  const setup = await response.json();
  assert.equal(setup.scopeType, "presentation");
  assert.equal(setup.scopeRoot, projectRoot);
  assert.equal(setup.presentationPath, path.join(projectRoot, "presentation.mdx"));
  assert.equal(setup.workspaceRoot, workspaceRoot);
  assert.match(setup.config, /\[mcp_servers\.open_slidex\]/);
  assert.match(setup.config, /--project/);
  assert.match(setup.config, new RegExp(projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(setup.config, /open_slidex_workspace/);
  assert.match(setup.prompt, /Replace an older open_slidex_workspace entry/);
});

function tinyPng() {
  return sharp({
    create: {
      background: { alpha: 1, b: 180, g: 120, r: 50 },
      channels: 4,
      height: 32,
      width: 32
    }
  }).png().toBuffer();
}

function tinyWebp() {
  return sharp({
    create: {
      background: { alpha: 1, b: 180, g: 120, r: 50 },
      channels: 4,
      height: 32,
      width: 32
    }
  }).webp().toBuffer();
}
