---
name: slidex-react-authoring
description: Create, rewrite, or repair canonical OpenSlideX React presentations. Use for presentation.tsx, deck-local components, native layer authoring, TSX migration, or revision-safe MCP edits.
---

# OpenSlideX React Authoring

Treat the selected deck's `presentation.tsx` as its only editable presentation source. Legacy `presentation.mdx` is import input or a read-only migration backup, never a second source of truth.

## Load only what the task needs

- Before emitting TSX, read [the React presentation contract](references/react-presentation-contract.md).
- For images, video, SVG scenes, charts, tables, or imported data, also read [media and data](references/media-and-data.md).
- For a full creation or redesign, activate `slidex-deck-design` before writing.

## Non-negotiable rules

- Import presentation primitives only from `@open-slidex/sdk/react`.
- Use `definePresentation()` with one `Deck` root and native `Slide`, `Text`, `Image`, `Video`, `Svg`, `Chart`, `Table`, `Shape`, or controlled `HtmlEmbed` elements.
- Give every visible native layer a stable unique `id` and literal percentage `x`, `y`, `w`, and `h`; use points for `fontSize`.
- Extract repeated structure into relative `components/*.tsx` files. Register editable/exportable custom components with `defineSlideXComponent()`, a runtime props schema, asset references, and `toMotionDoc()`.
- Treat conditions, loops, hooks, computed variables, spreads, and other dynamic expressions as code-only. Do not promise Inspector round-trip for them.
- Use only React, `@open-slidex/sdk/react`, and relative deck imports. Never use Node APIs, external npm imports, cross-deck paths, network calls, handlers, arbitrary HTML, Base64, blob URLs, or absolute asset paths.
- Never author removed `Card`, `Metric`, `Stack`, `Group`, `Title`, `Icon`, or `Notes` components.

## Edit transaction

1. In Workspace scope, list and explicitly select the intended deck.
2. Call `open_slidex_read` with `sourceFormat: "tsx"` for the latest revision and complete deck, target slide, or local component.
3. Read only the guidance resources required for the task.
4. Preserve stable IDs and unrelated imports, slides, components, and assets.
5. Submit one complete `presentation.tsx` or one complete `Slide` JSX block to `open_slidex_edit` with the latest `expectedRevision`.
6. Repair rejected candidates from their compile, validation, asset, or rendered-QA findings. Never retry a stale revision.
7. Treat an accepted edit's validation, visual report, and preview as the result.

MDX export is a portability operation. A custom component without `toMotionDoc()` must block MDX and editable PPTX export; never flatten it silently to an image or HTML.
