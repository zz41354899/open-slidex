import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeSlideXDocumentQuality, closeSlideXChromiumPool } from "@open-slidex/sdk/node";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");
const deckFiles = ["consulting-financial-report.mdx", "data-brief.mdx", "editorial-story.mdx", "product-launch.mdx", "strategy-proposal.mdx", "training-workshop.mdx"];
const reports = [];

try {
  for (const file of deckFiles) {
    const source = await readFile(path.join(referenceRoot, file), "utf8");
    const report = await analyzeSlideXDocumentQuality({ mode: "deck", source, title: file, projectRoot: referenceRoot });
    reports.push({ file, report });
  }
} finally {
  await closeSlideXChromiumPool();
}

const issues = reports.flatMap(({ file, report }) => report.issues.map((issue) => ({ file, ...issue })));
const summary = {
  files: deckFiles.length,
  slides: reports.reduce((total, item) => total + item.report.slideIndices.length, 0),
  passed: reports.every((item) => item.report.passed),
  errors: issues.filter((issue) => issue.severity === "error").length,
  warnings: issues.filter((issue) => issue.severity === "warning").length,
  blocking: issues.filter((issue) => issue.severity === "error").map((issue) => ({ code: issue.code, file: issue.file, message: issue.message, nodeIds: issue.nodeIds, slideIndex: issue.slideIndex }))
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!summary.passed) process.exitCode = 1;
