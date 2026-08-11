# OpenSlideX 0.2.4

OpenSlideX is a local-first, MDX presentation workspace with a visual Workbench,
deterministic HTML/PPTX export, local image optimization, and a project-scoped
MCP server for Codex and Claude Code.

One npm package contains everything: the SDK, Workbench, local MCP runtime, and
project initializer. It does not use Cloud login, Supabase, background sync,
Base64 image storage, or a second canvas document.

## Create a deck

Node.js **22.12.0 or later** is required.

```bash
npx open-slidex@0.2.4 init my-deck
cd my-deck
npm run dev
```

Start a new project with an immutable official template blueprint and locale:

```bash
npx open-slidex@0.2.4 init launch-deck --template launch-deck --locale zh-TW
```

The selected `{ id, version, locale }` is recorded in
`.open-slidex/template-lock.json`. The Workbench and AI chat read this
validated blueprint as design guidance; selecting a template never replaces an
existing non-empty presentation.

`init` creates the deck and installs `open-slidex` as its only development
dependency. Installation attempts to download the Chromium runtime used for
local rendering and exports; an offline download never blocks installation.

Alternative launchers:

```bash
pnpm dlx open-slidex@0.2.4 init my-deck
bunx open-slidex@0.2.4 init my-deck
```

Use `--no-install` when you want to inspect the generated files before
installing dependencies:

```bash
npx open-slidex@0.2.4 init my-deck --no-install
cd my-deck
npm install
```

## What the project contains

```text
my-deck/
├── presentation.mdx       # the only persisted presentation source
├── assets/                # optimized, content-addressed WebP images
├── knowledge/             # private Markdown, text, PDF, and CSV references
├── .agents/skills/        # deck authoring and QA skills
├── .codex/config.toml     # Codex project MCP configuration
├── .mcp.json              # Claude Code project MCP configuration
├── MCP.md                 # MCP setup and verification instructions
└── package.json
```

OpenSlideX keeps all visible slide content in `presentation.mdx`. Images are
stored as relative `assets/*.webp` references; no image data is sent to
Supabase or embedded as Base64/data URLs.

## Workbench and export commands

Run these from the generated deck folder:

```bash
npm run dev          # visual Workbench at a local URL
npm run build        # build a static HTML presentation in dist/site/
npm run preview      # preview dist/site/
npm run validate     # validate presentation.mdx
npm run render       # render a montage PNG
npm run export:html  # write dist/presentation.html
npm run export:mdx   # write dist/presentation.mdx
npm run export:pptx  # write dist/presentation.pptx
```

The Workbench includes slide and layer navigation, a left-side tool rail,
canvas selection, Inspector editing, local asset management, Presenter mode,
and animated bar, line, area, pie, donut, and scatter charts. HTML and the
Workbench animate charts; PPTX exports their editable static final state.

## Local AI: Codex, Claude Code, and Desktop MCP

`open-slidex init` automatically creates project-scoped MCP configuration. Open
the deck folder in Codex or Claude Code, then confirm that the `open_slidex`
server is enabled. No path placeholder is required.

The server is restricted to that deck's `presentation.mdx`, `assets/`,
`knowledge/`, approved `.agents/skills/`, `.open-slidex/`, and `dist/`
directories. Writes require an `expectedRevision`, validate the complete
MotionDoc first, and return a revision conflict instead of overwriting newer
work. AI can read only the four bundled skills and the selected official
Template Blueprint; arbitrary skill names and filesystem paths are rejected.

Optional trusted image search uses the server-side `UNSPLASH_ACCESS_KEY`.
Search returns attribution and candidate IDs without downloading. Import
requires a separate explicit user confirmation naming the candidate ID, then
stores a content-addressed `assets/*.webp` file and provenance under
`.open-slidex/`. Remote URLs never enter `presentation.mdx`.

To print configuration containing the real absolute path for the current deck:

```bash
open-slidex mcp --print-config codex
open-slidex mcp --print-config claude-code
open-slidex mcp --print-config claude-desktop
```

Generate a guarded prompt that asks the desktop agent to preserve unrelated MCP entries and show the proposed change before writing global configuration:

```bash
open-slidex mcp --print-setup-prompt codex
open-slidex mcp --print-setup-prompt claude-desktop
```

To pin exactly one deck in Codex's global configuration, run this from that
deck folder:

```bash
codex mcp add open-slidex -- npx -y open-slidex mcp --project "$PWD"
```

Do not use a global entry to manage multiple decks: it is intentionally pinned
to one real path. For multiple decks, use the project configuration created by
`init`.

Claude Desktop configuration lives at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\\Claude\\claude_desktop_config.json` on Windows. Completely quit and restart Claude Desktop after saving. OpenSlideX generates `cmd /c npx` on native Windows and never edits either global configuration automatically.

The Workbench includes an assistant-ui chat drawer backed by the locally installed Codex or Claude Code CLI. Codex runs through its local App Server, automatically connects only the current project's OpenSlideX MCP, and streams real tool progress while revision-safe edits refresh the Canvas. Claude Code keeps the review-first flow: its AI changes remain drafts until validation passes and you explicitly apply them. Provider authentication stays in the provider's own CLI.

## MCP smoke test

After opening the deck in your MCP client:

1. Call `open_slidex_open` and keep the returned `revision`.
2. Call `open_slidex_edit` with that revision as `expectedRevision`.
3. Call `open_slidex_render` and inspect the generated PNG in `dist/`.
4. Call `open_slidex_quality_check` and resolve its slide/node findings.

## Troubleshooting

OpenSlideX MCP does not download or require Playwright. `render` and visual
PPTX export need a local Chrome or Chromium executable. Set its path when it
is not automatically found:

```bash
export OPEN_SLIDEX_CHROMIUM_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Alternatively, install a Playwright-managed Chromium only when you need it:

```bash
npx -y playwright@1.61.1 install chromium
```

If an MCP server is not shown after project configuration changes, restart the
client from the deck folder and inspect the client MCP list or logs. The CLI
itself never writes a global MCP configuration during `npm install`.
