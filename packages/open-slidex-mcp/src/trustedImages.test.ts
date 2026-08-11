import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { appendImageProvenance, downloadTrustedImage, readBoundedResponse, searchTrustedImages } from "./trustedImages";

const photo = {
  alt_description: "Team workshop",
  height: 800,
  id: "photo_123",
  links: { download_location: "https://api.unsplash.com/photos/photo_123/download" },
  urls: {
    regular: "https://images.unsplash.com/photo-123",
    thumb: "https://images.unsplash.com/photo-123-thumb"
  },
  user: { links: { html: "https://unsplash.com/@artist" }, name: "Artist" },
  width: 1200
};

test("trusted image search returns attributable candidates without downloading", async () => {
  const requests: string[] = [];
  const result = await searchTrustedImages("team", {
    accessKey: "test-key",
    fetch: async (input) => {
      requests.push(String(input));
      return Response.json({ results: [photo] });
    }
  });
  assert.equal(result.status, "ok");
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.candidates[0]?.attribution.name, "Artist");
  assert.equal(requests.length, 1);
});

test("trusted image download rejects non-image bytes before import", async () => {
  await assert.rejects(() => downloadTrustedImage("photo_123", {
    accessKey: "test-key",
    fetch: async (input) => {
      const url = String(input);
      if (url === "https://api.unsplash.com/photos/photo_123") return Response.json(photo);
      if (url === "https://api.unsplash.com/photos/photo_123/download") return Response.json({ url: photo.urls.regular });
      return new Response("not an image", { headers: { "content-type": "text/plain" } });
    }
  }), /unsupported image type/);
});

test("bounded trusted image reads stop when streamed bytes exceed the limit", async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5, 6]));
      controller.close();
    }
  }));
  await assert.rejects(() => readBoundedResponse(response, 5), /exceeds the import limit/);
});

test("parallel provenance appends preserve every imported asset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-provenance-"));
  try {
    await Promise.all(Array.from({ length: 20 }, (_, index) => appendImageProvenance(root, {
      alt: `Image ${index}`,
      attribution: { name: "Artist", profileUrl: "https://unsplash.com/@artist" },
      height: 800,
      id: `photo_${index}`,
      importedAt: new Date().toISOString(),
      license: "Unsplash License",
      provider: "unsplash",
      source: `assets/image-${index}.webp`,
      thumbUrl: "https://images.unsplash.com/thumb",
      width: 1200
    })));
    const records = JSON.parse(await readFile(path.join(root, ".open-slidex", "asset-provenance.json"), "utf8")) as unknown[];
    assert.equal(records.length, 20);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
