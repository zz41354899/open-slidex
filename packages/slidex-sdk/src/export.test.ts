import assert from "node:assert/strict";
import test from "node:test";

import { buildMotionDocHtml } from "@/core/motion-doc/infrastructure/export/motionDocExport";
import { makeMotionDocExportRuntime } from "@/core/motion-doc/infrastructure/export/motionDocExportRuntime";

test("HTML export is byte-stable for the same MotionDoc source", () => {
  const source = `# Stable export

<Slide><Text>Same input, same HTML.</Text></Slide>`;

  assert.equal(buildMotionDocHtml(source), buildMotionDocHtml(source));
});

test("HTML export runtime remains valid browser JavaScript", () => {
  assert.doesNotThrow(() => new Function(makeMotionDocExportRuntime()));
});

test("HTML Morph captures the native final frame after cancelling active entrances", () => {
  const runtime = makeMotionDocExportRuntime();
  const renderStart = runtime.indexOf("function render(nextIndex, replay = false)");
  const cancel = runtime.indexOf("motionController?.cancel();", renderStart);
  const capture = runtime.indexOf("? captureMorph(previousSlide, { includeUnmatched: false })", renderStart);

  assert.ok(renderStart >= 0);
  assert.ok(cancel > renderStart);
  assert.ok(capture > cancel);
});

test("HTML Morph fades unmatched source layers without cloning embedded images", () => {
  const runtime = makeMotionDocExportRuntime();
  const fadeStart = runtime.indexOf("if (fadeUnmatched)");
  const cleanup = runtime.indexOf("const cleanup = () =>", fadeStart);
  const fadeRuntime = runtime.slice(fadeStart, cleanup);

  assert.ok(fadeStart >= 0);
  assert.ok(cleanup > fadeStart);
  assert.match(fadeRuntime, /slide\.style\.backgroundColor = "transparent"/);
  assert.match(fadeRuntime, /restoreBackground/);
  assert.doesNotMatch(fadeRuntime, /cloneNode\(true\)/);
});

test("HTML Morph separates unmatched exit and entrance timing", () => {
  const runtime = makeMotionDocExportRuntime();

  assert.match(runtime, /offset: \.28, opacity: 0/);
  assert.match(runtime, /offset: \.78, opacity: 1/);
  assert.match(runtime, /is-morph-leaving/);
});

test("HTML Morph moves and restores decoded shared source nodes", () => {
  const runtime = makeMotionDocExportRuntime();
  const destinationStart = runtime.indexOf("destination.forEach");
  const fadeStart = runtime.indexOf("if (fadeUnmatched)", destinationStart);
  const sharedRuntime = runtime.slice(destinationStart, fadeStart);

  assert.ok(destinationStart >= 0);
  assert.ok(fadeStart > destinationStart);
  assert.match(sharedRuntime, /const clone = from\.element/);
  assert.match(sharedRuntime, /moved\.push\(/);
  assert.doesNotMatch(sharedRuntime, /from\.element\.cloneNode\(true\)/);
  assert.match(runtime, /moved\.slice\(\)\.reverse\(\)/);
});

test("HTML Morph animates measured text glyph frames without deforming type", () => {
  const runtime = makeMotionDocExportRuntime();
  const textStart = runtime.indexOf("const animateTextLayer = (from, to)");
  const destinationStart = runtime.indexOf("destination.forEach", textStart);
  const textRuntime = runtime.slice(textStart, destinationStart);

  assert.ok(textStart >= 0);
  assert.ok(destinationStart > textStart);
  assert.match(runtime, /captureTextLayout/);
  assert.match(runtime, /slideScaleX/);
  assert.match(textRuntime, /sameSingleLine/);
  assert.match(textRuntime, /textFrame\(from\.textFrame/);
  assert.match(runtime, /fontFamily: style\.fontFamily/);
  assert.match(runtime, /lineHeight: style\.lineHeight/);
  assert.doesNotMatch(textRuntime, /scale\(/);
});

test("HTML Action Tween ignores nodes temporarily moved into a Morph overlay", () => {
  const runtime = makeMotionDocExportRuntime();

  assert.match(runtime, /overlay\.dataset\.slidexMorphOverlay = "true"/);
  assert.match(runtime, /element\.closest\("\[data-slidex-morph-overlay\]"\)/);
  assert.match(runtime, /animation: "none"/);
});

test("HTML Morph defers paired shared-layer Action Tween until the Morph handoff", () => {
  const runtime = makeMotionDocExportRuntime();

  assert.match(runtime, /morphSource\?\.get\("shared:" \+ sharedId\)/);
  assert.match(runtime, /if \(!deferredMotion\(item\.element\)\) initializeElement\(item\.element\)/);
  assert.match(runtime, /initializeElement\(element\);/);
  assert.match(runtime, /makeMotionController\(activeSlide, transitionDelay, morphSource\)/);
});

test("HTML export preserves declarative Action Tween and Shared Morph data", () => {
  const motion = JSON.stringify({ actions: [{ duration: 0.6, easing: "easeInOut", from: { h: 20, opacity: 0.3, rotation: 0, w: 20, x: 5, y: 10 }, id: "move-one", order: 0, start: "onClick", to: { h: 20, opacity: 1, rotation: 0, w: 20, x: 30, y: 10 }, type: "tween" }], version: 1 });
  const html = buildMotionDocHtml(`# Motion export\n\n<Slide slideTransition="morph" transitionDuration={0.72} morphEasing="easeOut"><Shape id="shape-one" sharedId="hero" x={30} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}' /></Slide>`);
  assert.match(html, /slide-transition-morph/);
  assert.match(html, /data-shared-id="hero"/);
  assert.match(html, /data-motion-sequence=/);
  assert.match(html, /data-morph-easing="easeOut"/);
  assert.match(html, /makeMotionController/);
  assert.match(html, /playMorph/);
});

test("HTML export preserves number range playback and its safe text target", () => {
  const motion = JSON.stringify({ actions: [{ duration: 1, easing: "easeInOut", from: { h: 20, opacity: 1, rotation: 0, w: 20, x: 10, y: 10 }, id: "count", numberRange: { from: 100, step: 1, to: 0 }, order: 0, preset: "numberRange", start: "onClick", to: { h: 20, opacity: 1, rotation: 0, w: 20, x: 10, y: 10 }, type: "tween" }], version: 1 });
  const html = buildMotionDocHtml(`# Count export\n\n<Slide><Text id="count" x={10} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}'>0</Text></Slide>`);
  assert.match(html, /data-motion-text-content="true"/);
  assert.match(html, /numberRange/);
  assert.match(html, /playNumberRange/);
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
  assert.match(html, /style-src 'unsafe-inline' http: https: data: blob:/);
  assert.match(html, /font-src http: https: data: blob:/);
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
