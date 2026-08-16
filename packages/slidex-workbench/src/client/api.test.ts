import assert from "node:assert/strict";
import test from "node:test";

import {
  localWorkbenchApiPath,
  localWorkbenchAssetUrl,
  prepareExportDestination
} from "./api";

test("Workspace editor API helpers keep document and asset requests on the active deck route", (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { pathname: "/workspace/quarterly-launch" } }
  });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  assert.equal(
    localWorkbenchApiPath("/api/v1/document"),
    "/api/v1/workspace/presentations/quarterly-launch/editor/api/v1/document"
  );
  assert.equal(
    localWorkbenchAssetUrl("assets/cover.webp"),
    "/api/v1/workspace/presentations/quarterly-launch/editor/assets/cover.webp"
  );
});

test("PowerPoint export asks for its destination before generation starts", async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let pickerCalls = 0;
  const handle = { createWritable: async () => ({ close: async () => {}, write: async () => {} }), name: "renamed.pptx" };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
      showSaveFilePicker: async () => {
        pickerCalls += 1;
        return handle;
      }
    }
  });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const destination = await prepareExportDestination("quarterly-launch", "pptx");

  assert.equal(pickerCalls, 1);
  assert.equal(destination?.handle, handle);
  assert.equal(destination?.output, "renamed.pptx");
});

test("cancelling the PowerPoint save picker cancels export preparation", async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
      showSaveFilePicker: async () => {
        throw new DOMException("Cancelled", "AbortError");
      }
    }
  });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  assert.equal(await prepareExportDestination("quarterly-launch", "pptx"), null);
});
