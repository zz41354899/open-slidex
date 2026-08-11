# Connect OpenSlideX to Codex and Claude

This workspace already contains project-scoped MCP configuration for Codex and Claude Code. Open this exact deck folder in the client so the server stays pinned to `presentation.mdx`, `assets/`, `knowledge/`, `.open-slidex/`, and `dist/`.

OpenSlideX never reads your Codex or Claude credentials. Sign in through the provider's own CLI or desktop app.

## Codex CLI and Desktop

The generated `.codex/config.toml` starts the project-local server. Print a configuration containing the current absolute deck path when you need to copy it elsewhere:

```bash
open-slidex mcp --print-config codex
open-slidex mcp --print-setup-prompt codex
```

Verify that `open_slidex` appears in the MCP list, then ask Codex to call `open_slidex_open`.

## Claude Code

The generated `.mcp.json` is project scoped. You can also print the exact local command:

```bash
open-slidex mcp --print-config claude-code
```

On native Windows, OpenSlideX generates a `cmd /c npx` wrapper automatically.

## Claude Desktop

Generate JSON for the current deck:

```bash
open-slidex mcp --print-config claude-desktop
open-slidex mcp --print-setup-prompt claude-desktop
```

Merge the `open_slidex` entry into the existing `mcpServers` object. Preserve every unrelated entry.

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Completely quit and restart Claude Desktop after saving. If the server is missing, confirm that Node.js and npm are available, the deck path is absolute, and the JSON parses.

## Connection smoke test

1. Call `open_slidex_open` and retain its `revision`.
2. Call `open_slidex_edit` with that value as `expectedRevision`.
3. Call `open_slidex_render` and inspect the PNG under `dist/`.
4. Call `open_slidex_quality_check` and resolve its rendered layout findings.

Configuration alone is not proof of connection; all four tool calls must succeed.
