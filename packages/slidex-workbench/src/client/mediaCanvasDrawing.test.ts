import assert from "node:assert/strict";
import test from "node:test";

import { mediaDrawResult } from "../../../../features/pitch/application/shapeDrawing";

test("media draw gestures use canvas pixels before serializing a MotionDoc frame", () => {
  const result = mediaDrawResult({ x: 10, y: 20 }, { x: 60, y: 70 });

  assert.deepEqual(result.frame, { h: 50, w: 50, x: 10, y: 20 });
  assert.equal(result.frame.w / 100 * 1920, 960);
  assert.equal(result.frame.h / 100 * 1080, 540);
});

test("media drawing keeps shape modifiers for centered and aspect-locked frames", () => {
  const result = mediaDrawResult({ x: 50, y: 50 }, { x: 60, y: 55 }, {
    fromCenter: true,
    preserveAspectRatio: true
  });

  assert.deepEqual(result.frame, { h: 20, w: 20, x: 40, y: 40 });
});
