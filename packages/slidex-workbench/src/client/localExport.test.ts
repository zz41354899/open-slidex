import assert from "node:assert/strict";
import test from "node:test";

import { localExportFileName, localExportOptions } from "./localExport";

test("Local Export exposes only the three direct-download formats", () => {
  assert.deepEqual(localExportOptions.map((option) => option.id), ["html", "pptx", "mdx"]);
  assert.deepEqual(localExportOptions.map((option) => option.label), ["HTML", "PowerPoint", "MDX"]);
});

test("Local export file names are portable and deterministic", () => {
  assert.equal(localExportFileName("  FY2026/9 財務簡報  "), "FY2026-9");
  assert.equal(localExportFileName("***"), "presentation");
  assert.equal(localExportFileName("a".repeat(120)).length, 80);
});
