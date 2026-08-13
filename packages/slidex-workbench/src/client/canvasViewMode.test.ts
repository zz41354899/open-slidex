import assert from "node:assert/strict";
import test from "node:test";

import { initialCanvasScrollPositions, isCanvasViewMode } from "../../../../features/pitch/application/canvasViewMode";
import { canvasSlideRowsForRender } from "../../../../features/pitch/application/canvasSlideRender";

test("canvas view modes are workspace-only and begin with independent positions", () => {
  assert.equal(isCanvasViewMode("slide"), true);
  assert.equal(isCanvasViewMode("grid"), true);
  assert.equal(isCanvasViewMode("story"), false);
  assert.equal(isCanvasViewMode("horizontal"), false);
  assert.deepEqual(initialCanvasScrollPositions(), {
    grid: { left: 0, top: 0 },
    slide: { left: 0, top: 0 }
  });
});

test("both views retain the complete source-backed slide record sequence", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    duration: 5,
    index,
    layers: 0,
    title: `Slide ${index + 1}`
  }));

  assert.deepEqual(canvasSlideRowsForRender(rows).map((slide) => slide.index), rows.map((slide) => slide.index));
});
