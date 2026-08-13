import assert from "node:assert/strict";
import test from "node:test";

import { canvasToolFromShortcut, canvasToolOptions } from "../../../../features/pitch/application/canvasTools";

test("rotation stays on selected-object handles rather than the global tool registry", () => {
  assert.equal(canvasToolOptions.some((tool) => String(tool.id) === "rotate"), false);
  assert.equal(canvasToolFromShortcut("r"), null);
  assert.equal(canvasToolFromShortcut("R"), null);
});
