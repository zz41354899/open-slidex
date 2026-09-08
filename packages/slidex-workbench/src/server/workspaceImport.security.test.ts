import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { packageHtmlAssets } from "./workspaceImport";

test("HTML asset packaging confines relative files to a real asset root", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "slidex-html-asset-security-"));
  const root = path.join(workspace, "source");
  const outside = path.join(workspace, "outside");
  try {
    await Promise.all([mkdir(root), mkdir(outside)]);
    const png = await sharp({
      create: { background: "#3157d5", channels: 4, height: 16, width: 16 }
    }).png().toBuffer();
    await writeFile(path.join(root, "cover.png"), png);
    await writeFile(path.join(outside, "secret.jpg"), "not an image", "utf8");

    const valid = await packageHtmlAssets(
      "<!doctype html><html><head><style>.hero{background:url('./cover.png')}</style></head><body><img src=\"cover.png\" srcset=\"./cover.png 1x\"><div style=\"background:url(cover.png)\"></div></body></html>",
      { assetRoot: root }
    );
    assert.equal(valid.assets.length, 1);
    assert.match(valid.source, /html-asset-[a-f0-9]{16}\.webp/);
    assert.doesNotMatch(valid.source, /(?:\.\/)?cover\.png/);

    await symlink(path.join(outside, "secret.jpg"), path.join(root, "leak.jpg"));
    await assert.rejects(
      () => packageHtmlAssets(
        "<!doctype html><html><body><img src=\"leak.jpg\"></body></html>",
        { assetRoot: root }
      ),
      /regular non-symlink file/
    );
    await assert.rejects(
      () => packageHtmlAssets(
        `<!doctype html><html><body><img src=\"${path.join(outside, "secret.jpg")}\"></body></html>`,
        { assetRoot: root }
      ),
      /absolute paths are not allowed/
    );
    for (const html of [
      `<!doctype html><html><body background="file://${path.join(outside, "secret.jpg")}"></body></html>`,
      `<!doctype html><html><body><svg><filter><feImage href="${path.join(outside, "secret.jpg")}" /></filter></svg></body></html>`
    ]) {
      await assert.rejects(() => packageHtmlAssets(html, { assetRoot: root }), /file URLs are not allowed|absolute paths are not allowed/);
    }
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("HTML asset packaging rejects a symlinked asset root and fake raster bytes", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "slidex-html-root-security-"));
  const realRoot = path.join(workspace, "real");
  const linkedRoot = path.join(workspace, "linked");
  try {
    await mkdir(realRoot);
    await writeFile(path.join(realRoot, "fake.jpg"), "local secret", "utf8");
    await symlink(realRoot, linkedRoot);
    const html = "<!doctype html><html><body><img src=\"fake.jpg\"></body></html>";
    await assert.rejects(() => packageHtmlAssets(html, { assetRoot: linkedRoot }), /real directory/);
    await assert.rejects(() => packageHtmlAssets(html, { assetRoot: realRoot }), /do not match a supported raster image/);
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
});

test("HTML asset packaging rejects PNG dimensions above the product pixel budget", async () => {
  const png = await sharp({
    create: { background: "#3157d5", channels: 4, height: 1, width: 1 }
  }).png().toBuffer();
  const oversized = Buffer.from(png);
  oversized.writeUInt32BE(10_000, 16);
  oversized.writeUInt32BE(5_000, 20);
  oversized.writeUInt32BE(crc32(oversized.subarray(12, 29)), 29);

  const file = new File([oversized], "oversized.png", { type: "image/png" });
  await assert.rejects(
    () => packageHtmlAssets("<!doctype html><html><body><img src=\"oversized.png\"></body></html>", {
      htmlSidecars: [{ file, path: "oversized.png" }]
    }),
    /could not be converted to WebP/
  );
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
