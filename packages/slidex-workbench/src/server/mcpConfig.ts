import path from "node:path";

export const openSlideXMcpNpxPackage = "open-slidex@latest";
export const openSlideXMcpClients = ["codex", "claude-code", "claude-desktop"] as const;
export type OpenSlideXMcpClient = (typeof openSlideXMcpClients)[number];
export type OpenSlideXMcpPlatform = "macos" | "windows";

type McpTarget = {
  configKey: "open_slidex" | "open_slidex_workspace";
  option: "--project" | "--workspace";
};

function clientLabel(client: OpenSlideXMcpClient) {
  return client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop";
}

function platformLabel(platform: OpenSlideXMcpPlatform) {
  return platform === "macos" ? "macOS" : "Windows";
}

function configLocation(client: OpenSlideXMcpClient, platform: OpenSlideXMcpPlatform) {
  if (client === "codex") return platform === "windows" ? "%USERPROFILE%\\.codex\\config.toml" : "~/.codex/config.toml";
  if (client === "claude-desktop") {
    return platform === "windows"
      ? "%APPDATA%\\Claude\\claude_desktop_config.json"
      : "~/Library/Application Support/Claude/claude_desktop_config.json";
  }
  return "Claude Code user scope";
}

function resolveMcpRoot(root: string, platform: OpenSlideXMcpPlatform) {
  return platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? path.win32.resolve(root)
    : path.resolve(root);
}

function presentationPath(root: string, platform: OpenSlideXMcpPlatform) {
  const absoluteRoot = resolveMcpRoot(root, platform);
  return platform === "windows" && /^[A-Za-z]:[\\/]/.test(absoluteRoot)
    ? path.win32.join(absoluteRoot, "presentation.mdx")
    : path.join(absoluteRoot, "presentation.mdx");
}

function mcpConfig(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform, target: McpTarget) {
  const absoluteRoot = resolveMcpRoot(root, platform);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows"
    ? ["/c", "npx", "-y", openSlideXMcpNpxPackage, "mcp", target.option, absoluteRoot]
    : ["-y", openSlideXMcpNpxPackage, "mcp", target.option, absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.${target.configKey}]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({ mcpServers: { [target.configKey]: { args, command, type: "stdio" } } }, null, 2);
  }
  const launch = platform === "windows"
    ? `cmd /c npx -y ${openSlideXMcpNpxPackage} mcp ${target.option} "${absoluteRoot.replaceAll('"', '\\"')}"`
    : `npx -y ${openSlideXMcpNpxPackage} mcp ${target.option} '${absoluteRoot.replaceAll("'", `"'"'`)}'`;
  return `claude mcp add --scope user ${target.configKey.replaceAll("_", "-")} -- ${launch}`;
}

export function presentationMcpConfig(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  return mcpConfig(client, root, platform, { configKey: "open_slidex", option: "--project" });
}

export function workspaceMcpConfig(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  return mcpConfig(client, root, platform, { configKey: "open_slidex_workspace", option: "--workspace" });
}

function clientInstructions(client: OpenSlideXMcpClient, platform: OpenSlideXMcpPlatform, config: string) {
  const platformName = platformLabel(platform);
  if (client === "claude-code") {
    return [
      `On ${platformName}, open ${platform === "windows" ? "PowerShell or Command Prompt" : "Terminal"}.`,
      "Run the generated command exactly once. It creates or updates only the user-scoped OpenSlideX MCP entry; do not manually edit Claude Code's managed configuration.",
      `Generated command:\n${config}`
    ];
  }

  const location = configLocation(client, platform);
  return [
    `On ${platformName}, update this configuration file: ${location}.`,
    `Add or replace only the OpenSlideX MCP entry shown below. Preserve every unrelated entry in ${location}.`,
    `Generated configuration:\n${config}`,
    `Restart ${clientLabel(client)} after saving the file.`
  ];
}

export function presentationMcpPrompt(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const label = clientLabel(client);
  const absoluteRoot = resolveMcpRoot(root, platform);
  const config = presentationMcpConfig(client, root, platform);
  return [
    `Configure one user-level OpenSlideX presentation MCP server for ${label} on ${platformLabel(platform)}.`,
    `Restrict it to this exact deck root: ${absoluteRoot}`,
    `The only editable presentation is: ${presentationPath(absoluteRoot, platform)}`,
    "Replace an older open_slidex_workspace entry only when it targets this same deck; preserve every unrelated MCP entry and show the exact proposed change before writing any global config.",
    "",
    ...clientInstructions(client, platform, config),
    "",
    "After restarting the client, verify open_slidex_read, open_slidex_edit, and open_slidex_review."
  ].join("\n");
}

export function workspaceMcpPrompt(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const label = clientLabel(client);
  const config = workspaceMcpConfig(client, root, platform);
  return [
    `Configure one user-level OpenSlideX Workspace MCP server for ${label} on ${platformLabel(platform)}.`,
    `Restrict it to this exact workspace root: ${resolveMcpRoot(root, platform)}`,
    "Preserve every unrelated MCP entry and show the exact proposed change before writing any global config.",
    "",
    ...clientInstructions(client, platform, config),
    "",
    "After restarting the client, use open_slidex_workspace to list and select one presentation, then verify open_slidex_read and open_slidex_review."
  ].join("\n");
}

export function parseWorkspaceMcpClient(value: string | null): OpenSlideXMcpClient {
  if (value && openSlideXMcpClients.includes(value as OpenSlideXMcpClient)) return value as OpenSlideXMcpClient;
  throw Object.assign(new Error("Choose Codex, Claude Code, or Claude Desktop."), { status: 400 });
}

export function parseWorkspaceMcpPlatform(value: string | null): OpenSlideXMcpPlatform {
  if (value === "macos" || value === "windows") return value;
  throw Object.assign(new Error("Choose macOS or Windows."), { status: 400 });
}
