import assert from "node:assert/strict";
import test from "node:test";

import { localExportFileName, localExportOptions, localExportOptionsForMode } from "./localExport";

test("Local Export exposes only the three direct-download formats", () => {
  assert.deepEqual(localExportOptions.map((option) => option.id), ["html", "pptx", "mdx"]);
  assert.deepEqual(localExportOptions.map((option) => option.label), ["HTML", "PowerPoint", "MDX"]);
});

test("HTML source decks expose only lightweight HTML and MDX exports", () => {
  assert.deepEqual(
    localExportOptionsForMode("html-source").map((option) => option.id),
    ["html", "mdx"]
  );
  assert.deepEqual(
    localExportOptionsForMode("native").map((option) => option.id),
    ["html", "pptx", "mdx"]
  );
});

test("Local export file names are portable and deterministic", () => {
  assert.equal(localExportFileName("  FY2026/9 財務簡報  "), "FY2026-9");
  assert.equal(localExportFileName("***"), "presentation");
  assert.equal(localExportFileName("a".repeat(120)).length, 80);
});
