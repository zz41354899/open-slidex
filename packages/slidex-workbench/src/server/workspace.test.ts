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
import sharp from "sharp";

import { htmlPresentationAsset } from "@/core/motion-doc/domain/htmlPresentation";
import { OpenSlideXWorkspace } from "./workspace";
import { startWorkspaceServer } from "./workspaceHttp";

const starterSkillNames = [
  "slidex-source-import",
  "slidex-mdx-authoring",
  "slidex-deck-design",
  "slidex-motion-direction",
  "slidex-deck-qa"
] as const;

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
  await Promise.all(starterSkillNames.map(async (skillName) => {
    const skillRoot = path.join(templateRoot, ".agents", "skills", skillName);
    await mkdir(path.join(skillRoot, "references"), { recursive: true });
    await writeFile(
      path.join(skillRoot, "SKILL.md"),
      `---\nname: ${skillName}\ndescription: Test ${skillName}.\n---\n`,
      "utf8"
    );
  }));
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
  assert.deepEqual(
    (await readdir(path.join(projectRoot, ".agents", "skills"))).sort(),
    [...starterSkillNames].sort()
  );
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

test("local workspace renders an HTML presentation cover and replaces a stale blank cache", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const { root, workspace } = await fixture();
  context.after(async () => {
    await closeSlideXChromiumPool();
    await rm(root, { force: true, recursive: true });
  });
  const html = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%}body{display:grid;place-items:center;background:#083344;color:#fef3c7;font:700 120px system-ui}</style></head><body><main data-slidex-page="1">HTML cover</main></body></html>`;
  const presentation = await workspace.importMdx(new File([html], "html-cover.html", { type: "text/html" }));
  const document = await (await workspace.project(presentation.id)).open();
  const coverRoot = path.join(workspace.stateRoot, "covers");
  await mkdir(coverRoot, { recursive: true });
  await sharp({
    create: { background: "white", channels: 3, height: 1080, width: 1920 }
  }).png().toFile(path.join(coverRoot, `${presentation.id}.png`));
  await writeFile(
    path.join(coverRoot, `${presentation.id}.json`),
    `${JSON.stringify({ revision: document.revision })}\n`,
    "utf8"
  );

  const cover = await workspace.presentationCover(presentation.id);
  const encodedPng = cover.match(/href="data:image\/png;base64,([^"]+)"/)?.[1];
  assert.ok(encodedPng);
  const stats = await sharp(Buffer.from(encodedPng, "base64")).stats();

  assert.ok(stats.channels.some((channel) => channel.stdev > 8));
  assert.match(
    await readFile(path.join(coverRoot, `${presentation.id}.json`), "utf8"),
    /"renderVersion":2/
  );
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
    /\.mdx.*\.html/i
  );
  await assert.rejects(workspace.importMdx(new File([source], "launch.zip", { type: "application/zip" })), /\.mdx.*\.html/i);
  await assert.rejects(workspace.importMdx(new File([source], "launch.slidex", { type: "application/zip" })), /\.mdx.*\.html/i);
  await assert.rejects(
    workspace.importMdx(new File(["# Empty"], "empty.mdx", { type: "text/mdx" })),
    /valid <Slide>/i
  );
});

