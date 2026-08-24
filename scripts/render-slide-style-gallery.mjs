import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { analyzeSlideXDocumentQuality, closeSlideXChromiumPool } from "@open-slidex/sdk/node";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");
const outputRoot = path.resolve(process.argv[2] ?? path.join(repositoryRoot, "artifacts/style-library"));
const coversRoot = path.join(outputRoot, "covers");
const decksRoot = path.join(outputRoot, "decks");
const styleFiles = (await readdir(referenceRoot)).filter((name) => /^style-s\d{2}-.+\.mdx$/.test(name)).sort();
const narrativeFiles = ["data-brief.mdx", "editorial-story.mdx", "product-launch.mdx", "strategy-proposal.mdx", "training-workshop.mdx"];
const deckFiles = [...styleFiles, ...narrativeFiles];

if (styleFiles.length !== 8) throw new Error(`Expected 8 curated style MDX files, found ${styleFiles.length}.`);
await rm(coversRoot, { recursive: true, force: true });
await rm(decksRoot, { recursive: true, force: true });
await rm(path.join(outputRoot, "representative-decks"), { recursive: true, force: true });
await rm(path.join(outputRoot, "style-cover-gallery.png"), { force: true });
await mkdir(coversRoot, { recursive: true });
await mkdir(decksRoot, { recursive: true });

const reports = [];
try {
  for (const file of deckFiles) {
    const source = await readFile(path.join(referenceRoot, file), "utf8");
    const coverPath = path.join(coversRoot, file.replace(/\.mdx$/, ".png"));
    const cover = await analyzeSlideXDocumentQuality({
      mode: "slide",
      slideIndex: 0,
      source,
      title: file,
      projectRoot: referenceRoot,
      previewOutputPath: coverPath
    });
    reports.push({ file, passed: cover.passed, issues: cover.issues.length });
    await analyzeSlideXDocumentQuality({
      mode: "deck",
      source,
      title: file,
      projectRoot: referenceRoot,
      previewOutputPath: path.join(decksRoot, file.replace(/\.mdx$/, ".png"))
    });
  }
} finally {
  await closeSlideXChromiumPool();
}

const cellWidth = 480;
const coverHeight = 270;
const labelHeight = 40;
const cellHeight = coverHeight + labelHeight;
const columns = 4;
const rows = Math.ceil(deckFiles.length / columns);
const composites = [];
for (const [index, file] of deckFiles.entries()) {
  const id = file.match(/style-(s\d{2})-/)?.[1]?.toUpperCase() ?? "NARRATIVE";
  const name = file.replace(/^style-s\d{2}-|\.mdx$/g, "").replaceAll("-", " ");
  const left = index % columns * cellWidth;
  const top = Math.floor(index / columns) * cellHeight;
  const coverBuffer = await sharp(path.join(coversRoot, file.replace(/\.mdx$/, ".png")))
    .resize(cellWidth, coverHeight, { fit: "cover" })
    .png()
    .toBuffer();
  composites.push({ input: coverBuffer, left, top: top + labelHeight });
  composites.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#0B0D10"/><text x="18" y="27" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18" font-weight="700">${id} · ${escapeXml(name)}</text></svg>`),
    left,
    top
  });
}

const galleryPath = path.join(outputRoot, "style-and-narrative-gallery.png");
await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 4, background: "#0B0D10" } })
  .composite(composites)
  .png()
  .toFile(galleryPath);

await writeFile(path.join(outputRoot, "qa-summary.json"), `${JSON.stringify({
  files: deckFiles.length,
  styles: styleFiles.length,
  narratives: narrativeFiles.length,
  covers: deckFiles.length,
  completeDecks: deckFiles.length,
  passed: reports.every((item) => item.passed),
  reports
}, null, 2)}\n`, "utf8");

process.stdout.write(`${JSON.stringify({ galleryPath, coversRoot, decksRoot, passed: reports.every((item) => item.passed) }, null, 2)}\n`);

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
