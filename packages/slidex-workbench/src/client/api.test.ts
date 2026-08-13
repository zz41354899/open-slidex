import assert from "node:assert/strict";
import test from "node:test";

import { localWorkbenchApiPath, localWorkbenchAssetUrl } from "./api";

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
