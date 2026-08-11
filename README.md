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

This opens the neutral `presentation.mdx` at the repository root. No account, Cloud setup, nested example folder, or second `npm install` is required.

The same root is also the project-scoped MCP deck. Open it in Codex or Claude Code; `.codex/config.toml` and `.mcp.json` run `npm run mcp` locally.

## Install from npm

After it is published, [open-slidex@0.2.4 on npm](https://www.npmjs.com/package/open-slidex/v/0.2.4) creates a separate deck folder:

```bash
npx open-slidex@0.2.4 init my-deck
cd my-deck
npm run dev
```

To install the command globally instead:

```bash
npm install --global open-slidex@0.2.4
open-slidex init my-deck
```

## Run from GitHub

Pass an optional port to the root launcher when needed:

```bash
npm run dev -- --port 4174
```

## Status

This repository is currently a private staging repository for the public release. It now contains the maintainable TypeScript source for the local SDK, Workbench, AI chat, MCP server, CLI, and starter project. Every bundled runtime under `packages/open-slidex/runtime/` is rebuilt from source in this repository.

The current SlideX Cloud application remains a separate private product. It is not a dependency of OpenSlideX.

## Source layout

```text
common/                         # small storage-neutral UI utilities
core/motion-doc/                # parser, serializer, local edits, layout, export
features/pitch/                 # storage-neutral editor UI used by Workbench
packages/editor-ui/             # public editor entry point
packages/slidex-sdk/            # filesystem-safe SDK and CLI
packages/slidex-workbench/      # local Workbench and AI chat
packages/open-slidex-mcp/       # project-scoped local MCP server
packages/open-slidex/           # npm initializer and bundled runtime
```

Use `npm run build:runtime` after changing the SDK, Workbench, AI chat, MCP, or CLI. The command rebuilds the distributable package without reading the SlideX Cloud repository.

## Principles

- Local files are canonical.
- No account is required to create, edit, or export a local presentation.
- No background synchronization or hidden Cloud dependency.
- AI integrations are optional and use the locally installed provider CLI.
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
- The private official or Premium template catalog before this repository becomes public

See [OPEN_SOURCE_BOUNDARY.md](OPEN_SOURCE_BOUNDARY.md) for the extraction rules and public-release gate.

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing source or opening a pull request.

## License

MIT. See [LICENSE](LICENSE).
