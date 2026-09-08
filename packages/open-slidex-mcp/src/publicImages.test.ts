import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { request } from "node:https";
import { PassThrough } from "node:stream";
import test from "node:test";

import { downloadPublicHttpsResource } from "@/common/util/publicHttpsDownload";
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

test("public image download rejects DNS answers containing any private address before requesting", async () => {
  let requested = false;
  await assert.rejects(
    () => downloadPublicImage("https://images.example/image.png", {
      request: (() => {
        requested = true;
        throw new Error("request should not run");
      }) as never,
      resolver: async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "169.254.169.254", family: 4 }
      ]
    }),
    /public addresses/
  );
  assert.equal(requested, false);
});

test("public HTTPS downloads revalidate redirects and preserve valid public images", async () => {
  const blockedRequest = mockHttpsRequest([
    { headers: { location: "https://127.0.0.1/internal.png" }, status: 302 }
  ]);
  await assert.rejects(
    () => downloadPublicHttpsResource("https://images.example/start.png", {
      maximumBytes: 1024,
      request: blockedRequest.request,
      resolver: async () => [{ address: "1.1.1.1", family: 4 }],
      userAgent: "OpenSlideX test"
    }),
    /public addresses/
  );
  assert.equal(blockedRequest.calls(), 1);

  const validRequest = mockHttpsRequest([
    { headers: { location: "https://cdn.example/final.png" }, status: 302 },
    { body: Buffer.from([137, 80, 78, 71]), headers: { "content-type": "image/png" }, status: 200 }
  ]);
  const valid = await downloadPublicHttpsResource("https://images.example/start.png", {
    maximumBytes: 1024,
    request: validRequest.request,
    resolver: async () => [{ address: "1.1.1.1", family: 4 }],
    userAgent: "OpenSlideX test"
  });
  assert.equal(valid.finalUrl, "https://cdn.example/final.png");
  assert.equal(valid.mediaType, "image/png");
  assert.deepEqual(valid.bytes, new Uint8Array([137, 80, 78, 71]));
  assert.equal(validRequest.calls(), 2);
});

test("public HTTPS downloads bound streamed bytes and total request time", async () => {
  const oversizedRequest = mockHttpsRequest([
    { body: Buffer.from("12345"), headers: { "content-type": "image/png" }, status: 200 }
  ]);
  await assert.rejects(
    () => downloadPublicHttpsResource("https://images.example/large.png", {
      maximumBytes: 4,
      request: oversizedRequest.request,
      resolver: async () => [{ address: "1.1.1.1", family: 4 }],
      userAgent: "OpenSlideX test"
    }),
    /download limit/
  );

  const stalledRequest = mockHttpsRequest([]);
  await assert.rejects(
    () => downloadPublicHttpsResource("https://images.example/stalled.png", {
      maximumBytes: 4,
      request: stalledRequest.request,
      resolver: async () => [{ address: "1.1.1.1", family: 4 }],
      timeoutMs: 10,
      userAgent: "OpenSlideX test"
    }),
    /timed out/
  );
});

function mockHttpsRequest(responses: Array<{
  body?: Uint8Array;
  headers?: Record<string, string>;
  status: number;
}>) {
  let callCount = 0;
  const requestImpl = ((_options: unknown, callback: (response: IncomingMessage) => void) => {
    callCount += 1;
    const client = new EventEmitter() as EventEmitter & {
      destroy(error?: Error): void;
      end(): void;
    };
    client.destroy = (error?: Error) => {
      if (error) client.emit("error", error);
    };
    client.end = () => {
      const response = responses.shift();
      if (!response) return;
      queueMicrotask(() => {
        const stream = new PassThrough() as PassThrough & IncomingMessage;
        stream.statusCode = response.status;
        stream.headers = response.headers ?? {};
        callback(stream);
        stream.end(response.body ? Buffer.from(response.body) : undefined);
      });
    };
    return client;
  }) as unknown as typeof request;
  return { calls: () => callCount, request: requestImpl };
}
