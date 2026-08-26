# OpenSlideX

OpenSlideX is a local-first, MDX presentation workspace with a visual Workbench,
deterministic HTML/PPTX export, local image optimization, and a project-scoped
MCP server for Codex and Claude Code.

One npm package contains everything: the SDK, Workbench, local MCP runtime, and
project initializer. It does not use Cloud login, Supabase, background sync,
Base64 image storage, or a second canvas document.

## Local Workspace

Open the original SlideX-style Workspace shell for a directory of local decks:

```bash
npx open-slidex@latest workspace ~/Presentations
```

The Workspace can create a blank deck or start a new deck from a bundled public
template. Each card maps to its own child folder with one `presentation.mdx` as
the source of truth. The Workspace never requires an account or Supabase.

Bundled templates: Summer Time Report and Moodboard. Notion and Obsidian
source-specific templates are not part of the local catalog.

## Create a deck

Node.js **22.12.0 or later** is required.

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

Start a new project with an immutable official template blueprint and locale:

```bash
npx open-slidex@latest init my-deck --template summer-time-report --locale zh-TW
```

With `--template`, the selected `{ id, version, locale }` is recorded inside
`open-slidex-workspace/<template-id>/.open-slidex/template-lock.json`. The
template becomes the first Workspace deck and never creates an outer source
file.

`init` creates the Workspace container and installs `open-slidex` as its only development
dependency. Installation does not download Chromium. Local render
and visual export use an existing Chrome or Chromium executable; see
Troubleshooting for the optional managed-browser command.

Use `--no-install` when you want to inspect the generated files before
installing dependencies:

```bash
npx open-slidex@latest init my-deck --no-install
cd my-deck
npm install
```

## What the project contains

```text
my-deck/
├── .agents/skills/        # skills plus on-demand references and examples
├── open-slidex-workspace/ # created on first launch; one folder per deck
│   └── <deck>/presentation.mdx
└── package.json
```

OpenSlideX keeps visible slide content and local `assets/*.webp` inside the
selected deck folder. No image data is sent to Supabase.

## Workbench

Run these from the generated deck folder:

```bash
npm run dev          # open this project's open-slidex-workspace/ library
```

MDX exports are portable: local project images are embedded into the exported
file and restored to `assets/*.webp` when that MDX is imported into a Workspace.
Older MDX files that contain only missing asset paths still import with editable
empty media frames instead of failing the complete presentation.

Workspace import accepts `.mdx` and complete `.html` files up to 50 MB. HTML
bytes are kept unchanged and run in an opaque-origin sandbox. Inline resources
work offline; HTTP(S) libraries, styles, fonts, images, media, frames, workers,
and connections stay browser-native and require network access. Relative
sidecars require a remote `<base href>` or must be inlined. Native MDX may use `SvgBlock`
with local `assets/*.svg`, `sharedScene`, and integer `stage` props for
script-free stage animation that remains mounted across slide changes.
Portable MDX and PowerPoint do not retain `HtmlEmbedBlock` JavaScript;
downloading HTML from an imported HTML deck returns the original file.

`npm run dev` always opens `/workspace`. A fresh install starts with an empty
library; creating or importing a deck adds an isolated child folder and then
opens the Workbench. The Workbench includes slide and layer navigation, a left-side tool rail,
canvas selection, Inspector editing, local asset management,
and animated bar, line, area, pie, donut, and scatter charts. HTML and the
Workbench animate charts; PPTX exports their editable static final state.
The installed CLI keeps its generated HMR source and Vite dependency cache in
the ignored `.open-slidex/` directory. Production build and preview commands
continue to use the optimized client bundle.

## Workspace MCP for Codex and Claude

OpenSlideX has no built-in AI Chat and does not detect or launch local CLI
programs. Workspace Settings generates a user-level MCP configuration with
`--workspace <my-deck/open-slidex-workspace>`. The agent lists and selects one
inner deck before using the presentation tools.

