# OpenSlideX public-source boundary

This repository must remain independently runnable as a local-first product.

## Allowed

- Filesystem-backed project initialization, editing, rendering, and export
- Local `presentation.mdx`, `assets/`, `knowledge/`, and revision-safe edits
- Optional local CLI integrations such as Codex or Claude Code
- Storage-neutral MotionDoc parsing, serialization, layout, and export code
- Openly licensed starter templates created for this repository

## Prohibited

- `app/` routes and any Next.js Cloud application code
- Supabase, Cloud authentication, Workspace state, Cloud API routes, and Cloud repositories
- Billing, user accounts, remote presentation persistence, collaboration, comments, and background synchronization
- Production secrets, environment files, and server-only credentials
- Full source for private official or Premium templates

## Extraction rules

1. Do not copy a directory wholesale from SlideX Cloud.
2. Move or recreate only the smallest storage-neutral dependency required by a local package.
3. Replace Cloud adapters with local filesystem adapters at the boundary.
4. Add a focused local test before introducing an extracted module.
5. Run `npm run check:open-source-boundary` before every push.

## Public template rule

The repository may include an openly licensed starter template. The official and Premium template catalog remains outside this repository until its source license is explicitly changed.
