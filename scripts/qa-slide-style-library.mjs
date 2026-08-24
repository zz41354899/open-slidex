import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSlideXDocumentQuality, closeSlideXChromiumPool } from "@open-slidex/sdk/node";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");
const repairOverflow = process.argv.includes("--repair-overflow");
const styleFiles = (await readdir(referenceRoot))
  .filter((name) => /^style-s\d{2}-.+\.mdx$/.test(name))
  .sort();
const narrativeFiles = ["data-brief.mdx", "editorial-story.mdx", "product-launch.mdx", "strategy-proposal.mdx", "training-workshop.mdx"];
const deckFiles = [...styleFiles, ...narrativeFiles];

if (styleFiles.length !== 8) throw new Error(`Expected 8 curated style MDX files, found ${styleFiles.length}.`);

const reports = [];
try {
  for (const file of deckFiles) {
    const filePath = path.join(referenceRoot, file);
    const source = await readFile(filePath, "utf8");
    const report = await analyzeSlideXDocumentQuality({ mode: "deck", source, title: file, projectRoot: referenceRoot });
    if (repairOverflow) {
      const repaired = repairTextFrames(source, report.issues.filter((issue) => issue.code === "text_overflow"));
      if (repaired !== source) await writeFile(filePath, repaired, "utf8");
    }
    reports.push({ file, report });
  }
} finally {
  await closeSlideXChromiumPool();
}

const issues = reports.flatMap(({ file, report }) => report.issues.map((issue) => ({ file, ...issue })));
const byCode = Object.groupBy(issues, (issue) => issue.code);
const summary = {
  files: deckFiles.length,
  styles: styleFiles.length,
  narratives: narrativeFiles.length,
  slides: reports.reduce((total, item) => total + item.report.slideIndices.length, 0),
  passed: reports.every((item) => item.report.passed),
  repairedOverflow: repairOverflow,
  errors: issues.filter((issue) => issue.severity === "error").length,
  warnings: issues.filter((issue) => issue.severity === "warning").length,
  issues: Object.fromEntries(Object.entries(byCode).map(([code, items]) => [code, items.length])),
  blocking: issues.filter((issue) => issue.severity === "error").map((issue) => ({
    code: issue.code,
    file: issue.file,
    message: issue.message,
    nodeIds: issue.nodeIds,
    slideIndex: issue.slideIndex
  })),
  warningDetails: issues.filter((issue) => issue.severity === "warning").map((issue) => ({
    code: issue.code,
    file: issue.file,
    message: issue.message,
    nodeIds: issue.nodeIds,
    slideIndex: issue.slideIndex
  }))
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!repairOverflow && !summary.passed) process.exitCode = 1;

function repairTextFrames(source, issues) {
  let repaired = source;
  for (const issue of issues) {
    const nodeId = issue.nodeIds[0];
    if (!nodeId) continue;
    const expression = new RegExp(`<Text\\b(?=[^>]*\\bid="${escapeRegExp(nodeId)}")([^>]*)>`);
    const match = repaired.match(expression);
    if (!match) continue;
    const tag = match[0];
    const fontSize = numberProp(tag, "fontSize");
    const height = numberProp(tag, "h");
    const y = numberProp(tag, "y");
    if (fontSize === undefined || height === undefined || y === undefined) continue;
    const overflow = Math.max(...Object.values(issue.metrics ?? {}).filter((value) => typeof value === "number"), 0);
    if (overflow <= 0) continue;

    const framePixels = height * 10.8;
    const renderedPixels = framePixels + overflow;
    const isTitle = /\brole="title"/.test(tag) || /-title\b/.test(nodeId);
    const isCoverTitle = /-cover-title\b/.test(nodeId);
    const minimumSize = Math.min(fontSize, isCoverTitle ? 34 : isTitle ? 24 : 12);
    const fittedSize = roundHalf(Math.max(minimumSize, fontSize * framePixels / renderedPixels * 0.9));
    let nextHeight = height;
    if (fittedSize === minimumSize) {
      nextHeight = roundHalf(Math.max(height, renderedPixels * fittedSize / fontSize / 10.8 + 0.8));
    }
    if (y + nextHeight > 94) {
      const availableHeight = Math.max(4, 94 - y);
      const sizeForCanvas = roundHalf(Math.max(10.5, fittedSize * availableHeight / nextHeight * 0.92));
      nextHeight = availableHeight;
      repaired = repaired.replace(tag, replaceNumberProp(replaceNumberProp(tag, "fontSize", sizeForCanvas), "h", nextHeight));
      continue;
    }
    repaired = repaired.replace(tag, replaceNumberProp(replaceNumberProp(tag, "fontSize", fittedSize), "h", nextHeight));
  }
  return repaired;
}

function numberProp(tag, key) {
  const match = tag.match(new RegExp(`\\b${key}=\\{(-?\\d+(?:\\.\\d+)?)\\}`));
  return match ? Number(match[1]) : undefined;
}

function replaceNumberProp(tag, key, value) {
  return tag.replace(new RegExp(`\\b${key}=\\{-?\\d+(?:\\.\\d+)?\\}`), `${key}={${value}}`);
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
