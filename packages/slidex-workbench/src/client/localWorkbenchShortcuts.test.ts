import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import {
  isLocalWorkbenchWindowsRedoShortcut,
  isWorkbenchTypingTarget,
  localWorkbenchShortcut,
  localWorkbenchShortcutBindings
} from "./localWorkbenchShortcuts";

test("Local Workbench exposes the approved shortcut registry in toolbar order", () => {
  assert.deepEqual(
    localWorkbenchShortcutBindings.map(({ action, key }) => [action, key]),
    [
      ["select", "V"],
      ["hand", "H"],
      ["zoom", "Z"],
      ["temporary-hand", "Space"],
      ["text", "T"],
      ["media", "M"],
      ["shape", "S"],
      ["table", "B"],
      ["icon", "I"],
      ["chart", "C"],
      ["undo", "⌘/Ctrl Z"],
      ["redo", "⇧⌘Z / Ctrl Y"],
      ["command-menu", "⌘K"],
      ["assistant", "/"],
      ["shortcut-help", "⇧?"]
    ]
  );
  assert.equal(localWorkbenchShortcut("shape"), "S");
  assert.equal(new Set(localWorkbenchShortcutBindings.map(({ action }) => action)).size, localWorkbenchShortcutBindings.length);
});

test("Local Workbench recognizes Windows Ctrl+Y without overriding editor typing", () => {
  assert.equal(isLocalWorkbenchWindowsRedoShortcut({ altKey: false, ctrlKey: true, key: "y", metaKey: false, shiftKey: false }), true);
  assert.equal(isLocalWorkbenchWindowsRedoShortcut({ altKey: false, ctrlKey: false, key: "y", metaKey: true, shiftKey: false }), false);
  assert.equal(isLocalWorkbenchWindowsRedoShortcut({ altKey: false, ctrlKey: true, key: "y", metaKey: false, shiftKey: true }), false);
  assert.equal(isLocalWorkbenchWindowsRedoShortcut({ altKey: true, ctrlKey: true, key: "y", metaKey: false, shiftKey: false }), false);
});

test("Local Workbench single-key shortcuts ignore editing surfaces", () => {
  const window = new Window();
  const previous = globalThis.HTMLElement;
  Object.assign(globalThis, { HTMLElement: window.HTMLElement });

  try {
    for (const tag of ["input", "textarea", "select"]) {
      assert.equal(isWorkbenchTypingTarget(window.document.createElement(tag) as unknown as EventTarget), true);
    }
    const editable = window.document.createElement("div");
    editable.contentEditable = "true";
    assert.equal(isWorkbenchTypingTarget(editable as unknown as EventTarget), true);

    const codeEditor = window.document.createElement("div");
    codeEditor.dataset.codeEditor = "true";
    const codeChild = window.document.createElement("span");
    codeEditor.append(codeChild);
    assert.equal(isWorkbenchTypingTarget(codeChild as unknown as EventTarget), true);
    assert.equal(isWorkbenchTypingTarget(window.document.createElement("button") as unknown as EventTarget), false);
  } finally {
    Object.assign(globalThis, { HTMLElement: previous });
  }
});
