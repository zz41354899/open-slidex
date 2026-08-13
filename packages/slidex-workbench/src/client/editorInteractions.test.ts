import assert from "node:assert/strict";
import test from "node:test";

import { normalizedRelativeCornerRadii } from "../../../../core/motion-doc/application/continuousRoundedRect";
import {
  applyImageCropRect,
  normalizedImageScales
} from "../../../../core/motion-doc/application/imageCrop";
import {
  createMotionDocClipboardPacket,
  motionDocClipboardPacketFromHtml,
  motionDocClipboardHtml,
  parseMotionDocClipboardPacket,
  serializeMotionDocClipboardPacket
} from "../../../../core/motion-doc/application/motionDocClipboard";
import { objectShadowCss } from "../../../../core/motion-doc/application/objectShadow";
import { renderShapeVectorSvg } from "../../../../core/motion-doc/application/shapeVectorSvg";
import { createMotionDocBlock } from "../../../../core/motion-doc/application/motionDocBlockFactory";
import { motionDocBlockFrame } from "../../../../core/motion-doc/domain/frame";
import type { MotionDocScene } from "../../../../core/motion-doc/domain/motionDocTypes";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import { buildMotionDocHtml } from "../../../../core/motion-doc/infrastructure/export/motionDocExport";
import { duplicateSlideSource } from "../../../../features/pitch/application/motionDocCommands";
import { shouldClearActiveSlideFrameSelection } from "../../../../features/pitch/application/previewCanvas";
import {
  createMotionDocSlideClipboardPacket,
  parseMotionDocSlideClipboardPacket,
  serializeMotionDocSlideClipboardPacket
} from "../../../../features/pitch/infrastructure/motionDocSlideClipboard";
import { insertMotionDocSlideSource } from "../../../../core/motion-doc/application/motionDocSourceEditor";
import { distributeSelectedBlocks, snapSelectedBlocksToGrid } from "../../../../features/pitch/application/multiSelectionLayout";
import { addEditableSlides } from "../../../../features/pitch/infrastructure/editablePptxExport";

test("shape defaults and relative corners follow editor conventions", () => {
  const shape = createMotionDocBlock("ShapeRectangle");
  assert.equal(shape.props.radius, 0);
  assert.deepEqual(normalizedRelativeCornerRadii(50, 600, 300), { radiusX: 25, radiusY: 50 });
});

test("new image and video frames start square", () => {
  assert.equal(createMotionDocBlock("Image").props.radius, 0);
  assert.equal(createMotionDocBlock("Video").props.radius, 0);
});

test("crop applies one uniform zoom instead of stretching either image axis", () => {
  const cropped = applyImageCropRect(
    { cropX: 0, cropY: 0, h: 60, scaleX: 1, scaleY: 1, w: 40, x: 10, y: 20 },
    { h: 40, w: 50, x: 10, y: 20 }
  );

  assert.equal(cropped.scaleX, cropped.scaleY);
  assert.equal(cropped.fit, "cover");
});

test("legacy mismatched crop scales are normalized unless stretch is explicit", () => {
  assert.deepEqual(normalizedImageScales("cover", 2, 1.3), { scaleX: 2, scaleY: 2 });
  assert.deepEqual(normalizedImageScales("contain", 2, 1.3), { scaleX: 2, scaleY: 2 });
  assert.deepEqual(normalizedImageScales("fill", 2, 1.3), { scaleX: 2, scaleY: 1.3 });
});

test("shape image SVG keeps the frame aspect and uses a uniform image surface", () => {
  const svg = renderShapeVectorSvg({
    h: 60,
    shape: "rectangle",
    shapeImageScaleX: 2,
    shapeImageScaleY: 1,
    shapeImageSrc: "assets/sample.png",
    w: 30
  }, "ratio");

  assert.match(svg, /viewBox="0 0 576 648"/);
  assert.match(svg, /<mask id="ratio-rectangle-none-image-mask"/);
  assert.match(svg, /<image mask="url\(#ratio-rectangle-none-image-mask\)"/);
  assert.match(svg, /width="1152"/);
  assert.match(svg, /height="1296"/);
  assert.doesNotMatch(svg, /<image clip-path=/);
  assert.doesNotMatch(svg, /scale\(2(?:,| )\s*1\)/);
});

test("HTML shape images use one ratio-preserving crop surface without a duplicate SVG image", () => {
  const html = buildMotionDocHtml(
    '# Ratio\n\n<Slide><Shape shape="rectangle" shapeImageSrc="assets/sample.png" w={30} h={60} /></Slide>'
  );

  assert.match(html, /shape-html-fallback/);
  assert.match(html, /object-fit:cover/);
  assert.doesNotMatch(html, /<image clip-path=/);
});

