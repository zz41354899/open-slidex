import assert from "node:assert/strict";
import test from "node:test";

import { downloadPublicImage, isBlockedAddress } from "./publicImages";

test("public image policy blocks local, private, reserved, and mapped addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1"
  ]) assert.equal(isBlockedAddress(address), true, address);
  assert.equal(isBlockedAddress("1.1.1.1"), false);
  assert.equal(isBlockedAddress("2606:4700:4700::1111"), false);
});

test("public image download rejects non-HTTPS and loopback targets before requesting", async () => {
  await assert.rejects(() => downloadPublicImage("http://example.com/image.png"), /public HTTPS/);
  await assert.rejects(() => downloadPublicImage("https://127.0.0.1/image.png"), /public addresses/);
});
