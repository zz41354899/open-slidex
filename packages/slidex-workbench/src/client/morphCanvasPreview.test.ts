import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

import { normalizeMorphCanvasPreviewRange } from "../../../../features/pitch/application/morphCanvasPreview";
import { sharedMorphMotionIds } from "../../../../features/pitch/application/motionPlayback";

const scenes = [
  { props: { slideTransition: "morph" } },
  { props: { slideTransition: "morph" } },
  { props: { slideTransition: "morph" } },
  { props: { slideTransition: "none" } },
  { props: { slideTransition: "none" } }
];

test("Morph canvas preview resolves the complete contiguous sequence", () => {
  assert.deepEqual(normalizeMorphCanvasPreviewRange(scenes, { startSlideIndex: 0 }), {
    endSlideIndex: 3,
    startSlideIndex: 0
  });
});

test("Morph canvas preview clamps a requested end and keeps legacy pair requests working", () => {
  assert.deepEqual(normalizeMorphCanvasPreviewRange(scenes, { endSlideIndex: 99, sourceSlideIndex: 1 }), {
    endSlideIndex: 3,
    startSlideIndex: 1
  });
  assert.equal(normalizeMorphCanvasPreviewRange(scenes, { startSlideIndex: 3 }), null);
});

test("Morph playback identifies same-type shared layers whose Action initialization must wait for handoff", () => {
  const window = new Window();
  const root = window.document.createElement("div");
  root.innerHTML = `
    <div data-motion-sequence="{}" data-shared-id="planet" data-slidex-block-type="Shape"></div>
    <div data-motion-sequence="{}" data-shared-id="copy" data-slidex-block-type="Text"></div>
    <div data-motion-sequence="{}" data-shared-id="mismatched" data-slidex-block-type="Text"></div>
  `;
  const source = new Map([
    ["shared:planet", { type: "Shape" }],
    ["shared:mismatched", { type: "Shape" }]
  ]) as unknown as Parameters<typeof sharedMorphMotionIds>[1];

  assert.deepEqual([...sharedMorphMotionIds(root as unknown as HTMLElement, source)], ["planet"]);
});
