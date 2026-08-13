import assert from "node:assert/strict";
import test from "node:test";

import { isModifierCanvasZoomEvent } from "../../../../features/pitch/application/canvasZoom";

test("modifier-scroll zoom is explicit and does not consume ordinary canvas scrolling", () => {
  assert.equal(isModifierCanvasZoomEvent({ ctrlKey: false, metaKey: false }), false);
  assert.equal(isModifierCanvasZoomEvent({ ctrlKey: true, metaKey: false }), true);
  assert.equal(isModifierCanvasZoomEvent({ ctrlKey: false, metaKey: true }), true);
});
