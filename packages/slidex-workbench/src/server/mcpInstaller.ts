import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { OpenSlideXMcpClient, OpenSlideXMcpPlatform } from "./mcpConfig";

type InstallInput = {
  client: OpenSlideXMcpClient;
  config: string;
  configKey: "open_slidex" | "open_slidex_workspace";
  /** Test-only override; HTTP callers always use the user's real client path. */
  configPath?: string;
  platform: OpenSlideXMcpPlatform;
};

export type McpInstallResult = {
  action: "added" | "updated";
  configPath: string;
  restartRequired: true;
};

/**
 * Installs only OpenSlideX's own MCP entry. The configuration file is never
 * returned to the browser, so unrelated entries (including credentials) stay
 * private while being preserved verbatim where the client format permits it.
 */
export async function installMcpConfiguration(input: InstallInput): Promise<McpInstallResult> {
  if (input.platform !== hostPlatform()) {
    throw Object.assign(new Error("Install MCP from a Workspace running on the same operating system as the selected target."), { status: 400 });
  }
  if (input.client === "claude-code") {
    throw Object.assign(new Error("Claude Code uses its own command-line installer."), { status: 400 });
  }

  const configPath = input.configPath ?? mcpConfigPath(input.client, input.platform);
  if (input.client === "codex") {
    const current = await readOptionalText(configPath);
    const action = tomlSectionExists(current, input.configKey) ? "updated" : "added";
    await writeConfig(configPath, upsertTomlSection(current, input.configKey, input.config));
    return { action, configPath, restartRequired: true };
  }

  const current = await readOptionalText(configPath);
  const parsed = parseClaudeDesktopConfig(current);
  const mcpServers = isRecord(parsed.mcpServers) ? parsed.mcpServers : {};
  const candidate = JSON.parse(input.config) as { mcpServers?: Record<string, unknown> };
  const server = candidate.mcpServers?.[input.configKey];
  if (!server || !isRecord(server)) throw new Error("Could not prepare the OpenSlideX MCP configuration.");
  const action = Object.hasOwn(mcpServers, input.configKey) ? "updated" : "added";
  await writeConfig(configPath, `${JSON.stringify({ ...parsed, mcpServers: { ...mcpServers, [input.configKey]: server } }, null, 2)}\n`);
  return { action, configPath, restartRequired: true };
}

function hostPlatform(): OpenSlideXMcpPlatform {
  return process.platform === "win32" ? "windows" : "macos";
}

function mcpConfigPath(client: Exclude<OpenSlideXMcpClient, "claude-code">, platform: OpenSlideXMcpPlatform) {
  if (client === "codex") return path.join(os.homedir(), ".codex", "config.toml");
  if (platform === "windows") {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error("Could not locate the Claude Desktop configuration folder.");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
}

async function readOptionalText(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return "";
    throw error;
  }
}

async function writeConfig(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

function tomlSectionExists(source: string, key: string) {
  return new RegExp(`(^|\\n)\\[mcp_servers\\.${escapeRegExp(key)}\\](?=\\n|$)`).test(source);
}

function upsertTomlSection(source: string, key: string, section: string) {
  const expression = new RegExp(`(^|\\n)\\[mcp_servers\\.${escapeRegExp(key)}\\][\\s\\S]*?(?=\\n\\[|$)`);
  const normalizedSection = section.trim();
  const replaced = source.replace(expression, (_match, leading: string) => `${leading}${normalizedSection}`);
  if (replaced !== source) return `${replaced.trimEnd()}\n`;
  const trimmed = source.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}${normalizedSection}\n`;
}

function parseClaudeDesktopConfig(source: string): Record<string, unknown> {
  if (!source.trim()) return {};
  try {
    const parsed = JSON.parse(source) as unknown;
    if (isRecord(parsed)) return parsed;
  } catch {
    // The safe error below gives the user a recoverable next step without overwriting a malformed file.
  }
  throw Object.assign(new Error("Claude Desktop's configuration is not valid JSON, so OpenSlideX did not change it."), { status: 400 });
}

function isMissingFile(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
