import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { openSlideXToolNames } from "../shared/aiEvents";
import { buildCodexInstructions, canvasEditPreviewPlan, CodexAppServer, codexModelPreset, describeToolActivity, safePreviewPath } from "./codexAppServer";
import type { OpenSlideXAiRunInput } from "./aiBridge";

test("Codex App Server maps real protocol notifications into ordered AI events", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot);
  try {
    const events = [];
    for await (const event of server.run(runInput("Read the presentation"), "00000000-0000-4000-8000-000000000001")) {
      events.push(event);
    }
    assert.deepEqual(events.map((event) => event.type), [
      "phase",
      "phase",
      "tool.started",
      "phase",
      "tool.completed",
      "text",
      "run.completed"
    ]);
    const started = events.find((event) => event.type === "tool.started");
    assert.equal(started?.tool, "open_slidex_open");
    assert.equal(events.find((event) => event.type === "text")?.delta, "Deck loaded.");
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("Codex App Server preserves a structured visual QA failure when the protocol error is empty", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot);
  try {
    const events = [];
    for await (const event of server.run(runInput("quality failure"), "00000000-0000-4000-8000-000000000005")) {
      events.push(event);
    }
    const failure = events.find((event) => event.type === "tool.failed");
    assert.equal(failure?.type, "tool.failed");
    if (failure?.type !== "tool.failed") return;
    assert.match(failure.message, /Candidate was not written: visual QA found 2 blocking issues/);
    assert.match(failure.message, /Slide 1 · text_overflow · node hero-title/);
    assert.match(failure.message, /Slide 2 · text_collision · node summary/);
    assert.match(failure.message, /Canvas unchanged/);
    assert.doesNotMatch(failure.message, /The OpenSlideX tool failed/);
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("Codex App Server warm-up initializes its isolated transport only once", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot);
  try {
    await Promise.all([server.warm(), server.warm(), server.warm()]);
    assert.equal(await readFile(fixture.initializeLog, "utf8"), "initialize\n");
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("edit activity exposes only structured slide and block targets", () => {
  const activity = describeToolActivity("open_slidex_edit", {
    commands: [
      { nodeId: "hero-title", props: { text: "private source text" }, slideIndex: 1, type: "block.update" },
      { slideIndex: 3, slideSource: "<Slide>private</Slide>", type: "slide.replace" }
    ]
  }, { slideIndex: 0 });
  assert.deepEqual(activity.targets, [
    { kind: "block", nodeId: "hero-title", slideIndex: 1 },
    { kind: "slide", slideIndex: 3 }
  ]);
  assert.match(activity.details[0] ?? "", /block\.update · slide 2 · node hero-title/);
  assert.doesNotMatch(JSON.stringify(activity), /private source text|<Slide>/);
});

test("edit preview metadata is transient, revision-bound, and available only for OpenSlideX edits", () => {
  const commands = [{ nodeId: "hero-title", props: { text: "Preview" }, slideIndex: 0, type: "block.update" }];
  assert.deepEqual(canvasEditPreviewPlan("open_slidex_edit", {
    commands,
    expectedRevision: "sha256:fixture"
  }, "sha256:fixture"), {
    commands,
    expectedRevision: "sha256:fixture",
    kind: "edit-commands"
  });
  assert.equal(canvasEditPreviewPlan("open_slidex_edit", {
    commands,
    expectedRevision: "sha256:stale"
  }, "sha256:fixture"), undefined);
  assert.equal(canvasEditPreviewPlan("open_slidex_open", { commands }, "sha256:fixture"), undefined);
});

test("Codex instructions restrict a normal edit to the frozen slide selection", () => {
  const instructions = buildCodexInstructions({
    blockIndex: 2,
    expectedRevision: "sha256:fixture",
    prompt: "Improve this chart",
    provider: "codex",
    slideIndex: 3
  });

  assert.match(instructions, /edit only slide 4 and block 2/i);
  assert.match(instructions, /visible slide 4 must be passed .* as slideIndex 3/i);
  assert.match(instructions, /Do not add, delete, reorder, or modify any other slide/i);
  assert.match(instructions, /exactly once with mode='bundle'/i);
  assert.match(instructions, /design for visual edits/i);
  assert.match(instructions, /Do not read the four skills separately/i);
  assert.match(instructions, /referenceMode='role-samples' and includeStarterSource=true/i);
  assert.match(instructions, /role-based MDX excerpts/i);
  assert.match(instructions, /never claim template fidelity from the blueprint alone/i);
  assert.match(instructions, /single-slide or selected-element edit.*matching role sample/i);
  assert.match(instructions, /Do not call open_slidex_validate, open_slidex_render, or open_slidex_quality_check again/i);
  assert.match(instructions, /at most two patch attempts for one slide/i);
  assert.match(instructions, /three for multi-slide work/i);
  assert.match(instructions, /Never resubmit identical geometry/i);
  assert.match(instructions, /quality_gate_failed/i);
  assert.match(instructions, /expectedRevision are unchanged/i);
});

test("Codex model profiles are explicit run-scoped model and effort presets", () => {
  assert.deepEqual(codexModelPreset("fast"), { effort: "low", model: "gpt-5.6-luna" });
  assert.deepEqual(codexModelPreset("balanced"), { effort: "medium", model: "gpt-5.6-terra" });
  assert.deepEqual(codexModelPreset("quality"), { effort: "high", model: "gpt-5.6-sol" });
});

test("guidance activity exposes the approved intent without leaking skill content", () => {
  const activity = describeToolActivity("open_slidex_skill_read", {
    intent: "redesign",
    mode: "bundle"
  }, { slideIndex: 0 });

  assert.deepEqual(activity.targets, [{ kind: "presentation" }]);
  assert.deepEqual(activity.details, ["Guidance intent · redesign"]);
});

test("aborting a streamed run interrupts the App Server turn and emits one terminal event", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot);
  const controller = new AbortController();
  try {
    const events = [];
    setTimeout(() => controller.abort(), 40);
    for await (const event of server.run(runInput("wait for cancellation"), "00000000-0000-4000-8000-000000000002", controller.signal)) {
      events.push(event);
    }
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.failed");
    assert.equal(terminal?.type === "run.failed" ? terminal.code : undefined, "cancelled");
    assert.equal(events.filter((event) => event.type === "run.completed" || event.type === "run.failed").length, 1);
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("an App Server exit ends the active run instead of leaving the SSE stream open", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot);
  try {
    const events = [];
    for await (const event of server.run(runInput("exit during this run"), "00000000-0000-4000-8000-000000000003")) {
      events.push(event);
    }
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.failed");
    assert.equal(terminal?.type === "run.failed" ? terminal.code : undefined, "app_server_error");
    assert.equal(events.filter((event) => event.type === "run.completed" || event.type === "run.failed").length, 1);
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("a run timeout interrupts the App Server turn and emits one terminal event", { concurrency: false }, async () => {
  const fixture = await createFakeCodex();
  const previousPath = process.env.PATH;
  process.env.PATH = `${fixture.binRoot}${path.delimiter}${previousPath ?? ""}`;
  const server = new CodexAppServer(fixture.projectRoot, { runTimeoutMs: 40 });
  try {
    const events = [];
    for await (const event of server.run(runInput("wait for cancellation"), "00000000-0000-4000-8000-000000000004")) {
      events.push(event);
    }
    const terminal = events.at(-1);
    assert.equal(terminal?.type, "run.failed");
    assert.equal(terminal?.type === "run.failed" ? terminal.code : undefined, "timeout");
    assert.equal(events.filter((event) => event.type === "run.completed" || event.type === "run.failed").length, 1);
  } finally {
    server.close();
    process.env.PATH = previousPath;
    await rm(fixture.root, { force: true, recursive: true });
  }
});

test("tool previews accept project PNGs and reject symlink escapes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-preview-test-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "open-slidex-preview-outside-"));
  try {
    const valid = path.join(root, "preview.png");
    const escaped = path.join(root, "escaped.png");
    await writeFile(valid, "png fixture", "utf8");
    await writeFile(path.join(outside, "private.png"), "private", "utf8");
    await symlink(path.join(outside, "private.png"), escaped);
    assert.equal(await safePreviewPath(root, valid), await realpath(valid));
    assert.equal(await safePreviewPath(root, escaped), undefined);
  } finally {
    await Promise.all([
      rm(root, { force: true, recursive: true }),
      rm(outside, { force: true, recursive: true })
    ]);
  }
});

function runInput(prompt: string): OpenSlideXAiRunInput {
  return {
    expectedRevision: "sha256:fixture",
    prompt,
    provider: "codex",
    slideIndex: 0
  };
}

async function createFakeCodex() {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-app-server-test-"));
  const binRoot = path.join(root, "bin");
  const projectRoot = path.join(root, "deck");
  const initializeLog = path.join(root, "initialize.log");
  await Promise.all([mkdir(binRoot), mkdir(projectRoot)]);
  const executable = path.join(binRoot, process.platform === "win32" ? "codex.cmd" : "codex");
  const tools = Object.fromEntries(openSlideXToolNames.map((name) => [name, { name }]));
  const source = `#!/usr/bin/env node
const readline = require("node:readline");
const fs = require("node:fs");
const tools = ${JSON.stringify(tools)};
const initializeLog = ${JSON.stringify(initializeLog)};
const send = (value) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...value }) + "\\n");
const input = readline.createInterface({ input: process.stdin });
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") { fs.appendFileSync(initializeLog, "initialize\\n"); return send({ id: message.id, result: { codexHome: "/tmp", platformFamily: "unix", platformOs: "test", userAgent: "fixture" } }); }
  if (message.method === "thread/start") return send({ id: message.id, result: { thread: { id: "thread-1" } } });
  if (message.method === "mcpServerStatus/list") return send({ id: message.id, result: { data: [{ name: "open_slidex", tools }], nextCursor: null } });
  if (message.method === "turn/start") {
    send({ id: message.id, result: { turn: { id: "turn-1" } } });
    const prompt = message.params.input[0].text;
    if (prompt.includes("wait for cancellation")) return;
    if (prompt.includes("exit during this run")) return setTimeout(() => process.exit(17), 5);
    if (prompt.includes("quality failure")) return setTimeout(() => {
      send({ method: "item/started", params: { item: { arguments: { commands: [{ slideIndex: 0, type: "slide.replace" }] }, id: "tool-quality", server: "open_slidex", status: "inProgress", tool: "open_slidex_edit", type: "mcpToolCall" }, threadId: "thread-1", turnId: "turn-1" } });
      send({ method: "item/completed", params: { item: { arguments: {}, id: "tool-quality", result: { structuredContent: { code: "quality_gate_failed", qualityReport: { issues: [{ code: "text_overflow", nodeIds: ["hero-title"], severity: "error", slideIndex: 0 }, { code: "text_collision", nodeIds: ["summary"], severity: "error", slideIndex: 1 }], summary: { errorCount: 2 } } } }, server: "open_slidex", status: "failed", tool: "open_slidex_edit", type: "mcpToolCall" }, threadId: "thread-1", turnId: "turn-1" } });
      send({ method: "turn/completed", params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } } });
    }, 5);
    setTimeout(() => {
      send({ method: "item/started", params: { item: { arguments: { includeSource: false }, id: "tool-1", server: "open_slidex", status: "inProgress", tool: "open_slidex_open", type: "mcpToolCall" }, threadId: "thread-1", turnId: "turn-1" } });
      send({ method: "item/completed", params: { item: { arguments: {}, id: "tool-1", result: { structuredContent: { revision: "sha256:next", title: "Fixture" } }, server: "open_slidex", status: "completed", tool: "open_slidex_open", type: "mcpToolCall" }, threadId: "thread-1", turnId: "turn-1" } });
      send({ method: "item/agentMessage/delta", params: { delta: "Deck loaded.", itemId: "message-1", threadId: "thread-1", turnId: "turn-1" } });
      send({ method: "turn/completed", params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } } });
    }, 5);
    return;
  }
  if (message.method === "turn/interrupt") return send({ id: message.id, result: {} });
});
`;
  await writeFile(executable, source, "utf8");
  await chmod(executable, 0o755);
  return { binRoot, initializeLog, projectRoot, root };
}
