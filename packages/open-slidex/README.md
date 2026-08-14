# OpenSlideX 0.3.1

OpenSlideX is a local-first, MDX presentation workspace with a visual Workbench,
deterministic HTML/PPTX export, local image optimization, and a project-scoped
MCP server for Codex and Claude Code.

One npm package contains everything: the SDK, Workbench, local MCP runtime, and
project initializer. It does not use Cloud login, Supabase, background sync,
Base64 image storage, or a second canvas document.

## Local Workspace

Open the original SlideX-style Workspace shell for a directory of local decks:

```bash
npx open-slidex@0.3.1 workspace ~/Presentations
```

The Workspace can create a blank deck or start a new deck from a bundled public
template. Each card maps to its own child folder with one `presentation.mdx` as
the source of truth. The Workspace never requires an account or Supabase.

Bundled templates: Summer Time Report and Moodboard. Notion and Obsidian
source-specific templates are not part of the local catalog.

## Create a deck

Node.js **22.12.0 or later** is required.

```bash
npx open-slidex@0.3.1 init my-deck
cd my-deck
npm run dev
```

Start a new project with an immutable official template blueprint and locale:

```bash
npx open-slidex@0.3.1 init my-deck --template summer-time-report --locale zh-TW
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
pnpm dlx open-slidex@0.3.1 init my-deck
bunx open-slidex@0.3.1 init my-deck
```

Use `--no-install` when you want to inspect the generated files before
installing dependencies:

```bash
npx open-slidex@0.3.1 init my-deck --no-install
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
└── package.json
```

OpenSlideX keeps all visible slide content in `presentation.mdx`. Images are
stored as relative `assets/*.webp` references; no image data is sent to
Supabase or embedded as Base64/data URLs.

## Workbench and export commands

Run these from the generated deck folder:

```bash
npm run dev          # open the parent-folder Workspace and choose this deck
npm run build        # build a static HTML presentation in dist/site/
npm run preview      # preview dist/site/
npm run validate     # validate presentation.mdx
npm run render       # render a montage PNG
npm run export:html  # write dist/presentation.html
npm run export:mdx   # write dist/presentation.mdx
npm run export:pptx  # write dist/presentation.pptx
```

`npm run dev` always opens `/workspace`; selecting the generated deck enters
the Workbench. The Workbench includes slide and layer navigation, a left-side tool rail,
canvas selection, Inspector editing, local asset management, Presenter mode,
and animated bar, line, area, pie, donut, and scatter charts. HTML and the
Workbench animate charts; PPTX exports their editable static final state.
The installed CLI keeps its generated HMR source and Vite dependency cache in
the ignored `.open-slidex/` directory. Production build and preview commands
continue to use the optimized client bundle.

## Workspace MCP for Codex and Claude

OpenSlideX has no built-in AI Chat and does not detect or launch local CLI
programs. Open Workspace Settings to generate one user-level MCP configuration
for Codex, Claude Code, or Claude Desktop. The configuration pins one workspace
root; agents call `open_slidex_workspace_list`, select a presentation, and then
work directly with its `presentation.mdx`.

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

To print the same workspace-global configuration from a terminal:

```bash
open-slidex mcp --workspace "$HOME/Presentations" --print-config codex
open-slidex mcp --workspace "$HOME/Presentations" --print-config claude-code
open-slidex mcp --workspace "$HOME/Presentations" --print-config claude-desktop
```

Generate a guarded prompt that asks the desktop agent to preserve unrelated MCP entries and show the proposed change before writing global configuration:

```bash
open-slidex mcp --workspace "$HOME/Presentations" --print-setup-prompt codex
open-slidex mcp --workspace "$HOME/Presentations" --print-setup-prompt claude-desktop
```

Codex reads its global MCP configuration from `~/.codex/config.toml`. Claude
Desktop uses `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS and `%APPDATA%\\Claude\\claude_desktop_config.json` on Windows. The
Workspace Settings screen generates `cmd /c npx` on native Windows and never
reads, merges, or writes those files automatically.

## MCP smoke test

After restarting your MCP client:

1. Call `open_slidex_workspace_list`.
2. Call `open_slidex_workspace_select` with one returned presentation ID.
3. Call `open_slidex_open` and keep the returned `revision`.
4. Call `open_slidex_edit`, render, and quality-check as usual.

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

If the MCP server is not shown after changing global configuration, completely
restart the client and inspect its MCP list or logs. OpenSlideX never writes a
global MCP configuration during installation or Workspace use.
