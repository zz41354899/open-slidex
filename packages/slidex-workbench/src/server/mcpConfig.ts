import path from "node:path";

export const openSlideXMcpClients = ["codex", "claude-code", "claude-desktop"] as const;
export type OpenSlideXMcpClient = (typeof openSlideXMcpClients)[number];
export type OpenSlideXMcpPlatform = "macos" | "windows";

export function workspaceMcpConfig(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? path.win32.resolve(root)
    : path.resolve(root);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows"
    ? ["/c", "npx", "-y", "open-slidex", "mcp", "--workspace", absoluteRoot]
    : ["-y", "open-slidex", "mcp", "--workspace", absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.open_slidex_workspace]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({ mcpServers: { open_slidex_workspace: { args, command, type: "stdio" } } }, null, 2);
  }
  const launch = platform === "windows"
    ? `cmd /c npx -y open-slidex mcp --workspace "${absoluteRoot.replaceAll('"', '\\"')}"`
    : `npx -y open-slidex mcp --workspace '${absoluteRoot.replaceAll("'", `'"'"'`)}'`;
  return `claude mcp add --scope user open-slidex-workspace -- ${launch}`;
}

export function workspaceMcpPrompt(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const label = client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop";
  return [
    `Configure one user-level OpenSlideX Workspace MCP server for ${label} on ${platform}.`,
    `Restrict it to this exact workspace root: ${path.resolve(root)}`,
    "Preserve every unrelated MCP entry and show the exact proposed change before writing any global config.",
    "Use this generated configuration:",
    "",
    workspaceMcpConfig(client, root, platform),
    "",
    "After restarting the client, call open_slidex_workspace_list, select one presentation, then verify open_slidex_open and open_slidex_validate."
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
