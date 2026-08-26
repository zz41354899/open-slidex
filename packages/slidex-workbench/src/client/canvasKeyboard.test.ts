import assert from "node:assert/strict";
import test from "node:test";

import {
  canvasKeyboardIntentFromUnknown,
  canvasKeyboardZoomCommand
} from "@/features/pitch/application/canvasKeyboard";

test("Canvas keyboard zoom supports Cmd and Ctrl without consuming unmodified keys", () => {
  assert.equal(canvasKeyboardZoomCommand({ altKey: false, ctrlKey: false, key: "=", metaKey: false }), null);
  assert.equal(canvasKeyboardZoomCommand({ altKey: false, ctrlKey: false, key: "=", metaKey: true }), "in");
  assert.equal(canvasKeyboardZoomCommand({ altKey: false, ctrlKey: true, key: "-", metaKey: false }), "out");
  assert.equal(canvasKeyboardZoomCommand({ altKey: false, ctrlKey: false, key: "0", metaKey: true }), "fit");
  assert.equal(canvasKeyboardZoomCommand({ altKey: true, ctrlKey: false, key: "=", metaKey: true }), null);
});

test("sandboxed HTML can only forward recognized Canvas keyboard intents", () => {
  assert.deepEqual(canvasKeyboardIntentFromUnknown({ active: true, kind: "temporary-hand" }), {
    active: true,
    kind: "temporary-hand"
  });
  assert.deepEqual(canvasKeyboardIntentFromUnknown({ command: "out", kind: "zoom" }), {
    command: "out",
    kind: "zoom"
  });
  assert.deepEqual(canvasKeyboardIntentFromUnknown({ kind: "tool", tool: "hand" }), {
    kind: "tool",
    tool: "hand"
  });
  assert.deepEqual(canvasKeyboardIntentFromUnknown({
    deltaMode: 0,
    deltaY: 34,
    kind: "wheel-zoom",
    xRatio: 1.2,
    yRatio: -0.2
  }), {
    deltaMode: 0,
    deltaY: 34,
    kind: "wheel-zoom",
    xRatio: 1,
    yRatio: 0
  });
  assert.equal(canvasKeyboardIntentFromUnknown({ command: "reload", kind: "zoom" }), null);
  assert.equal(canvasKeyboardIntentFromUnknown({ kind: "tool", tool: "rotate" }), null);
  assert.equal(canvasKeyboardIntentFromUnknown({ active: "yes", kind: "temporary-hand" }), null);
});
