import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import sharp from "sharp";

import { officialTemplateDefinitions } from "../core/motion-doc/domain/officialTemplateDefinitions.ts";
import { parseMotionDoc } from "../core/motion-doc/domain/motionDocParser.ts";
import { injectHtmlPlaybackBridge } from "../core/motion-doc/infrastructure/export/htmlEmbedBridge.ts";
import { buildMotionDocHtml } from "../core/motion-doc/infrastructure/export/motionDocExport.ts";
import { getBundledTemplateLibrarySource } from "../core/motion-doc/presets/templateLibrarySources.ts";
import {
  closeSlideXChromiumPool,
  exportSlideXDocument,
  renderSlideXHtmlThumbnail,
  renderSlideXDocument
} from "../packages/slidex-sdk/dist/node.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const outputRoot = path.resolve(process.argv[2] ?? "template-site-artifacts");
const requestedTemplateIds = new Set(process.argv.slice(3));
const playerChromeStyle = `<style>
  html,body,.player{width:100%;height:100%;overflow:hidden;background:#000}
  .controls,.slide-dots{display:none!important}
  .stage{height:100%!important;padding:0!important}
  .viewport{width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none!important}
</style>`;

await mkdir(outputRoot, { recursive: true });

for (const definition of officialTemplateDefinitions.filter(
  ({ id }) => requestedTemplateIds.size === 0 || requestedTemplateIds.has(id)
)) {
  const source = getBundledTemplateLibrarySource(definition.id, "en");
  if (!source) throw new Error(`Missing official template source: ${definition.id}`);

  const document = parseMotionDoc(source);
  const title = definition.locales.en.name;
  const templateOutput = path.join(outputRoot, definition.id);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), `open-slidex-${definition.id}-`));
  const projectRoot = path.join(temporaryRoot, definition.id);
  const projectAssets = path.join(projectRoot, "assets");
  const outputAssets = path.join(templateOutput, "assets");

  await rm(templateOutput, { recursive: true, force: true });
  await Promise.all([
    mkdir(projectAssets, { recursive: true }),
    mkdir(outputAssets, { recursive: true })
  ]);
  await writeFile(path.join(projectRoot, "presentation.mdx"), source, "utf8");
  await writeFile(path.join(templateOutput, "presentation.mdx"), source, "utf8");

  for (const asset of definition.assets) {
    const fileName = path.basename(asset.path);
    const bundledAsset = path.join(
      repositoryRoot,
      "packages/slidex-workbench/src/server/official-template-assets",
      definition.id,
      fileName
    );
    const bundledBytes = await readFile(bundledAsset);
    const websiteBytes = /\.html?$/i.test(fileName)
      ? Buffer.from(injectHtmlPlaybackBridge(bundledBytes.toString("utf8")), "utf8")
      : bundledBytes;
    await Promise.all([
      writeFile(path.join(projectAssets, fileName), websiteBytes),
      writeFile(path.join(outputAssets, fileName), websiteBytes)
    ]);
  }

  const presentationHtml = buildMotionDocHtml(source, title);
  const playerHtml = presentationHtml.replace("</head>", `${playerChromeStyle}</head>`);
  await Promise.all([
    writeFile(path.join(templateOutput, "presentation.html"), presentationHtml, "utf8"),
    writeFile(path.join(templateOutput, "player.html"), playerHtml, "utf8")
  ]);

  const htmlBundle = new JSZip();
  htmlBundle.file("presentation.html", presentationHtml);
  for (const asset of definition.assets) {
    const fileName = path.basename(asset.path);
    htmlBundle.file(`assets/${fileName}`, await readFile(path.join(outputAssets, fileName)));
  }
  await writeFile(
    path.join(templateOutput, "presentation-html.zip"),
    await htmlBundle.generateAsync({ compression: "DEFLATE", compressionOptions: { level: 9 }, type: "nodebuffer" })
  );

  await exportSlideXDocument({
    format: "pptx",
    outputPath: path.join(templateOutput, "presentation.pptx"),
    overwrite: true,
    projectRoot,
    source,
    title
  });

  for (let slideIndex = 0; slideIndex < definition.catalog.slideCount; slideIndex += 1) {
    const pngPath = path.join(temporaryRoot, `slide-${slideIndex + 1}.png`);
    const webpPath = path.join(templateOutput, `slide-${String(slideIndex + 1).padStart(2, "0")}.webp`);
    const htmlBlock = document.scenes[slideIndex]?.blocks.find(({ type }) => type === "HtmlEmbedBlock");
    const htmlSource = typeof htmlBlock?.props.src === "string" ? htmlBlock.props.src : "";
    if (htmlBlock && htmlSource) {
      await renderSlideXHtmlThumbnail({
        html: await readFile(path.resolve(projectRoot, htmlSource), "utf8"),
        outputPath: pngPath,
        page: typeof htmlBlock.props.page === "number" ? htmlBlock.props.page : 1
      });
    } else {
      await renderSlideXDocument({
        mode: "slide",
        outputPath: pngPath,
        projectRoot,
        slideIndex,
        source,
        title
      });
    }
    await sharp(pngPath).resize(640, 360, { fit: "cover" }).webp({ quality: 82 }).toFile(webpPath);
  }

  await rm(temporaryRoot, { recursive: true, force: true });
  process.stdout.write(`${definition.id}: ${definition.catalog.slideCount} slides\n`);
}

await closeSlideXChromiumPool();
