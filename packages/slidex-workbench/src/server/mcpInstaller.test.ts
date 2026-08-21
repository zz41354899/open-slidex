import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { workspaceMcpConfig } from "./mcpConfig";
import { installMcpConfiguration } from "./mcpInstaller";

const hostPlatform = process.platform === "win32" ? "windows" : "macos";
const workspaceRoot = process.platform === "win32" ? "C:\\OpenSlideX\\workspace" : "/tmp/open-slidex-workspace";

test("Codex installation replaces only OpenSlideX's MCP entry", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-mcp-install-"));
  const configPath = path.join(root, "config.toml");
  context.after(() => rm(root, { force: true, recursive: true }));
  await writeFile(configPath, '[mcp_servers.other]\ncommand = "keep"\n\n[mcp_servers.open_slidex_workspace]\ncommand = "old"\nargs = ["old"]\n', "utf8");

  const result = await installMcpConfiguration({
    client: "codex",
    config: workspaceMcpConfig("codex", workspaceRoot, hostPlatform),
    configKey: "open_slidex_workspace",
    configPath,
    platform: hostPlatform
  });

  const written = await readFile(configPath, "utf8");
  assert.equal(result.action, "updated");
  assert.match(written, /\[mcp_servers\.other\]\ncommand = "keep"/);
  assert.match(written, /\[mcp_servers\.open_slidex_workspace\]/);
  assert.match(written, /open-slidex@latest/);
  assert.doesNotMatch(written, /command = "old"/);
});

test("Claude Desktop installation preserves unrelated servers", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-mcp-install-"));
  const configPath = path.join(root, "claude_desktop_config.json");
  context.after(() => rm(root, { force: true, recursive: true }));
  await writeFile(configPath, JSON.stringify({ mcpServers: { other: { command: "keep" } }, theme: "dark" }), "utf8");

  const result = await installMcpConfiguration({
    client: "claude-desktop",
    config: workspaceMcpConfig("claude-desktop", workspaceRoot, hostPlatform),
    configKey: "open_slidex_workspace",
    configPath,
    platform: hostPlatform
  });

  const written = JSON.parse(await readFile(configPath, "utf8")) as { mcpServers: Record<string, { command: string }>; theme: string };
  assert.equal(result.action, "added");
  assert.equal(written.theme, "dark");
  assert.equal(written.mcpServers.other.command, "keep");
  assert.equal(written.mcpServers.open_slidex_workspace.command, hostPlatform === "windows" ? "cmd" : "npx");
});
