import path from "node:path";

export const openSlideXMcpNpxPackage = "open-slidex@latest";

export const openSlideXMcpConfigClients = [
  "codex",
  "claude-code",
  "claude-desktop"
] as const;

export type OpenSlideXMcpConfigClient =
  | (typeof openSlideXMcpConfigClients)[number]
  | "claude";
export type OpenSlideXMcpConfigPlatform = "macos" | "windows";
export type OpenSlideXMcpConfigScope = "project" | "workspace";

export function createOpenSlideXMcpConfig(input: {
  client: OpenSlideXMcpConfigClient;
  platform: OpenSlideXMcpConfigPlatform;
  root: string;
  scope: OpenSlideXMcpConfigScope;
}) {
  const absoluteRoot = resolveOpenSlideXMcpRoot(input.root, input.platform);
  const workspace = input.scope === "workspace";
  const configKey = workspace ? "open_slidex_workspace" : "open_slidex";
  const option = workspace ? "--workspace" : "--project";
  const command = input.platform === "windows" ? "cmd" : "npx";
  const args = input.platform === "windows"
    ? ["/c", "npx", "-y", openSlideXMcpNpxPackage, "mcp", option, absoluteRoot]
    : ["-y", openSlideXMcpNpxPackage, "mcp", option, absoluteRoot];

  if (input.client === "codex") {
    return `[mcp_servers.${configKey}]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (input.client === "claude-desktop") {
    return JSON.stringify({
      mcpServers: {
        [configKey]: { args, command, type: "stdio" }
      }
    }, null, 2);
  }

  const launch = input.platform === "windows"
    ? `cmd /c npx -y ${openSlideXMcpNpxPackage} mcp ${option} ${windowsQuote(absoluteRoot)}`
    : `npx -y ${openSlideXMcpNpxPackage} mcp ${option} ${shellQuote(absoluteRoot)}`;
  return `claude mcp add --scope user ${configKey.replaceAll("_", "-")} -- ${launch}`;
}

export function resolveOpenSlideXMcpRoot(root: string, platform: OpenSlideXMcpConfigPlatform) {
  return platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? path.win32.resolve(root)
    : path.resolve(root);
}

export function openSlideXMcpPresentationPath(root: string, platform: OpenSlideXMcpConfigPlatform) {
  const absoluteRoot = resolveOpenSlideXMcpRoot(root, platform);
  return platform === "windows" && /^[A-Za-z]:[\\/]/.test(absoluteRoot)
    ? path.win32.join(absoluteRoot, "presentation.mdx")
    : path.join(absoluteRoot, "presentation.mdx");
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function windowsQuote(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}
