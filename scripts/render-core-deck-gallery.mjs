import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { analyzeSlideXDocumentQuality, closeSlideXChromiumPool } from "@open-slidex/sdk/node";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");
const outputRoot = path.resolve(process.argv[2] ?? path.join(repositoryRoot, "artifacts/core-deck-library"));
const deckFiles = ["consulting-financial-report.mdx", "data-brief.mdx", "editorial-story.mdx", "product-launch.mdx", "strategy-proposal.mdx", "training-workshop.mdx"];
const coversRoot = path.join(outputRoot, "covers");
const decksRoot = path.join(outputRoot, "decks");
await rm(outputRoot, { force: true, recursive: true });
await mkdir(coversRoot, { recursive: true });
await mkdir(decksRoot, { recursive: true });

const reports = [];
try {
  for (const file of deckFiles) {
    const source = await readFile(path.join(referenceRoot, file), "utf8");
    const coverPath = path.join(coversRoot, file.replace(/\.mdx$/, ".png"));
    const cover = await analyzeSlideXDocumentQuality({ mode: "slide", slideIndex: 0, source, title: file, projectRoot: referenceRoot, previewOutputPath: coverPath });
    const deck = await analyzeSlideXDocumentQuality({ mode: "deck", source, title: file, projectRoot: referenceRoot, previewOutputPath: path.join(decksRoot, file.replace(/\.mdx$/, ".png")) });
    reports.push({ file, coverPassed: cover.passed, deckPassed: deck.passed, slides: deck.slideIndices.length });
  }
} finally {
  await closeSlideXChromiumPool();
}

const width = 640;
const height = 360;
const labelHeight = 48;
const composites = [];
for (const [index, file] of deckFiles.entries()) {
  const left = index % 2 * width;
  const top = Math.floor(index / 2) * (height + labelHeight);
  const image = await sharp(path.join(coversRoot, file.replace(/\.mdx$/, ".png"))).resize(width, height, { fit: "cover" }).png().toBuffer();
  composites.push({ input: image, left, top: top + labelHeight });
  composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#0B151B"/><text x="18" y="31" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(file.replace(/\.mdx$/, "").replaceAll("-", " "))}</text></svg>`), left, top });
}
const galleryPath = path.join(outputRoot, "core-deck-gallery.png");
await sharp({ create: { width: width * 2, height: (height + labelHeight) * 3, channels: 4, background: "#0B151B" } }).composite(composites).png().toFile(galleryPath);
await writeFile(path.join(outputRoot, "qa-summary.json"), `${JSON.stringify({ files: 6, slides: 180, passed: reports.every((item) => item.deckPassed), reports }, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ galleryPath, decksRoot, passed: reports.every((item) => item.deckPassed) }, null, 2)}\n`);

function escapeXml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
