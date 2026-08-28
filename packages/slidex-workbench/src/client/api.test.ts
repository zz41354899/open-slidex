import assert from "node:assert/strict";
import test from "node:test";

import {
  exportDocument,
  localWorkbenchApiPath,
  localWorkbenchAssetUrl,
  materializeLocalExportMedia,
  prepareExportDestination,
  uploadAsset
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

test("asset upload retries the server-provided revision after a concurrent Canvas save", async (context) => {
  const originalFetch = globalThis.fetch;
  const revisions: string[] = [];
  let requests = 0;
  globalThis.fetch = async (_input, init) => {
    requests += 1;
    revisions.push(String(await (init?.body as FormData).get("expectedRevision")));
    if (requests === 1) {
      return new Response(JSON.stringify({
        code: "revision_conflict",
        currentRevision: "saved-while-file-picker-open",
        message: "presentation.mdx changed outside the workbench."
      }), { headers: { "content-type": "application/json" }, status: 409 });
    }
    return new Response(JSON.stringify({
      asset: { bytes: 4, mimeType: "image/png", name: "image.png", source: "assets/image.png", usedBy: [] }
    }), { headers: { "content-type": "application/json" }, status: 200 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await uploadAsset(new File(["png"], "image.png", { type: "image/png" }), "stale-revision");

  assert.equal(result.asset.source, "assets/image.png");
  assert.deepEqual(revisions, ["stale-revision", "saved-while-file-picker-open"]);
});

test("export materializes a temporary shape image as a Workspace asset", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const calls: Array<{ body?: BodyInit | null | undefined; url: string }> = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { pathname: "/workspace/quarterly-launch" } }
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ body: init?.body, url });
    if (url.startsWith("blob:")) {
      return new Response(new Blob(["image"], { type: "image/png" }));
    }
    return new Response(JSON.stringify({
      asset: { bytes: 5, mimeType: "image/webp", name: "shape.webp", source: "assets/shape.webp", usedBy: [] }
    }), { headers: { "content-type": "application/json" }, status: 200 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const result = await materializeLocalExportMedia({
    expectedRevision: "current",
    source: '<Slide><Shape shapeImageSrc="blob:http://127.0.0.1:4172/temporary" /></Slide>'
  });

  assert.equal(result.imported, 1);
  assert.match(result.source, /shapeImageSrc="assets\/shape\.webp"/);
  assert.equal(calls[1]?.url, "/api/v1/workspace/presentations/quarterly-launch/editor/api/v1/assets");
  assert.equal((calls[1]?.body as FormData).get("file") instanceof File, true);
});

test("every browser export asks for its destination before generation starts", async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const requested: Array<{ suggestedName?: string; types?: Array<{ accept: Record<string, string[]> }> }> = [];
  const handle = { createWritable: async () => ({ close: async () => {}, write: async () => {} }), name: "chosen-file" };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
      showSaveFilePicker: async (options: { suggestedName?: string; types?: Array<{ accept: Record<string, string[]> }> }) => {
        requested.push(options);
        return handle;
      }
    }
  });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  for (const format of ["html", "mdx", "pptx"] as const) {
    const destination = await prepareExportDestination("quarterly-launch", format);
    assert.equal(destination?.handle, handle);
    assert.equal(destination?.output, "chosen-file");
  }

  assert.deepEqual(requested.map((options) => options.suggestedName), [
    "quarterly-launch.html",
    "quarterly-launch.mdx",
    "quarterly-launch.pptx"
  ]);
  assert.deepEqual(requested.map((options) => Object.values(options.types?.[0]?.accept ?? {})[0]), [
    [".html"],
    [".mdx"],
    [".pptx"]
  ]);
});

test("cancelling the save picker cancels every export format", async (context) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: true,
      showSaveFilePicker: async () => { throw new DOMException("cancelled", "AbortError"); }
    }
  });
  context.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  for (const format of ["html", "mdx", "pptx"] as const) {
    assert.equal(await prepareExportDestination("quarterly-launch", format), null);
  }
});

