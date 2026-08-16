import assert from "node:assert/strict";
import test from "node:test";

import { buildMotionDocHtml } from "@/core/motion-doc/infrastructure/export/motionDocExport";
import { makeMotionDocExportRuntime } from "@/core/motion-doc/infrastructure/export/motionDocExportRuntime";

test("HTML export is byte-stable for the same MotionDoc source", () => {
  const source = `# Stable export

<Slide><Text>Same input, same HTML.</Text></Slide>`;

  assert.equal(buildMotionDocHtml(source), buildMotionDocHtml(source));
});

test("HTML export loads selected Google Fonts for base and inline text", () => {
  const inlineStyles = JSON.stringify([
    { end: 6, fontFamily: "Dancing Script", start: 0 }
  ]).replaceAll('"', "&quot;");
  const html = buildMotionDocHtml(`# Font export

<Slide>
  <Text fontFamily="Playfair Display">Heading</Text>
  <Text textStyleRanges="${inlineStyles}">Script text</Text>
</Slide>`);

  assert.match(html, /https:\/\/fonts\.googleapis\.com\/css2\?family=Dancing\+Script:wght@400;500;600;700;800;900&amp;display=swap/);
  assert.match(html, /https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display:wght@400;500;600;700;800;900&amp;display=swap/);
  assert.match(html, /style-src 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
});

test("static exports remove an unavailable image-filter canvas instead of freezing black pixels", () => {
  const runtime = makeMotionDocExportRuntime();

  assert.match(runtime, /canvas\.dataset\.shaderImageFallback = "true"/);
  assert.match(runtime, /canvas\.style\.display = "none"/);
  assert.match(runtime, /canvas\.classList\.contains\('image-filter-canvas'\) && \(!state \|\| state\.hasImage !== 1 \|\| state\.imageLoadFailed\)/);
  assert.match(runtime, /canvas\.remove\(\);/);
});

test("static exports can render shaders directly at the requested raster scale", () => {
  const runtime = makeMotionDocExportRuntime();

  assert.match(runtime, /const requestedRasterScale = Number\(options\.rasterScale\)/);
  assert.match(runtime, /Math\.max\(0\.25, Math\.min\(staticExportRasterScale, dpr, maxScale\)\)/);
});
