import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { blankPresentationMdx } from "@open-slidex/sdk";

import { buildAgentPrompt, OpenSlideXAiBridge, openSlideXAiProviderCommand } from "./aiBridge";
import { redactLocalDetails, StreamingLocalDetailRedactor } from "./codexAppServer";
import { codexAppServerArgs, openSlideXMcpLaunch } from "./codexAppServerTransport";
import { SlideXProject } from "./project";

test("Codex bridge uses App Server stdio instead of one-shot exec", () => {
  const command = openSlideXAiProviderCommand("codex");

  assert.equal(command.command, "codex");
  assert.deepEqual(command.args, ["app-server", "--stdio"]);
});

test("streaming redaction keeps split paths and secrets intact until they are safe", () => {
  const redactor = new StreamingLocalDetailRedactor("/tmp/private-deck");
  const output = [
    redactor.push("Rendered at /Users/example/.co"),
    redactor.push("dex/output.png with token=se"),
    redactor.push("cret"),
    redactor.flush()
  ].join("");

  assert.equal(output, "Rendered at [local path] with token=[redacted]");
});

test("App Server startup is project-scoped and disables non-OpenSlideX tool families", () => {
  const root = "/tmp/OpenSlideX deck";
  const args = codexAppServerArgs(root);
  const joined = args.join(" ");

  assert.equal(args.slice(0, 2).join(" "), "app-server --stdio");
  assert.match(joined, /open_slidex/);
  assert.match(joined, /enabled_tools/);
  assert.match(joined, /default_tools_approval_mode=\"approve\"/);
  assert.match(joined, /node_repl=.*enabled=false/);
  assert.match(joined, /computer-use.*enabled=false/);
  for (const feature of ["apps", "browser_use", "computer_use", "js_repl", "plugins", "shell_tool", "unified_exec"]) {
    assert.ok(args.some((value, index) => value === "--disable" && args[index + 1] === feature));
  }
});

test("bundled Workbench starts its packaged project-scoped MCP without project dependencies", () => {
  const root = "/tmp/OpenSlideX deck";
  const entry = "/opt/open-slidex/runtime/mcp/server.mjs";
  const launch = openSlideXMcpLaunch(root, {
    bundledEntry: entry,
    entryExists: (candidate) => candidate === entry
  });

  assert.equal(launch.command, process.execPath);
  assert.deepEqual(launch.args, [entry, "--project", root]);
  assert.equal(launch.cwd, root);
});

test("source Workbench keeps the package-script MCP fallback", () => {
  const root = "/tmp/OpenSlideX source deck";
  const launch = openSlideXMcpLaunch(root, {
    bundledEntry: "/missing/runtime/mcp/server.mjs",
    entryExists: () => false
  });

  assert.equal(launch.command, process.platform === "win32" ? "cmd" : "npm");
  assert.ok(launch.args.includes("mcp"));
  assert.equal(launch.cwd, root);
});

test("AI event summaries redact the project root and environment-like values", () => {
  assert.equal(
    redactLocalDetails("Saved /tmp/private-deck/dist/montage.png TOKEN=secret", "/tmp/private-deck"),
    "Saved ./dist/montage.png [redacted]"
  );
  assert.equal(
    redactLocalDetails('Failed at /Users/example/.codex/config.toml token="secret"', "/tmp/private-deck"),
    "Failed at [local path] token=[redacted]"
  );
});

test("Claude draft instructions preserve slides outside the frozen selection", () => {
  const prompt = buildAgentPrompt({
    expectedRevision: "sha256:fixture",
    nodeId: "chart-4",
    prompt: "Improve this chart",
    provider: "claude",
    slideIndex: 3
  }, "sha256:fixture");

  assert.match(prompt, /change only slide 4 and node chart-4/i);
  assert.match(prompt, /Preserve every other slide exactly/i);
});

test("Claude remains a reviewable draft and cannot change presentation.mdx before Apply", { concurrency: false }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-claude-draft-"));
  const binRoot = path.join(root, "bin");
  const projectRoot = path.join(root, "deck");
  const previousPath = process.env.PATH;
  await Promise.all([mkdir(binRoot), mkdir(projectRoot)]);
  const executable = path.join(binRoot, process.platform === "win32" ? "claude.cmd" : "claude");
  const source = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("claude fixture 1.0.0"); process.exit(0); }
if (args[0] === "auth" && args[1] === "status") process.exit(0);
process.stdin.resume();
process.stdin.on("end", () => console.log(JSON.stringify({ type: "result", result: "<OPENSLIDEX_MDX>\\n# Claude Draft\\n\\n<Slide><Unknown /></Slide>\\n</OPENSLIDEX_MDX>" })));
`;
  await writeFile(executable, source, "utf8");
  await chmod(executable, 0o755);
  await writeFile(path.join(projectRoot, "presentation.mdx"), blankPresentationMdx, "utf8");
  process.env.PATH = `${binRoot}${path.delimiter}${previousPath ?? ""}`;
  const project = new SlideXProject(projectRoot);
  await project.prepare();
  const bridge = new OpenSlideXAiBridge(project);
  try {
    const before = await project.open();
    const result = await bridge.run({
      expectedRevision: before.revision,
      prompt: "Change this deck",
      provider: "claude",
      slideIndex: 0
    });
    assert.ok(result.draft);
    assert.equal(result.draft.validation.isValid, false);
    assert.equal(await readFile(path.join(projectRoot, "presentation.mdx"), "utf8"), before.source);
    assert.equal((await project.open()).revision, before.revision);
  } finally {
    bridge.close();
    process.env.PATH = previousPath;
    await rm(root, { force: true, recursive: true });
  }
});

test("Claude confirmation applies a valid draft once with revision-safe CAS", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-claude-apply-"));
  const draftId = randomUUID();
  const source = "# Original\n\n<Slide><Title>Before</Title></Slide>\n";
  const draftSource = "# Confirmed draft\n\n<Slide><Title>After</Title></Slide>\n";
  await writeFile(path.join(root, "presentation.mdx"), source, "utf8");
  const project = new SlideXProject(root);
  await project.prepare();
  const bridge = new OpenSlideXAiBridge(project);
  try {
    const before = await project.open();
    const draftRoot = path.join(project.stateRoot, "agent-drafts");
    await mkdir(draftRoot, { recursive: true });
    await writeFile(path.join(draftRoot, `${draftId}.mdx`), draftSource, "utf8");

    assert.equal(await readFile(path.join(root, "presentation.mdx"), "utf8"), source);
    const applied = await bridge.apply(draftId, before.revision);
    assert.match(applied.source, /<Title[^>]*>After<\/Title>/);
    assert.equal(await readFile(path.join(root, "presentation.mdx"), "utf8"), applied.source);
    await assert.rejects(() => bridge.apply(draftId, before.revision), /presentation\.mdx changed/i);
  } finally {
    bridge.close();
    await rm(root, { force: true, recursive: true });
  }
});
