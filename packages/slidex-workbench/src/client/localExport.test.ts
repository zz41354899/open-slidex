import assert from "node:assert/strict";
import test from "node:test";

import {
  localExportFileName,
  localExportMediaSourcesToMaterialize,
  localExportOptions,
  localExportOptionsForMode,
  localExportPreflightError,
  replaceLocalExportMediaSources
} from "./localExport";

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

test("Local export rejects an invalid Canvas before opening a native save destination", () => {
  const invalid = '<Slide><Shape id="planet" motion="{&quot;actions&quot;:[],&quot;version&quot;:1}" enter="none" /></Slide>';
  assert.match(localExportPreflightError(invalid, "invalid") ?? "", /motion cannot be combined with legacy enter/);
  assert.equal(localExportPreflightError("<Slide></Slide>", "saved"), null);
});

test("Local export rejects Canvas states that cannot commit", () => {
  assert.match(localExportPreflightError("<Slide></Slide>", "conflict") ?? "", /Resolve/);
  assert.match(localExportPreflightError("<Slide></Slide>", "saving") ?? "", /Wait/);
  assert.match(localExportPreflightError("<Slide></Slide>", "error") ?? "", /Fix/);
});

test("Local export materializes browser blobs and legacy raster shape images only", () => {
  const source = `<Slide>
  <Shape shapeImageSrc="blob:http://127.0.0.1:4172/temporary" />
  <ImageBlock src={'assets/legacy.png'} />
  <Shape shapeImageSrc="/api/v1/workspace/presentations/galaxy/editor/assets/preview.webp" />
  <Shape shapeImageSrc="data:image/png,raw-image-bytes" />
  <ImageBlock src="assets/ready.webp" />
  <SvgBlock src="assets/mark.svg" />
</Slide>`;
  assert.deepEqual(localExportMediaSourcesToMaterialize(source), [
    { prop: "shapeImageSrc", source: "blob:http://127.0.0.1:4172/temporary" },
    { prop: "src", source: "assets/legacy.png" },
    { prop: "shapeImageSrc", source: "/api/v1/workspace/presentations/galaxy/editor/assets/preview.webp" },
    { prop: "shapeImageSrc", source: "data:image/png,raw-image-bytes" }
  ]);
  const rewritten = replaceLocalExportMediaSources(source, new Map([
    ["shapeImageSrc:blob:http://127.0.0.1:4172/temporary", "assets/shape.webp"],
    ["src:assets/legacy.png", "assets/legacy.webp"]
  ]));
  assert.match(rewritten, /shapeImageSrc="assets\/shape\.webp"/);
  assert.match(rewritten, /src={'assets\/legacy\.webp'}/);
  assert.match(rewritten, /src="assets\/ready\.webp"/);
});
