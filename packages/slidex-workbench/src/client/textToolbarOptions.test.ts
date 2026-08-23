import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import { isTextOptionsFloatingChild } from "../../../../features/pitch/ui/preview/TextToolbarOptions";

test("text toolbar recognizes pointer targets from its portalled floating controls", () => {
  const window = new Window();
  const previousElement = globalThis.Element;
  Object.assign(globalThis, { Element: window.Element });

  try {
    const panel = window.document.createElement("div");
    panel.dataset.textOptionsFloatingChild = "";
    const slider = window.document.createElement("div");
    panel.append(slider);

    assert.equal(isTextOptionsFloatingChild(slider as unknown as EventTarget), true);
    assert.equal(isTextOptionsFloatingChild(window.document.createElement("button") as unknown as EventTarget), false);
  } finally {
    Object.assign(globalThis, { Element: previousElement });
  }
});
