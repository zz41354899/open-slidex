import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { presenterRemotePage } from "./presenterRemotePage";

import { PresenterRemoteServer } from "./presenterRemote";

test("phone remote keeps its pairing secret in the URL fragment and requires it for commands", async () => {
  const remote = new PresenterRemoteServer("127.0.0.1");
  try {
    const session = await remote.create({ currentSlideIndex: 0, slideCount: 3 });
    assert.equal(session.protocolVersion, 2);
    const [publicUrl, token] = session.remoteUrl.split("#");
    assert.ok(publicUrl);
    assert.ok(token);
    assert.ok(session.qrSvg.includes("<svg"));
    assert.ok(!publicUrl?.includes(token ?? ""));

    const page = await fetch(publicUrl);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'self'/);
    const html = await page.text();
    assert.ok(!html.includes(token ?? ""));
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";
    assert.doesNotThrow(() => new Function(script));

    const denied = await fetch(`${publicUrl}/command`, {
      body: JSON.stringify({ type: "slide", direction: "next" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    assert.equal(denied.status, 403);

    const accepted = await fetch(`${publicUrl}/command`, {
      body: JSON.stringify({ type: "slide", direction: "next" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST"
    });
    assert.equal(accepted.status, 204);
    assert.deepEqual(remote.read(session.id).command, { direction: "next", id: 1, type: "slide" });
    assert.deepEqual(remote.read(session.id).timer, { breakMinutes: 2, elapsedSeconds: 0, focusMinutes: 10, isRunning: false, phase: "ready", remainingSeconds: 600 });

    const timer = await fetch(`${publicUrl}/command`, {
      body: JSON.stringify({ breakMinutes: 3, focusMinutes: 25, type: "timer.configure" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST"
    });
    assert.equal(timer.status, 204);
    assert.deepEqual(remote.read(session.id).command, { breakMinutes: 3, focusMinutes: 25, id: 2, type: "timer.configure" });
  } finally {
    await remote.close();
  }
});

test("phone script decodes fragmented SSE frames and renders both locales", async () => {
  for (const locale of ["en", "zh-TW"] as const) {
    const elements = new Map<string, { textContent: string; value: string; disabled: boolean; dataset: Record<string, string> }>();
    const query = (selector: string) => {
      if (!elements.has(selector)) elements.set(selector, { textContent: "", value: "", disabled: false, dataset: {} });
      return elements.get(selector)!;
    };
    const state = { slideRevision: 0, currentSlideIndex: 2, slideCount: 8, timer: { remainingSeconds: 600, elapsedSeconds: 0, isRunning: false, phase: "ready" } };
    const frame = "event: state\ndata: " + JSON.stringify(state) + "\n\n";
    const chunks = [frame.slice(0, 12), frame.slice(12, -1), frame.slice(-1)];
    const script = presenterRemotePage("test-session", locale).match(/<script>([\s\S]*)<\/script>/)![1]!;
    runInNewContext(script, {
      document: { documentElement: {}, body: { classList: { toggle() {} } }, querySelector: query, querySelectorAll: () => [] },
      location: { hash: "#test-token" }, performance: { now: () => 0 }, TextDecoder, crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
      setInterval() {}, setTimeout() {},
      fetch: async () => ({ status: 200, ok: true, body: { getReader: () => ({
        read: async () => chunks.length ? { done: false, value: new TextEncoder().encode(chunks.shift()) } : new Promise(() => {}),
        cancel: async () => {}
      }) } })
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(query("#status").textContent, locale === "en" ? "Connected" : "已連線");
    assert.equal(query("#count").textContent, 3);
    assert.equal(query("#next").disabled, false);
    assert.equal(query("#clock").textContent, "10:00");
    assert.equal(query("#timer-toggle").textContent, locale === "en" ? "Start" : "開始");
  }
});

test("phone connection state reaches the host immediately and burst commands stay ordered", async () => {
  const remote = new PresenterRemoteServer("127.0.0.1");
  const abort = new AbortController();
  try {
    const session = await remote.create({ currentSlideIndex: 0, slideCount: 30, locale: "en" });
    const [url, token] = session.remoteUrl.split("#");
    const updates: Array<ReturnType<typeof remote.read>> = [];
    const unsubscribe = remote.subscribe(session.id, state => updates.push(state));
    const response = await fetch(url + "/events", { signal: abort.signal, headers: { authorization: "Bearer " + token } });
    const reader = response.body!.getReader();
    const frame = new TextDecoder().decode((await reader.read()).value);
    assert.match(frame, /"connected":true/);
    assert.equal(updates.at(-1)?.connected, true);
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const sent = await fetch(url + "/command", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify({ type: "slide", direction: "next" }) });
      assert.equal(sent.status, 204);
      ids.push(updates.at(-1)!.command!.id);
    }
    assert.deepEqual(ids, Array.from({ length: 10 }, (_, i) => i + 1));
    abort.abort();
    await reader.cancel().catch(() => undefined);
    unsubscribe();
    remote.closeSession(session.id);
    assert.equal((await fetch(url!)).status, 410);
  } finally { abort.abort(); await remote.close(); }
});

test("phone commands are pushed to the local presenter listener without polling", async () => {
  const remote = new PresenterRemoteServer("127.0.0.1");
  try {
    const session = await remote.create({ currentSlideIndex: 0, slideCount: 3 });
    const [, token] = session.remoteUrl.split("#");
    const updates: Array<ReturnType<typeof remote.read>> = [];
    const unsubscribe = remote.subscribe(session.id, (state) => updates.push(state));
    const response = await fetch(`${session.remoteUrl.split("#")[0]}/command`, {
      body: JSON.stringify({ direction: "next", type: "slide" }),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method: "POST"
    });
    assert.equal(response.status, 204);
    assert.deepEqual(updates.at(-1)?.command, { direction: "next", id: 1, type: "slide" });
    unsubscribe();
  } finally {
    await remote.close();
  }
});

test("sequenced slides reach audience subscribers without a presenter relay and ignore late requests", async () => {
  const remote = new PresenterRemoteServer("127.0.0.1");
  try {
    const session = await remote.create({ currentSlideIndex: 0, slideCount: 30 });
    const [url, token] = session.remoteUrl.split("#");
    const audience: number[] = [];
    const unsubscribe = remote.subscribe(session.id, state => audience.push(state.currentSlideIndex));
    const send = async (sequence: number, index: number) => {
      const response = await fetch(url + "/command", {
        method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ type: "slide", clientId: "phone", sequence, index })
      });
      assert.equal(response.status, 200);
      return response.json();
    };
    // Deliberately arrive out of order, including a duplicate retry.
    await send(3, 3);
    await send(1, 1);
    await send(2, 2);
    await send(3, 3);
    assert.equal(remote.read(session.id).currentSlideIndex, 3);
    assert.equal(remote.read(session.id).slideRevision, 1);
    assert.ok(audience.slice(1).every(index => index === 3));
    const timer = { ...remote.read(session.id).timer, focusMinutes: 25 };
    remote.update(session.id, { timer });
    assert.equal(remote.read(session.id).currentSlideIndex, 3, "timer-only updates cannot roll back a slide");
    await send(4, 2);
    assert.equal(audience.at(-1), 2);
    // Desktop requests have their own ordering and use the same authority.
    remote.update(session.id, { currentSlideIndex: 8, clientId: "desktop", sequence: 2 });
    remote.update(session.id, { currentSlideIndex: 7, clientId: "desktop", sequence: 1 });
    assert.equal(remote.read(session.id).currentSlideIndex, 8);
    unsubscribe();
  } finally { await remote.close(); }
});

test("phone taps bypass a stalled timer and earlier slide response, with immediate feedback and timeout", async () => {
  const elements = new Map<string, any>();
  const query = (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, { textContent: "", value: "", disabled: false, dataset: {} });
    return elements.get(selector)!;
  };
  const initial = { slideRevision: 0, currentSlideIndex: 0, slideCount: 8, timer: { remainingSeconds: 600, elapsedSeconds: 0, isRunning: false, phase: "ready" } };
  let firstFrame = true;
  const requests: Array<{ body: any; resolve: (response: any) => void; signal: AbortSignal }> = [];
  const timeouts: Array<() => void> = [];
  runInNewContext(presenterRemotePage("test", "en").match(/<script>([\s\S]*)<\/script>/)![1]!, {
    document: { documentElement: {}, body: { classList: { toggle() {} } }, querySelector: query, querySelectorAll: () => [] },
    location: { hash: "#token" }, performance: { now: () => 0 }, TextDecoder, AbortController,
    // LAN HTTP does not need the secure-context-only randomUUID API.
    crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
    setInterval() {}, setTimeout(fn: () => void) { timeouts.push(fn); return timeouts.length; }, clearTimeout() {},
    fetch: async (_url: string, options: any) => {
      if (options.method === "POST") return new Promise((resolve, reject) => {
        requests.push({ body: JSON.parse(options.body), resolve, signal: options.signal });
        options.signal.addEventListener("abort", () => reject(new Error("timeout")));
      });
      return { status: 200, ok: true, body: { getReader: () => ({
        read: async () => {
          if (!firstFrame) return new Promise(() => {});
          firstFrame = false;
          return { done: false, value: new TextEncoder().encode("event: state\ndata: " + JSON.stringify(initial) + "\n\n") };
        }, cancel: async () => {}
      }) } };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  query("#timer-toggle").onclick();
  await new Promise(resolve => setImmediate(resolve));
  query("#next").onclick();
  query("#next").onclick();
  query("#previous").onclick();
  assert.equal(requests.length, 4, "all taps leave immediately while every earlier response is stalled");
  assert.deepEqual(requests.slice(1).map(r => r.body.index), [1, 2, 1]);
  assert.deepEqual(requests.slice(1).map(r => r.body.sequence), [1, 2, 3]);
  assert.equal(query("#count").textContent, 2);
  requests[3]!.resolve({ status: 200, ok: true, json: async () => ({ ...initial, slideRevision: 3, currentSlideIndex: 1 }) });
  await new Promise(resolve => setImmediate(resolve));
  requests[2]!.resolve({ status: 200, ok: true, json: async () => ({ ...initial, slideRevision: 2, currentSlideIndex: 2 }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(query("#count").textContent, 2, "late acknowledgments cannot rewind the indicator");
  timeouts[0]!();
  assert.equal(requests[0]!.signal.aborted, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(query("#error").textContent, "Command failed. Try again.");
});

test("local command latency probe (service acknowledgment, not physical phone-to-paint)", async context => {
  const remote = new PresenterRemoteServer("127.0.0.1");
  try {
    const session = await remote.create({ currentSlideIndex: 0, slideCount: 100 });
    const [url, token] = session.remoteUrl.split("#");
    const samples: number[] = [];
    for (let sequence = 1; sequence <= 40; sequence++) {
      const start = performance.now();
      const response = await fetch(url + "/command", {
        method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ type: "slide", index: sequence, clientId: "probe", sequence })
      });
      const state = await response.json();
      samples.push(performance.now() - start);
      assert.equal(state.currentSlideIndex, sequence);
    }
    samples.sort((a, b) => a - b);
    context.diagnostic(`40 loopback HTTP commands: p50=${samples[19]!.toFixed(2)}ms, p95=${samples[37]!.toFixed(2)}ms. Excludes LAN and browser rendering.`);
  } finally { await remote.close(); }
});
