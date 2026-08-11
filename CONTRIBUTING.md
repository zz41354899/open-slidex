# Contributing to OpenSlideX

OpenSlideX accepts changes to the local, filesystem-backed presentation product. Keep each pull request narrow and preserve `presentation.mdx` as the only persisted presentation source.

## Set up

```bash
git clone https://github.com/zz41354899/open-slidex.git
cd open-slidex
npm install
npm run dev
```

## Product boundary

- Local SDK and rendering code belongs in `packages/slidex-sdk/` and storage-neutral `core/motion-doc/` modules.
- Workbench and local AI chat belong in `packages/slidex-workbench/`.
- Project-scoped MCP tools belong in `packages/open-slidex-mcp/`.
- Do not add SlideX Cloud routes, authentication, Supabase, Workspace persistence, billing, collaboration, secrets, or private template source.
- Do not introduce background synchronization or a second persisted canvas document.

## Before a pull request

```bash
npm run build:runtime
npm run check:open-source-boundary
npm run test:source
```

Rendering tests need Chrome or Chromium. If auto-detection fails, set `OPEN_SLIDEX_CHROMIUM_EXECUTABLE` to the browser executable.

Describe the user-visible behavior, the ownership boundary you preserved, and the validation you ran. Do not include generated credentials, local environment files, or unrelated changes.