test("frames retain negative positions and dimensions beyond the canvas", () => {
  assert.deepEqual(
    motionDocBlockFrame({ props: { h: 110, w: 140, x: -25, y: -10 }, type: "Shape" }),
    { h: 110, w: 140, x: -25, y: -10 }
  );
});

test("object shadows produce portable CSS", () => {
  assert.equal(
    objectShadowCss({ shadowBlur: 12, shadowColor: "#000000", shadowOffsetX: 2, shadowOffsetY: 6, shadowOpacity: 0.25 }).filter,
    "drop-shadow(2px 6px 12px rgba(0, 0, 0, 0.25))"
  );
});

test("HTML and editable PowerPoint exports retain object shadows", async () => {
  const source = '<Slide><Text x={10} y={10} w={30} h={10} shadowOpacity={0.25} shadowBlur={12} shadowOffsetX={2} shadowOffsetY={6}>Shadow</Text></Slide>';
  assert.match(buildMotionDocHtml(source), /drop-shadow\(2px 6px 12px rgba\(0, 0, 0, 0.25\)\)/);
  const textOptions: Array<Record<string, unknown>> = [];
  const pptx = {
    addSlide() {
      return {
        addNotes() {},
        addText(_text: unknown, options: Record<string, unknown>) { textOptions.push(options); },
        background: {}
      };
    }
  };
  await addEditableSlides(pptx as never, parseMotionDoc(source), []);
  const pptxShadow = textOptions[0]?.shadow as Record<string, unknown>;
  assert.equal(pptxShadow.type, "outer");
  assert.equal(pptxShadow.color, "000000");
  assert.equal(pptxShadow.opacity, 0.25);
  assert.equal(pptxShadow.blur, 6);
  assert.ok(Math.abs(Number(pptxShadow.offset) - Math.sqrt(10)) < 0.0001);
});

test("MotionDoc clipboard packets survive plain text and HTML clipboard formats", () => {
  const packet = createMotionDocClipboardPacket([{ props: { x: 10 }, text: "Across slides", type: "Text" }]);
  assert.deepEqual(parseMotionDocClipboardPacket(serializeMotionDocClipboardPacket(packet)), packet);
  assert.deepEqual(motionDocClipboardPacketFromHtml(motionDocClipboardHtml(packet)), packet);
});

test("slide duplication inserts an independent adjacent slide", () => {
  const source = '<Deck title="Demo">\n<Slide><Text x={10}>One</Text></Slide>\n<Slide><Text x={20}>Two</Text></Slide>\n</Deck>';
  const duplicated = duplicateSlideSource(source, 0);
  assert.equal((duplicated.match(/>One<\/Text>/g) ?? []).length, 2);
  assert.ok(duplicated.indexOf(">One</Text>") < duplicated.indexOf(">Two</Text>"));
});

test("slide clipboard packets preserve one complete slide and paste after the target", () => {
  const source = '<Deck title="Demo">\n<Slide><Text x={10}>One</Text></Slide>\n<Slide><Text x={20}>Two</Text></Slide>\n</Deck>';
  const packet = createMotionDocSlideClipboardPacket(source, 0);
  assert.ok(packet);
  assert.deepEqual(parseMotionDocSlideClipboardPacket(serializeMotionDocSlideClipboardPacket(packet)), packet);

  const pasted = insertMotionDocSlideSource(source, 1, packet.slideSource, "after");
  assert.equal((pasted.match(/<Slide>/g) ?? []).length, 3);
  assert.ok(pasted.lastIndexOf(">One</Text>") > pasted.indexOf(">Two</Text>"));
});

test("active canvas pointer ownership preserves a newly started marquee", () => {
  assert.equal(shouldClearActiveSlideFrameSelection({ insideCanvas: true, isFrameControl: false }), false);
  assert.equal(shouldClearActiveSlideFrameSelection({ insideCanvas: false, isFrameControl: true }), false);
  assert.equal(shouldClearActiveSlideFrameSelection({ insideCanvas: false, isFrameControl: false }), true);
});

test("equal distribution and one-shot grid snapping update persisted frames", () => {
  const slide: MotionDocScene = {
    blocks: [
      { props: { h: 10, w: 10, x: 3.2, y: 10 }, type: "Shape" },
      { props: { h: 10, w: 10, x: 31, y: 10 }, type: "Shape" },
      { props: { h: 10, w: 10, x: 70, y: 10 }, type: "Shape" }
    ],
    duration: 5,
    props: {}
  };
  const distributed = distributeSelectedBlocks(slide, [0, 1, 2], "horizontal");
  assert.equal(distributed.didUpdate, true);
  assert.equal(distributed.slide.blocks[1]?.props.x, 36.6);
  const snapped = snapSelectedBlocksToGrid(distributed.slide, [0, 1, 2]);
  assert.equal(snapped.didUpdate, true);
  assert.notEqual(snapped.slide.blocks[0]?.props.x, 3.2);
});