test("local workspace preserves a sandboxed HTML import byte-for-byte", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const bytes = Buffer.from("<!doctype html>\n<html><body><svg><path d=\"M0 0L10 10\"/></svg><div style=\"background-image:url(&quot;data:image/webp;base64,UklGRkAQAABXRUJQ&quot;)\"></div><button>Next</button><script>document.body.dataset.ready='yes'</script></body></html>\n", "utf8");
  const imported = await workspace.importMdx(new File([bytes], "IDAEO.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const assets = (await readdir(path.join(projectRoot, "assets"))).filter((name) => name.endsWith(".html"));

  assert.equal(imported.title, "IDAEO");
  assert.equal(assets.length, 1);
  assert.match(stored, new RegExp(`<HtmlEmbedBlock[^>]+src="assets/${assets[0]}"`));
  assert.doesNotMatch(stored, /;base64,/i);
  assert.deepEqual(await readFile(path.join(projectRoot, "assets", assets[0]!)), bytes);
});

test("local workspace maps a multi-page HTML shell to shared first-class slides", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const html = `<!doctype html><html><body><div class="gleft">
    <section class="gcard page" id="g1" data-stage="1"></section>
    <section class="gcard page" id="g2" data-stage="2"></section>
    <section class="gcard page" id="g3" data-stage="3"></section>
  </div></body></html>`;
  const imported = await workspace.importMdx(new File([html], "mapped.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const document = parseMotionDoc(stored);

  assert.equal(document.scenes.length, 3);
  assert.deepEqual(document.scenes.map((scene) => scene.blocks[0]?.props.page), [1, 2, 3]);
  assert.equal(new Set(document.scenes.map((scene) => scene.blocks[0]?.props.sharedScene)).size, 1);
  assert.equal(new Set(document.scenes.map((scene) => scene.blocks[0]?.props.id)).size, 3);
});

test("local workspace maps every MDX-exported HTML slide and preserves its nonce CSP", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const html = `<!doctype html><html><head>
    <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-slidex-a292d497'">
  </head><body><main class="player" data-slide-count="3">
    <section class="slide is-active" data-slidex-slide-index="0">One</section>
    <section class="slide" data-slidex-slide-index="1">Two</section>
    <section class="slide" data-slidex-slide-index="2">Three</section>
    <script nonce="slidex-a292d497">window.runtimeReady=true</script>
  </main></body></html>`;
  const imported = await workspace.importMdx(new File([html], "mdx-export.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const stored = await readFile(path.join(projectRoot, "presentation.mdx"), "utf8");
  const document = parseMotionDoc(stored);
  const htmlAssets = (await readdir(path.join(projectRoot, "assets"))).filter((name) => name.endsWith(".html"));

  assert.equal(document.scenes.length, 3);
  assert.deepEqual(document.scenes.map((scene) => scene.blocks[0]?.props.page), [1, 2, 3]);
  assert.equal(new Set(document.scenes.map((scene) => scene.blocks[0]?.props.sharedScene)).size, 1);
  assert.equal(htmlAssets.length, 1);
  assert.equal(await readFile(path.join(projectRoot, "assets", htmlAssets[0]!), "utf8"), html);
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

test("portable MDX export restores safe SvgBlock assets", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const original = await workspace.create({ locale: "en", title: "Portable SVG" });
  const originalRoot = path.join(workspaceRoot, original.id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path data-stage="1" data-motion="draw" d="M0 0L100 100"/></svg>`;
  await writeFile(path.join(originalRoot, "assets", "tree.svg"), svg, "utf8");
  const originalSource = `# Portable SVG\n\n<Slide><SvgBlock id="tree" src="assets/tree.svg" sharedScene="tree" stage={1} x={10} y={10} w={80} h={80} /></Slide>\n`;
  const exportPath = path.join(root, "portable-svg.mdx");
  await exportSlideXDocument({ format: "mdx", outputPath: exportPath, projectRoot: originalRoot, source: originalSource });
  const portableSource = await readFile(exportPath, "utf8");
  assert.match(portableSource, /data:image\/svg\+xml;base64,/);

  const imported = await workspace.importMdx(new File([portableSource], "portable-svg.mdx", { type: "text/mdx" }));
  const importedRoot = path.join(workspaceRoot, imported.id);
  const storedSource = await readFile(path.join(importedRoot, "presentation.mdx"), "utf8");
  const storedAssets = (await readdir(path.join(importedRoot, "assets"))).filter((name) => name.endsWith(".svg"));
  assert.equal(storedAssets.length, 1);
  assert.match(storedSource, new RegExp(`src="assets/${storedAssets[0]}"`));
  assert.equal(await readFile(path.join(importedRoot, "assets", storedAssets[0]!), "utf8"), svg);
});

test("MDX export keeps interactive HTML as an asset reference without Base64 inflation", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const original = await workspace.create({ locale: "en", title: "Portable HTML" });
  const originalRoot = path.join(workspaceRoot, original.id);
  const html = `<!doctype html>\n<html><body><svg><animate attributeName="opacity" values="0;1" /></svg><script>document.body.dataset.ready='yes'</script></body></html>\n`;
  await writeFile(path.join(originalRoot, "assets", "source.html"), html, "utf8");
  const originalSource = `# Portable HTML\n\n<Slide><HtmlEmbedBlock id="html" src="assets/source.html" page={1} /></Slide>\n`;
  const exportPath = path.join(root, "portable-html.mdx");
  await exportSlideXDocument({ format: "mdx", outputPath: exportPath, projectRoot: originalRoot, source: originalSource });
  const portableSource = await readFile(exportPath, "utf8");
  assert.doesNotMatch(portableSource, /data:text\/html;base64,/i);
  assert.doesNotMatch(portableSource, /;base64,/i);
  assert.match(portableSource, /src="assets\/source\.html"/);
  assert.ok(Buffer.byteLength(portableSource, "utf8") < Buffer.byteLength(html, "utf8"));

  const imported = await workspace.importMdx(new File([portableSource], "portable-html.mdx", { type: "text/mdx" }));
  const importedRoot = path.join(workspaceRoot, imported.id);
  const importedSource = await readFile(path.join(importedRoot, "presentation.mdx"), "utf8");
  const importedHtmlSource = htmlPresentationAsset(parseMotionDoc(importedSource));

  assert.ok(importedHtmlSource);
  assert.equal(importedHtmlSource, "assets/source.html");
  assert.equal(await readFile(path.join(importedRoot, importedHtmlSource), "utf8"), html);
});

test("a lightweight HTML manifest MDX still opens in HTML source mode when its sibling asset is missing", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const source = `# HTML manifest\n\n<Slide><HtmlEmbedBlock id="html" src="assets/missing-source.html" page={1} /></Slide>\n`;
  const imported = await workspace.importMdx(new File([source], "html-manifest.mdx", { type: "text/mdx" }));
  const stored = await readFile(path.join(workspaceRoot, imported.id, "presentation.mdx"), "utf8");

  assert.match(stored, /src="assets\/missing-source\.html"/);
  assert.equal(htmlPresentationAsset(parseMotionDoc(stored)), "assets/missing-source.html");
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

});

test("local workspace preserves external HTTP(S) libraries, images, and video without rewriting", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const html = `<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script></head><body><img src="https://images.unsplash.com/photo.jpg"><video src="https://media.example.com/launch.mp4"></video></body></html>`;
  const imported = await workspace.importMdx(new File([html], "online.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const htmlAsset = (await readdir(path.join(projectRoot, "assets"))).find((name) => name.endsWith(".html"));

  assert.ok(htmlAsset);
  assert.equal(await readFile(path.join(projectRoot, "assets", htmlAsset), "utf8"), html);
});

test("local workspace converts selected HTML PNG sidecars to WebP and packages SVG into deck assets", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const png = await tinyPng();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e3120b"/></svg>`;
  const html = `<!doctype html><html><body><section class="slide is-active" data-slidex-slide-index="0"><img src="assets/cover.png"><img src="./icons/mark.svg"></section></body></html>`;
  const presentation = await workspace.importMdx(new File([html], "sidecars.html", { type: "text/html" }), [
    { file: new File([png], "cover.png", { type: "image/png" }), path: "assets/cover.png" },
    { file: new File([svg], "mark.svg", { type: "image/svg+xml" }), path: "icons/mark.svg" }
  ]);
  const projectRoot = path.join(workspaceRoot, presentation.id);
  const assets = await readdir(path.join(projectRoot, "assets"));
  const pngAsset = assets.find((name) => /^html-asset-[a-f0-9]{16}\.webp$/.test(name));
  const svgAsset = assets.find((name) => /^html-asset-[a-f0-9]{16}\.svg$/.test(name));
  const document = parseMotionDoc(await readFile(path.join(projectRoot, "presentation.mdx"), "utf8"));
  const htmlSource = String(document.scenes[0]?.blocks[0]?.props.src ?? "");

  assert.ok(pngAsset);
  assert.ok(svgAsset);
  assert.equal((await sharp(await readFile(path.join(projectRoot, "assets", pngAsset))).metadata()).format, "webp");
  assert.equal(await readFile(path.join(projectRoot, "assets", svgAsset), "utf8"), svg);
  const canonical = await readFile(path.join(projectRoot, htmlSource), "utf8");
  assert.match(canonical, new RegExp(`src="${pngAsset}"`));
  assert.match(canonical, new RegExp(`src="${svgAsset}"`));
  if (process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    const thumbnail = await (await workspace.project(presentation.id)).renderHtmlThumbnail(htmlSource, 1);
    assert.ok(thumbnail.byteLength > 100);
  }
});

test("local workspace packages an absolute PNG path and rewrites it to a deck WebP asset", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const absolutePng = path.join(root, "absolute cover.png");
  await writeFile(absolutePng, await tinyPng());
  const html = `<!doctype html><html><body><section class="slide"><img src="${absolutePng}"></section></body></html>`;
  const presentation = await workspace.importMdx(new File([html], "absolute.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, presentation.id);
  const document = parseMotionDoc(await readFile(path.join(projectRoot, "presentation.mdx"), "utf8"));
  const htmlSource = String(document.scenes[0]?.blocks[0]?.props.src ?? "");
  const canonical = await readFile(path.join(projectRoot, htmlSource), "utf8");
  const webp = canonical.match(/html-asset-[a-f0-9]{16}\.webp/)?.[0];

  assert.ok(webp);
  assert.doesNotMatch(canonical, new RegExp(absolutePng.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((await sharp(path.join(projectRoot, "assets", webp)).metadata()).format, "webp");
});

test("local workspace rejects unresolved relative HTML sidecars", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  await assert.rejects(
    workspace.importMdx(new File(["<!doctype html><html><body><img src=\"./tree.svg\"></body></html>"], "external.html", { type: "text/html" })),
    /relative or unsupported resource.*complete HTML presentation folder.*htmlAssetRoot/i
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
  assert.equal(mcpPayload.hostPlatform, process.platform === "win32" ? "windows" : "macos");
  assert.equal(mcpPayload.clientAvailable, true);
  assert.equal(mcpPayload.workspaceRoot, workspaceRoot);
  assert.match(mcpPayload.config, /\[mcp_servers\.open_slidex_workspace\]/);
  assert.match(mcpPayload.config, /open-slidex@latest/);
  assert.match(mcpPayload.config, /--workspace/);
  assert.match(mcpPayload.prompt, /macOS/);
  assert.match(mcpPayload.prompt, /~\/\.codex\/config\.toml/);

  const otherDeviceMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=windows&scopeRoot=${encodeURIComponent("C:\\Users\\demo\\open-slidex-workspace")}`);
  assert.equal(otherDeviceMcpSetup.status, 200);
  const otherDeviceMcpPayload = await otherDeviceMcpSetup.json();
  assert.equal(otherDeviceMcpPayload.platform, "windows");
  assert.equal(otherDeviceMcpPayload.scopeRoot, "C:\\Users\\demo\\open-slidex-workspace");
  assert.match(otherDeviceMcpPayload.config, /"cmd"/);
  assert.match(otherDeviceMcpPayload.config, /--workspace/);
  assert.match(otherDeviceMcpPayload.prompt, /Windows/);
  assert.match(otherDeviceMcpPayload.prompt, /%USERPROFILE%\\\.codex\\config\.toml/);

  const claudeCodeWindowsSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=claude-code&platform=windows&scopeRoot=${encodeURIComponent("C:\\Users\\demo\\open-slidex-workspace")}`);
  assert.equal(claudeCodeWindowsSetup.status, 200);
  const claudeCodeWindowsPayload = await claudeCodeWindowsSetup.json();
  assert.match(claudeCodeWindowsPayload.prompt, /PowerShell or Command Prompt/);
  assert.match(claudeCodeWindowsPayload.prompt, /Claude Code must be installed/);
  assert.match(claudeCodeWindowsPayload.prompt, /cmd \/c npx/);
  assert.equal(typeof claudeCodeWindowsPayload.clientAvailable, "boolean");

  const claudeDesktopMacSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=claude-desktop&platform=macos`);
  assert.equal(claudeDesktopMacSetup.status, 200);
  const claudeDesktopMacPayload = await claudeDesktopMacSetup.json();
  assert.equal(claudeDesktopMacPayload.configPath, "~/Library/Application Support/Claude/claude_desktop_config.json");
  assert.match(claudeDesktopMacPayload.prompt, /Restart Claude Desktop after saving the file/);

  const invalidOtherDeviceMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=windows&scopeRoot=relative`);
  assert.equal(invalidOtherDeviceMcpSetup.status, 400);

  const windowsMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=codex&platform=windows`);
  assert.equal((await windowsMcpSetup.json()).configPath, "%USERPROFILE%\\.codex\\config.toml");

  const invalidMcpSetup = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/setup?client=unknown&platform=macos`);
  assert.equal(invalidMcpSetup.status, 400);

  const otherPlatform = process.platform === "win32" ? "macos" : "windows";
  const rejectedCrossPlatformInstall = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/mcp/install`, {
    body: JSON.stringify({ client: "codex", platform: otherPlatform }),
    headers: { "content-type": "application/json", origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(rejectedCrossPlatformInstall.status, 400);
  assert.match((await rejectedCrossPlatformInstall.json()).message, /Copy the configuration for a different platform/);

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

  const htmlSidecarForm = new FormData();
  htmlSidecarForm.set("file", new File([
    `<!doctype html><html><body><img src="assets/from-folder.png"></body></html>`
  ], "folder-import.html", { type: "text/html" }));
  htmlSidecarForm.append("asset", new File([await tinyPng()], "from-folder.png", { type: "image/png" }));
  htmlSidecarForm.append("assetPath", "assets/from-folder.png");
  const htmlSidecarImport = await fetch(`http://127.0.0.1:${running.port}/api/v1/workspace/presentations/import`, {
    body: htmlSidecarForm,
    headers: { origin: `http://127.0.0.1:${uiPort}` },
    method: "POST"
  });
  assert.equal(htmlSidecarImport.status, 201);
  const htmlSidecarPayload = await htmlSidecarImport.json();
  const htmlSidecarRoot = path.join(workspaceRoot, htmlSidecarPayload.presentation.id);
  const htmlSidecarDocument = parseMotionDoc(await readFile(path.join(htmlSidecarRoot, "presentation.mdx"), "utf8"));
  const htmlSidecarSource = String(htmlSidecarDocument.scenes[0]?.blocks[0]?.props.src ?? "");
  assert.match(await readFile(path.join(htmlSidecarRoot, htmlSidecarSource), "utf8"), /html-asset-[a-f0-9]{16}\.webp/);

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
    message: "Choose one .mdx or .html file."
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

test("workspace editor proxy replaces source, rejects Canvas patches, and thumbnails imported HTML through public routes", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  const uiPort = 4321;
  const originalHtml = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src 'nonce-slidex-a292d497'; style-src 'unsafe-inline'"></head><body><main class="player"><section class="slide is-active" data-slidex-slide-index="0">First</section><section class="slide" data-slidex-slide-index="1">Second</section><script nonce="slidex-a292d497">window.runtimeReady=true</script></main></body></html>`;
  const imported = await workspace.importMdx(new File([originalHtml], "editable.html", { type: "text/html" }));
  const projectRoot = path.join(workspaceRoot, imported.id);
  const originalDocument = parseMotionDoc(await readFile(path.join(projectRoot, "presentation.mdx"), "utf8"));
  const originalSource = String(originalDocument.scenes[0]?.blocks[0]?.props.src ?? "");
  const replacementHtml = originalHtml.replace("First", "Updated on Canvas");
  const running = await startWorkspaceServer({ port: 0, uiPort, workspace });
  context.after(async () => {
    await running.close();
    await rm(root, { force: true, recursive: true });
  });

  const editorPrefix = `http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${imported.id}/editor`;
  const snapshotResponse = await fetch(`${editorPrefix}/api/v1/document`, {
    headers: { origin: `http://127.0.0.1:${uiPort}` }
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await snapshotResponse.json();
  const bridgedResponse = await fetch(`${editorPrefix}/${originalSource}?slidexBridge=1&slidexEdit=1`, {
    headers: { origin: `http://127.0.0.1:${uiPort}` }
  });
  assert.equal(bridgedResponse.status, 200);
  assert.equal(bridgedResponse.headers.get("cache-control"), "no-store");
  const playbackPolicy = bridgedResponse.headers.get("content-security-policy") ?? "";
  assert.match(playbackPolicy, /script-src[^;]+https:/);
  assert.match(playbackPolicy, /connect-src[^;]+wss:/);
  assert.match(playbackPolicy, /img-src[^;]+https:/);
  assert.match(playbackPolicy, /media-src[^;]+https:/);
  const bridgedHtml = await bridgedResponse.text();
  assert.match(bridgedHtml, /data-open-slidex-playback-bridge/);
  assert.match(bridgedHtml, /data-open-slidex-playback-bridge nonce="slidex-a292d497"/);
  assert.match(bridgedHtml, /data-open-slidex-native-projection/);
  assert.doesNotMatch(bridgedHtml, /data-open-slidex-canvas-editor-bridge/);
  const updateUrl = `${editorPrefix}/api/v1/assets/html?expectedRevision=${encodeURIComponent(snapshot.revision)}&source=${encodeURIComponent(originalSource)}`;
  const updateResponse = await fetch(updateUrl, {
    body: replacementHtml,
    headers: {
      "content-type": "text/html; charset=utf-8",
      origin: `http://127.0.0.1:${uiPort}`
    },
    method: "PUT"
  });

  assert.equal(updateResponse.status, 200);
  const update = await updateResponse.json();
  assert.match(update.source, /^assets\/source-[a-f0-9]{16}\.html$/);
  assert.equal(await readFile(path.join(projectRoot, update.source), "utf8"), replacementHtml);
  assert.match(await readFile(path.join(projectRoot, "presentation.mdx"), "utf8"), new RegExp(`src="${update.source}"`));

  const patchResponse = await fetch(`${editorPrefix}/api/v1/assets/html`, {
    body: JSON.stringify({
      expectedRevision: update.document.revision,
      patches: [{
        before: "Updated on Canvas",
        selector: "html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > section:nth-of-type(1)",
        text: "Native Text layer",
        textNode: 0
      }],
      source: update.source
    }),
    headers: {
      "content-type": "application/json",
      origin: `http://127.0.0.1:${uiPort}`
    },
    method: "PATCH"
  });
  assert.equal(patchResponse.status, 404);
  assert.equal((await patchResponse.json()).code, "not_found");
  assert.equal(await readFile(path.join(projectRoot, update.source), "utf8"), replacementHtml);

  const thumbnailResponse = await fetch(
    `${editorPrefix}/api/v1/assets/html-thumbnail?page=1&source=${encodeURIComponent(update.source)}`,
    { headers: { origin: `http://127.0.0.1:${uiPort}` } }
  );
  assert.equal(thumbnailResponse.status, 200);
  assert.equal(thumbnailResponse.headers.get("cache-control"), "no-store");
  assert.equal(thumbnailResponse.headers.get("content-type"), "image/png");
  assert.ok((await thumbnailResponse.arrayBuffer()).byteLength > 10_000);

  const staleResponse = await fetch(updateUrl, {
    body: replacementHtml.replace("Second", "Stale write"),
    headers: {
      "content-type": "text/html; charset=utf-8",
      origin: `http://127.0.0.1:${uiPort}`
    },
    method: "PUT"
  });
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).code, "revision_conflict");
});

test("local workspace prepares legacy decks before opening their editor API", async (context) => {
  const { root, workspace, workspaceRoot } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "en", title: "Legacy deck" });
  const legacyAssetsRoot = path.join(workspaceRoot, created.id, "assets");
  await rm(legacyAssetsRoot, { force: true, recursive: true });

  const running = await startWorkspaceServer({ port: 0, uiPort: 4321, workspace });
  try {
    const response = await fetch(
      `http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${created.id}/editor/api/v1/document`,
      { headers: { origin: "http://127.0.0.1:4321" } }
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).title, "Legacy deck");
    await access(legacyAssetsRoot);
  } finally {
    await running.close();
  }
});

test("local workspace creates one editor router for concurrent legacy-deck reads", async (context) => {
  const { root, workspace } = await fixture();
  context.after(async () => rm(root, { force: true, recursive: true }));

  const created = await workspace.create({ locale: "en", title: "Concurrent legacy deck" });
  const project = workspace.project.bind(workspace);
  let projectReads = 0;
  workspace.project = async (id) => {
    projectReads += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return project(id);
  };

  const running = await startWorkspaceServer({ port: 0, uiPort: 4321, workspace });
  try {
    const url = `http://127.0.0.1:${running.port}/api/v1/workspace/presentations/${created.id}/editor/api/v1/document`;
    const [first, second] = await Promise.all([
      fetch(url, { headers: { origin: "http://127.0.0.1:4321" } }),
      fetch(url, { headers: { origin: "http://127.0.0.1:4321" } })
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(projectReads, 1);
  } finally {
    await running.close();
  }
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
  assert.match(setup.prompt, /Replace an older open_slidex entry/);
  assert.doesNotMatch(setup.prompt, /older open_slidex_workspace entry/);
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
