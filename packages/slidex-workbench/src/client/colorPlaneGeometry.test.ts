import assert from "node:assert/strict";
import test from "node:test";
import {
  colorPlanePosition,
  colorPlaneValueAtPoint
} from "../../../../features/pitch/application/colorPlaneGeometry";

test("pure white is positioned at the exact top-left corner of the color plane", () => {
  assert.deepEqual(colorPlanePosition({ s: 0, v: 1 }), { x: 0, y: 0 });
});

test("the color plane corners map to exact HSV saturation and value limits", () => {
  assert.deepEqual(
    colorPlaneValueAtPoint({ height: 128, width: 240, x: 0, y: 0 }),
    { s: 0, v: 1 }
  );
  assert.deepEqual(
    colorPlaneValueAtPoint({ height: 128, width: 240, x: 240, y: 128 }),
    { s: 1, v: 0 }
  );
});

test("color plane pointer coordinates clamp only at the actual plane edges", () => {
  assert.deepEqual(colorPlanePosition({ s: -0.2, v: 1.2 }), { x: 0, y: 0 });
  assert.deepEqual(colorPlanePosition({ s: 1.2, v: -0.2 }), { x: 1, y: 1 });
});