The server is restricted to that deck's `presentation.mdx`, `assets/`,
`knowledge/`, approved `.agents/skills/`, `.open-slidex/`, and `dist/`
directories. Writes require an `expectedRevision`, validate the complete
MotionDoc first, and return a revision conflict instead of overwriting newer
work. Its first read returns only skill metadata; the agent then loads one
approved `SKILL.md`, reference, or knowledge resource at a time. Arbitrary skill
names and filesystem paths are rejected.

For creation or redesign, pass a concise report or summary brief through
`open_slidex_read.templateQuery`. The local server ranks six core thirty-page
MotionDoc references and returns three exact MDX resource paths. The agent
loads exactly one reference and submits the complete result through the normal
revision and rendered-quality gate.

Place source notes or research in the selected deck's `knowledge/` directory.
Markdown, text, CSV, and PDF files are indexed locally. Search returns compact
cited matches; a second read loads one exact source resource with pagination for
long reports.

Optional trusted image search uses the server-side `UNSPLASH_ACCESS_KEY`.
Search returns attribution and candidate IDs without downloading. Import
requires a separate explicit user confirmation naming the candidate ID, then
stores a content-addressed `assets/*.webp` file and provenance under
`.open-slidex/`. Remote URLs never enter `presentation.mdx`.

To print the configuration for an installed Workspace from a terminal:

```bash
cd my-deck
open-slidex mcp --workspace "$PWD/open-slidex-workspace" --print-config codex
open-slidex mcp --workspace "$PWD/open-slidex-workspace" --print-config claude-code
open-slidex mcp --workspace "$PWD/open-slidex-workspace" --print-config claude-desktop
```

Generate a guarded prompt that asks the desktop agent to preserve unrelated MCP entries and show the proposed change before writing global configuration:

```bash
open-slidex mcp --workspace "$HOME/Presentations" --print-setup-prompt codex
open-slidex mcp --workspace "$HOME/Presentations" --print-setup-prompt claude-desktop
```

Codex reads its global MCP configuration from `~/.codex/config.toml`. Claude
Desktop uses `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS and `%APPDATA%\\Claude\\claude_desktop_config.json` on Windows. The
Workspace Settings screen generates `cmd /c npx` on native Windows. Its
explicit install action reads the selected local config, preserves unrelated
entries, and adds or updates only OpenSlideX's entry. Claude Code uses the
displayed user-scope CLI command instead of direct file editing.

## MCP smoke test

After restarting a direct project MCP client:

1. Call `open_slidex_read` and keep the returned source and `revision`.
2. Submit one complete deck or slide to `open_slidex_edit`.
3. For a browser-native HTML deck, call `open_slidex_read` with
   `sourceFormat: "html"`; then call `open_slidex_edit` with `target: "html"`,
   its canonical `htmlSource`, and the latest `expectedRevision`.
4. Use `open_slidex_review` only for read-only checks.

For a multi-deck Workspace MCP, use `open_slidex_workspace` to list and select
a presentation. Workspace scope loads six tools total:

| Tool | Purpose |
| --- | --- |
| `open_slidex_workspace` | List local decks and select the target deck. |
| `open_slidex_read` | Read current MotionDoc, canonical browser-native HTML, guided skill resources or local knowledge, and rank six core native references from `templateQuery`. |
| `open_slidex_source_import` | Inspect local PPTX text and image evidence, preserve geometry and type hints, and import embedded images as WebP. |
| `open_slidex_media` | Search trusted images or import approved local media as WebP. |
| `open_slidex_review` | Run read-only structural and rendered visual QA. |
| `open_slidex_edit` | Apply a revision-safe complete native deck or slide edit with rendered QA, or create/replace canonical browser-native HTML. |

For a PPTX migration, put the source file inside the selected deck,
inspect it with `open_slidex_source_import`, then author native MotionDoc MDX.
`import-media` converts supported embedded images to portable `assets/*.webp`
and returns their original percentage frame for `ImageBlock`; recovered text
frames include native reviewable `Text` blocks plus geometry and type hints.
Generated config uses `open-slidex@latest`, so restarting the client loads the
newest published server without rewriting configuration.

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
restart the client and inspect its MCP list or logs. Installing the npm package
never writes global MCP configuration; Workspace changes it only after the user
chooses the explicit MCP install action.
