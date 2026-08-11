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

This opens the bundled neutral starter at `examples/starter/presentation.mdx`. No account, Cloud setup, or second `npm install` is required.

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

This private staging repository includes a cloneable local runtime and starter project. TypeScript source extraction is intentionally narrow: only code that runs locally, has no Cloud dependency, and passes the repository boundary check will be added here.

The current SlideX Cloud application remains a separate private product. It is not a dependency of OpenSlideX.

## Principles

- Local files are canonical.
- No account is required to create, edit, or export a local presentation.
- No background synchronization or hidden Cloud dependency.
- AI integrations are optional and use the locally installed provider CLI.
- The MotionDoc format stays portable and editable.

## What will live here

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

## License

MIT. See [LICENSE](LICENSE).
