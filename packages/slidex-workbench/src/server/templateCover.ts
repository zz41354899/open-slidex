import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  buildMotionDocPngSvg,
  getOfficialTemplatePackage,
  parseMotionDoc,
  stripNonLocalMotionDocMedia,
  type TemplatePackageLocale,
  type TemplatePackageV1
} from "@open-slidex/sdk";
import { renderSlideXDocument, renderSlideXHtmlThumbnail } from "@open-slidex/sdk/node";

import { materializeBundledOfficialTemplateAssets } from "./officialTemplateAssets";

const templateCoverRenders = new Map<string, Promise<string>>();

export async function renderOfficialTemplateCover(input: {
  cacheRoot: string;
  id: string;
  locale: TemplatePackageLocale;
  projectRoot: string;
  slideIndex?: number;
  version: string;
}) {
  const template = getOfficialTemplatePackage(input.id, input.version);
  if (!template) {
    throw Object.assign(new Error(`Official template is unavailable: ${input.id}@${input.version}`), { status: 404 });
  }
  const slideIndex = input.slideIndex ?? 0;
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= template.catalog.slideCount) {
    throw Object.assign(new Error("The requested template slide was not found."), { status: 404 });
  }

  const title = template.locales[input.locale].name;
  const source = stripNonLocalMotionDocMedia(template.sources[input.locale]);
  const sourceHash = createHash("sha256")
    .update(`real-cover-v2\0${source}\0${template.assets.map((asset) => asset.sha256).join("\0")}`)
    .digest("hex")
    .slice(0, 16);
  const fileName = [input.id, input.version, input.locale, slideIndex, sourceHash]
    .join("-")
    .replace(/[^A-Za-z0-9._-]/g, "-");
  const coverPath = path.join(input.cacheRoot, `${fileName}.png`);
  const pending = templateCoverRenders.get(coverPath);
  if (pending) return pending;

  const rendering = renderTemplateCover({
    cacheRoot: input.cacheRoot,
    coverPath,
    projectRoot: input.projectRoot,
    slideIndex,
    source,
    template,
    title
  }).finally(() => {
    templateCoverRenders.delete(coverPath);
  });
  templateCoverRenders.set(coverPath, rendering);
  return rendering;
}

async function renderTemplateCover(input: {
  cacheRoot: string;
  coverPath: string;
  projectRoot: string;
  slideIndex: number;
  source: string;
  template: TemplatePackageV1;
  title: string;
}) {
  await mkdir(input.cacheRoot, { recursive: true });
  const cached = await readFile(input.coverPath).catch(() => null);
  if (cached) return embeddedPngSvg(cached, input.title);

  const temporaryPath = `${input.coverPath}.${process.pid}.${Date.now()}.tmp.png`;
  try {
    const template = input.template;
    if (!template) throw new Error("Official template package is unavailable.");
    const renderRoot = path.join(input.cacheRoot, "render-assets", template.id);
    const assets = await materializeBundledOfficialTemplateAssets(template, renderRoot);
    const html = templateHtmlScene(input.source, input.slideIndex);
    if (html) {
      const htmlSource = assets.find((asset) => asset.path === html.source);
      if (!htmlSource || htmlSource.mediaType !== "text/html") {
        throw new Error(`HTML template source is missing: ${html.source}`);
      }
      await renderSlideXHtmlThumbnail({
        html: htmlSource.bytesData.toString("utf8"),
        localAssets: assets
          .filter((asset) => asset.path !== html.source && /^assets\/html-asset-[a-f0-9]{16}\./i.test(asset.path))
          .map((asset) => ({ bytes: asset.bytesData, mimeType: asset.mediaType, name: path.basename(asset.path) })),
        outputPath: temporaryPath,
        page: html.page
      });
    } else {
      await renderSlideXDocument({
        mode: "slide",
        outputPath: temporaryPath,
        projectRoot: assets.length ? renderRoot : input.projectRoot,
        slideIndex: input.slideIndex,
        source: input.source,
        title: input.title
      });
    }
    await rename(temporaryPath, input.coverPath);
    return embeddedPngSvg(await readFile(input.coverPath), input.title);
  } catch {
    await rm(temporaryPath, { force: true });
    return buildMotionDocPngSvg(input.source, input.slideIndex, input.title);
  }
}

function templateHtmlScene(source: string, slideIndex: number) {
  const scene = parseMotionDoc(source).scenes[slideIndex];
  const block = scene?.blocks.find((candidate) => candidate.type === "HtmlEmbedBlock");
  if (!block || block.type !== "HtmlEmbedBlock") return undefined;
  const props = block.props as Record<string, unknown>;
  const assetSource = typeof props.src === "string" ? props.src : "";
  const page = Number(props.page ?? 1);
  if (!/^assets\/[A-Za-z0-9._-]+\.html?$/i.test(assetSource) || !Number.isInteger(page) || page < 1) return undefined;
  return { page, source: assetSource };
}

function embeddedPngSvg(png: Buffer, title: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <title>${escapeXml(title || "OpenSlideX template cover")}</title>
  <image width="1920" height="1080" href="data:image/png;base64,${png.toString("base64")}" preserveAspectRatio="xMidYMid slice" />
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
