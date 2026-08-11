# OpenSlideX

OpenSlideX is an open-source, local-first presentation workspace. A presentation lives in a folder you own, with `presentation.mdx` as its source of truth.

## Status

This repository is being prepared as the public home for OpenSlideX. The first source migration is intentionally narrow: only code that runs locally, has no Cloud dependency, and passes the repository boundary check will be added here.

The current SlideX Cloud application remains a separate private product. It is not a dependency of OpenSlideX.

## Principles

- Local files are canonical.
- No account is required to create, edit, or export a local presentation.
- No background synchronization or hidden Cloud dependency.
- AI integrations are optional and use the locally installed provider CLI.
- The MotionDoc format stays portable and editable.

## What will live here

- OpenSlideX CLI and project starter
- Local Workbench
- Local MCP server
- Filesystem-safe MotionDoc SDK and export tools
- Starter examples, documentation, and contributor tooling

## What will not live here

- SlideX Cloud routes, accounts, authentication, Supabase clients, or Workspace state
- Cloud API routes, billing, collaboration, comments, or remote presentation storage
- Credentials, production configuration, or secret-bearing environment files
- The private official or Premium template catalog

See [OPEN_SOURCE_BOUNDARY.md](OPEN_SOURCE_BOUNDARY.md) for the enforceable extraction rules.

## License

MIT. See [LICENSE](LICENSE).
