# OpenSlideX

OpenSlideX is an open-source, local-first workspace for editable presentations.
Every presentation lives in a folder you own, and its `presentation.mdx` file is
the source of truth.

Create, edit, preview, and export decks without an account, background sync, or
hidden cloud dependency. The MotionDoc format stays portable, readable, and
editable in your own tools and Git workflow.

## Quick start

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
npx open-slidex@0.3.2 init my-deck
cd my-deck
npm run dev
```

Or install the CLI globally:

```bash
npm install --global open-slidex@0.3.2
open-slidex init my-deck
```

`npm run dev` in an installed project always opens `/workspace`, rooted at the
project's parent folder, where the new deck is already listed. Selecting that
deck opens its editor. Generated Workbench source and dependency cache stay in
the ignored `.open-slidex/` directory. Production commands continue to use the
bundled runtime:

```bash
open-slidex build
open-slidex preview
```

## What you can do locally

- Start a blank deck or an official template.
- Edit a native MotionDoc MDX presentation in the local Workbench.
- Preview changes through Vite HMR.
- Validate, render, and export local files.
- Configure optional, workspace-scoped MCP access for supported agent clients.

Workspace Settings can generate a user-level MCP configuration for Codex,
Claude Code, or Claude Desktop. When launched from a deck folder, it pins MCP to
that exact folder's `presentation.mdx`; a general Workspace retains the
multi-deck selection flow. It does not probe or launch those applications. The
Workbench has no built-in AI Chat or CLI bridge.

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Open the local Workspace. |
| `npm run validate` | Validate the root presentation source. |
| `npm run render` | Render the root presentation montage to `dist/montage.png`. |
| `npm run export:html` | Export the root deck as HTML. |
| `npm run export:pptx` | Export the root deck as PowerPoint. |
| `npm run build:runtime` | Rebuild the distributable runtime after SDK, Workbench, MCP, or CLI changes. |

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
