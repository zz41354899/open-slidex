import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookUrl = new URL("./useAiCanvasPreview.ts", import.meta.url);

test("AI Canvas preview remains transient and clears every timer generation", async () => {
  const source = await readFile(hookUrl, "utf8");
  assert.match(source, /buildAiCanvasPreviewSequence\(source, revision, plan, activity\.id\)/);
  assert.match(source, /window\.clearTimeout/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /compactAiCanvasPreviewForReducedMotion/);
  assert.match(source, /status === "failed" \? source : step\?\.source \?\? source/);
  assert.match(source, /useEffect\(\(\) => clear, \[clear\]\)/);
  assert.doesNotMatch(source, /applySource|saveDocument|localStorage|fetch\(/);
});