test("native save writes the prepared one-time download instead of relying on an automatic browser download", async (context) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const calls: string[] = [];
  let closed = false;
  let written = "";
  const handle = {
    createWritable: async () => ({
      close: async () => { closed = true; },
      write: async (blob: Blob) => { written = await blob.text(); }
    }),
    name: "galaxy.mdx"
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { pathname: "/workspace/galaxy" } }
  });
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) {
      return new Response(JSON.stringify({
        downloadUrl: "/api/v1/export/download?token=one-time",
        output: "presentation.mdx"
      }), { headers: { "content-type": "application/json; charset=utf-8" }, status: 200 });
    }
    return new Response("# Galaxy", { headers: { "content-type": "text/mdx" }, status: 200 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const result = await exportDocument({
    fileName: "presentation",
    format: "mdx",
    overwrite: false,
    source: "<Presentation />",
    target: "download"
  }, { handle, output: handle.name });

  assert.deepEqual(calls, [
    "/api/v1/workspace/presentations/galaxy/editor/api/v1/export",
    "/api/v1/workspace/presentations/galaxy/editor/api/v1/export/download?token=one-time"
  ]);
  assert.equal(written, "# Galaxy");
  assert.equal(closed, true);
  assert.equal(result.output, "galaxy.mdx");
});

test("export uses a one-time same-deck URL for a native browser download", async (context) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let clicked = false;
  let deferredRemove: (() => void) | undefined;
  let removed = false;
  let requestBody: Record<string, unknown> | undefined;
  const anchor = {
    click: () => { clicked = true; },
    download: "",
    href: "",
    remove: () => { removed = true; },
    style: { display: "" }
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { append: () => {} },
      createElement: () => anchor
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { pathname: "/workspace/quarterly-launch" },
      setTimeout: (callback: () => void) => {
        deferredRemove = callback;
        return 1;
      }
    }
  });
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      downloadUrl: "/api/v1/export/download?token=one-time",
      output: "quarterly-launch.html"
    }), { headers: { "content-type": "application/json; charset=utf-8" }, status: 200 });
  };
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const result = await exportDocument({
    fileName: "quarterly-launch",
    format: "html",
    htmlMode: "player",
    overwrite: false,
    source: "<Presentation />",
    target: "download"
  });

  assert.equal(requestBody?.delivery, "browser");
  assert.equal(result.output, "quarterly-launch.html");
  assert.equal(anchor.download, "quarterly-launch.html");
  assert.equal(
    anchor.href,
    "/api/v1/workspace/presentations/quarterly-launch/editor/api/v1/export/download?token=one-time"
  );
  assert.equal(clicked, true);
  assert.equal(removed, false);
  deferredRemove?.();
  assert.equal(removed, true);
});

test("download fallback attaches its anchor and revokes the Blob URL after navigation starts", async (context) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalFetch = globalThis.fetch;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let appended = false;
  let clicked = false;
  let removed = false;
  let revoked = false;
  let deferredRevoke: (() => void) | undefined;
  const anchor = {
    click: () => { clicked = true; },
    download: "",
    href: "",
    remove: () => { removed = true; },
    style: { display: "" }
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { append: (node: unknown) => { appended = node === anchor; } },
      createElement: () => anchor
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      isSecureContext: false,
      location: { pathname: "/workspace/quarterly-launch" },
      setTimeout: (callback: () => void) => {
        deferredRevoke = callback;
        return 1;
      }
    }
  });
  URL.createObjectURL = () => "blob:export";
  URL.revokeObjectURL = () => { revoked = true; };
  globalThis.fetch = async () => new Response("<html></html>", {
    headers: { "content-disposition": 'attachment; filename="quarterly-launch.html"' },
    status: 200
  });
  context.after(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  const result = await exportDocument({
    fileName: "quarterly-launch",
    format: "html",
    htmlMode: "player",
    overwrite: false,
    source: "<Presentation />",
    target: "download"
  });

  assert.equal(result.output, "quarterly-launch.html");
  assert.equal(anchor.href, "blob:export");
  assert.equal(anchor.download, "quarterly-launch.html");
  assert.equal(anchor.style.display, "none");
  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.equal(revoked, false);
  deferredRevoke?.();
  assert.equal(revoked, true);
});

test("download rejects an empty export before creating a browser file", async (context) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    exportDocument({
      fileName: "quarterly-launch",
      format: "html",
      htmlMode: "player",
      overwrite: false,
      source: "<Presentation />",
      target: "download"
    }),
    /returned an empty file/i
  );
});
