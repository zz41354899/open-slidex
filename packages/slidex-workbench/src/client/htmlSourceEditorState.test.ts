import assert from "node:assert/strict";
import test from "node:test";

import {
  HTML_SOURCE_AUTOSAVE_DELAY_MS,
  MAX_HTML_SOURCE_BYTES,
  htmlSourceEditorMetrics,
  htmlSourceSaveEnabled,
  scheduleHtmlSourceAutosave
} from "./htmlSourceEditorState";

test("HTML editor metrics use UTF-8 bytes and stable line counts", () => {
  assert.deepEqual(htmlSourceEditorMetrics("<h1>日本語</h1>\n<p>Deck</p>"), {
    byteCount: 30,
    lineCount: 2
  });
});

test("HTML source saves only a changed, non-empty document within 50 MB", () => {
  assert.equal(htmlSourceSaveEnabled({ byteCount: 100, dirty: true, isSaving: false }), true);
  assert.equal(htmlSourceSaveEnabled({ byteCount: 100, dirty: false, isSaving: false }), false);
  assert.equal(htmlSourceSaveEnabled({ byteCount: 0, dirty: true, isSaving: false }), false);
  assert.equal(htmlSourceSaveEnabled({ byteCount: MAX_HTML_SOURCE_BYTES + 1, dirty: true, isSaving: false }), false);
  assert.equal(htmlSourceSaveEnabled({ byteCount: 100, dirty: true, isSaving: true }), false);
});

test("HTML autosave is debounced and keeps only the latest scheduled write", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { clearTimeout, setTimeout }
  });
  try {
    const writes: string[] = [];
    const cancelFirst = scheduleHtmlSourceAutosave(() => writes.push("stale"), 15);
    cancelFirst();
    scheduleHtmlSourceAutosave(() => writes.push("latest"), 15);
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.deepEqual(writes, ["latest"]);
    assert.equal(HTML_SOURCE_AUTOSAVE_DELAY_MS, 900);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
