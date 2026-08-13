# OpenSlideX

OpenSlideX is an open-source, local-first presentation workspace. A presentation lives in a folder you own, with `presentation.mdx` as its source of truth.

## Start from GitHub

Prerequisite: Node.js 22.12 or newer.

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

This opens the local Workspace first. New blank or template-based decks are
created under the ignored `open-slidex-workspace/` directory by default, with
one `presentation.mdx` per deck and no account or Supabase dependency.

The bundled local catalog includes Summer Time Report and Moodboard. Notion and
Obsidian source-specific templates are intentionally excluded.

To open the neutral `presentation.mdx` at the repository root directly:

```bash
npm run dev:workbench
```

The Workbench uses Vite HMR. Its local Node server keeps filesystem and export
APIs behind the same browser origin. It has no built-in AI Chat or CLI bridge.
Workspace Settings generates one user-level MCP configuration for Codex,
Claude Code, or Claude Desktop without probing or launching those clients.

## Install from npm

After it is published, [open-slidex@0.3.0 on npm](https://www.npmjs.com/package/open-slidex/v/0.3.0) creates a separate deck folder:

```bash
npx open-slidex@0.3.0 init my-deck
cd my-deck
npm run dev
```

The installed CLI uses the same Vite HMR development path. Its generated
Workbench source and dependency cache stay under the ignored `.open-slidex/`
directory; `open-slidex build` and `open-slidex preview` continue to use the
production bundle.

To install the command globally instead:

```bash
npm install --global open-slidex@0.3.0
open-slidex init my-deck
```

## Run from GitHub

Pass an optional Workspace directory or port to the root launcher when needed:

```bash
npm run dev -- ~/Presentations --port 4174
```

## Status

This repository is currently a private staging repository for the public release. It now contains the maintainable TypeScript source for the local SDK, Workbench, workspace MCP server, CLI, and starter project. Every bundled runtime under `packages/open-slidex/runtime/` is rebuilt from source in this repository.

The current SlideX Cloud application remains a separate private product. It is not a dependency of OpenSlideX.

## Source layout

```text
common/                         # small storage-neutral UI utilities
core/motion-doc/                # parser, serializer, local edits, layout, export
features/pitch/                 # storage-neutral editor UI used by Workbench
packages/editor-ui/             # public editor entry point
packages/slidex-sdk/            # filesystem-safe SDK and CLI
packages/slidex-workbench/      # local Workspace and editor
packages/open-slidex-mcp/       # workspace-scoped local MCP server
packages/open-slidex/           # npm initializer and bundled runtime
```

Use `npm run build:runtime` after changing the SDK, Workbench, MCP, or CLI. The command rebuilds the distributable package without reading the SlideX Cloud repository.

## Principles

- Local files are canonical.
- No account is required to create, edit, or export a local presentation.
- No background synchronization or hidden Cloud dependency.
- Agent integration is optional and uses the user-configured Workspace MCP.
- The MotionDoc format stays portable and editable.

## What lives here

- OpenSlideX CLI and project starter
- Local Workbench runtime
- Local MCP runtime
- Filesystem-safe SDK and export runtime
- Starter examples, documentation, and contributor tooling

## What will not live here

- SlideX Cloud routes, accounts, authentication, Supabase clients, or Workspace state
- Cloud API routes, billing, collaboration, comments, or remote presentation storage
- Credentials, production configuration, or secret-bearing environment files
- Cloud-only Premium templates and source-specific Notion or Obsidian templates

See [OPEN_SOURCE_BOUNDARY.md](OPEN_SOURCE_BOUNDARY.md) for the extraction rules and public-release gate.

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing source or opening a pull request.

## License

MIT. See [LICENSE](LICENSE).
