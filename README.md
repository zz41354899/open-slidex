# OpenSlideX

OpenSlideX is an open-source, local-first workspace for editable presentations.
Every presentation lives in a folder you own, and its `presentation.mdx` file is
the source of truth.

Create, edit, preview, and export decks without an account, background sync, or
hidden cloud dependency. The MotionDoc format stays portable, readable, and
editable in your own tools and Git workflow.

## Install without Node.js or Git

The standalone installer downloads the complete OpenSlideX runtime, including
its private Node.js executable and Chromium renderer. It does not install npm,
Git, or system-wide Node.js and does not require administrator access.

macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/zz41354899/open-slidex/main/install.ps1 | iex
```

Open a new terminal after the first install, then run:

```bash
slidex             # open the local Workspace
slidex update      # verify and install the newest release
slidex uninstall   # remove the runtime and command, but keep presentations
```

The default presentation library is `~/Documents/OpenSlideX Workspace` on
macOS and the current user's Documents folder on Windows. Every downloaded
release archive is verified against the release's SHA-256 checksum before it
can replace the active version.

## Developer quick start

OpenSlideX requires Node.js 22.12 or newer.

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

This starts the local Workspace. By default, new blank and template-based decks
are created in the ignored `open-slidex-workspace/` directory. Each deck has its
own `presentation.mdx` file. No account or Supabase project is required.

The bundled catalog includes **Summer Time Report** and **Moodboard**. Notion-
and Obsidian-specific templates are intentionally excluded.

### Use a different Workspace folder or port

```bash
npm run dev -- ~/Presentations --port 4174
```

## Create a standalone deck with npm

The npm package creates a separate presentation project:

```bash
npx open-slidex@latest init my-deck
cd my-deck
npm run dev
```

Or install the CLI globally:

```bash
npm install --global open-slidex@latest
open-slidex init my-deck
```

`npm run dev` in an installed project always opens `/workspace`, rooted at the
project's own ignored `open-slidex-workspace/` directory. A fresh install has
an empty library; creating or importing a deck adds its own child folder there.
Generated Workbench source and dependency cache stay in the ignored
`.open-slidex/` directory. Each Workspace deck owns its own source, assets,
and exports.

The starter includes five project-local Agent Skills: PPTX source import,
MDX authoring, narrative design, motion direction, and visual QA. Detailed
guidance and verified native-layer examples live inside each skill's
`references/` directory. Narrative design includes eight curated presentation
style specimens plus five narrative examples, all using a disciplined,
image-led company-profile design language. Agents rank the styles from a report
or summary and load only the selected MDX resource.

## What you can do locally

- Start a blank deck or an official template.
- Edit a native MotionDoc MDX presentation in the local Workbench.
- Preview changes through Vite HMR.
- Validate, render, and export local files.
- Configure optional, workspace-scoped MCP access for supported agent clients.

Workspace Settings can generate a user-level MCP configuration for Codex,
Claude Code, or Claude Desktop. An installed starter pins MCP to its internal
`open-slidex-workspace/` directory, so the agent first selects a deck. It does
not probe or launch those applications. The Workbench has no built-in AI Chat
or CLI bridge.

Generated MCP configuration uses `open-slidex@latest`, so a client restart
loads the newest published server without editing the config. Workspace scope
exposes seven workflow tools: workspace selection, progressive source/resource
read, browser-native HTML, PPTX source import, media, review, and edit.
`open_slidex_html` preserves canonical HTML bytes and reports online
dependencies while HTTP(S) libraries, styles, fonts, images, media, frames,
workers, and connections run in an opaque-origin sandbox. Source import inspects PPTX
text geometry, typography hints, reading order, and embedded images safely;
`import-media` converts supported images to portable WebP and returns the
original frame geometry for native `ImageBlock` layers. Narrative and visual
direction stay in the project skills; MCP remains
the revision-safe file and validation boundary. User notes and research stay
local under each deck's `knowledge/`; Markdown, text, CSV, and PDF sources are
searched first and read one resource at a time.

For creation or redesign, `open_slidex_read` accepts a `styleQuery` containing
the source brief, audience, outcome, tone, and brand constraints. It ranks the
eight curated native style directions and returns three exact MDX resource paths; the
agent reads one specimen before composing the complete deck.

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Open the local Workspace. |
| `npm run mcp` | Start MCP for `open-slidex-workspace/`. |
| `npm run build:runtime` | Rebuild the distributable runtime after SDK, Workbench, MCP, or CLI changes. |
| `npm run build:standalone` | Build the current platform's complete Node/Chromium standalone archive. |
| `npm run test:standalone` | Verify installer targets plus isolated install, update, launch, and uninstall behavior. |
| `npm run styles:compile -- <style-prompt references>` | Read all 30 source style profiles, retain the eight curated directions, and sync their catalog and examples. |
| `npm run styles:redesign` | Rebuild eight curated style specimens and five redesigned narrative examples with verified Unsplash imagery. |
| `npm run styles:qa` | Render all 156 teaching slides and reject overflow, collision, canvas, or safety-margin defects. |
| `npm run styles:gallery -- <output>` | Render a 13-cover contact sheet plus a complete twelve-slide screenshot for every example. |
| `npm run test:source` | Run source-level SDK, Workbench, MCP, CLI, and Workspace tests. |

## Architecture

```text
common/                         # Small storage-neutral UI utilities
core/motion-doc/                # Parser, serializer, local edits, layout, export
features/pitch/                 # Storage-neutral editor UI for the Workbench
packages/editor-ui/             # Public editor entry point
packages/slidex-sdk/            # Filesystem-safe SDK and CLI
packages/slidex-workbench/      # Local Workspace and editor
packages/open-slidex-mcp/       # Workspace-scoped local MCP server
packages/open-slidex/           # npm initializer and bundled runtime
install.sh / install.ps1        # no-Node terminal bootstrap installers
scripts/build-standalone-release.mjs # platform archive builder
```

Every runtime under `packages/open-slidex/runtime/` is rebuilt from source in
this repository. `npm run build:runtime` does not read from the SlideX Cloud
codebase.

## Project boundary

OpenSlideX is independent from the private SlideX Cloud product. This
repository includes the local editor, Workbench, MCP runtime, filesystem-safe
SDK, CLI, starter project, examples, and contributor tooling.

It does not include:

- SlideX Cloud routes, accounts, authentication, Supabase clients, or Workspace state.
- Cloud APIs, billing, collaboration, comments, or remote presentation storage.
- Credentials, production configuration, or secret-bearing environment files.
- Cloud-only Premium templates or Notion- and Obsidian-specific templates.

## License

MIT. See [LICENSE](LICENSE).
