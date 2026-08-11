import path from "node:path";

export const openSlideXMcpClients = ["codex", "claude-code", "claude-desktop"] as const;
export type OpenSlideXMcpClient = (typeof openSlideXMcpClients)[number];
export type OpenSlideXMcpPlatform = "macos" | "windows";

export function workbenchMcpConfig(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? path.win32.resolve(root)
    : path.resolve(root);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows"
    ? ["/c", "npx", "-y", "open-slidex", "mcp", "--project", absoluteRoot]
    : ["-y", "open-slidex", "mcp", "--project", absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.open_slidex]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({ mcpServers: { open_slidex: { args, command, type: "stdio" } } }, null, 2);
  }
  const launch = platform === "windows"
    ? `cmd /c npx -y open-slidex mcp --project "${absoluteRoot.replaceAll('"', '\\"')}"`
    : `npx -y open-slidex mcp --project '${absoluteRoot.replaceAll("'", `'"'"'`)}'`;
  return `claude mcp add open-slidex -- ${launch}`;
}

export function workbenchMcpPrompt(client: OpenSlideXMcpClient, root: string, platform: OpenSlideXMcpPlatform) {
  const label = client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop";
  return [
    `Help me configure the OpenSlideX local MCP server for ${label} on ${platform}.`,
    `Restrict it to this exact deck root: ${path.resolve(root)}`,
    "Preserve every unrelated MCP entry and show the proposed change before writing a global config.",
    "Use this generated configuration:",
    "",
    workbenchMcpConfig(client, root, platform),
    "",
    "Then verify open_slidex_open, open_slidex_edit with expectedRevision, open_slidex_render, and open_slidex_quality_check."
  ].join("\n");
}

export function parseWorkbenchMcpClient(value: string | null): OpenSlideXMcpClient {
  if (value && openSlideXMcpClients.includes(value as OpenSlideXMcpClient)) return value as OpenSlideXMcpClient;
  throw Object.assign(new Error("Choose Codex, Claude Code, or Claude Desktop."), { status: 400 });
}

export function parseWorkbenchMcpPlatform(value: string | null): OpenSlideXMcpPlatform {
  if (value === "macos" || value === "windows") return value;
  throw Object.assign(new Error("Choose macOS or Windows."), { status: 400 });
}
