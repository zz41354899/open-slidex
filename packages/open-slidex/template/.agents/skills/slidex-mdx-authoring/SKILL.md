---
name: slidex-mdx-authoring
description: Create, rewrite, or repair editable OpenSlideX MotionDoc MDX. Use for any presentation.mdx change, native layer authoring, media or data placement, structural repair, or revision-safe MCP edit.
---

# OpenSlideX MDX Authoring

Keep the selected inner deck's `presentation.mdx` as the only presentation
source. Read the complete deck for whole-deck work or the complete target slide
for a focused edit.

## Load only what the task needs

- Before emitting MDX, read [the MotionDoc contract](references/motiondoc-contract.md).
- For images, video, charts, tables, or imported data, also read
  [media and data](references/media-and-data.md).
- For a full creation or redesign, activate `slidex-deck-design` before writing.

## Non-negotiable rules

- Author only `Text`, `ImageBlock`, `VideoBlock`, `Chart`, `Table`, and `Shape`.
- Never emit `Card`, `Metric`, `Stack`, `Group`, `Title`, `Icon`, or `Notes`.
- Never add imports, exports, scripts, handlers, raw HTML, visible Markdown,
  arbitrary JSX, or executable JavaScript.
- Give every visible layer a stable unique `id` and explicit percentage
  `x`, `y`, `w`, and `h`. Use points for `fontSize`.
- Keep media portable: use relative `assets/...` paths or verified HTTPS media.
  Never persist Base64, blob URLs, invented URLs, or absolute local paths.

## Edit transaction

1. In Workspace scope, list and explicitly select the intended deck.
2. Call `open_slidex_read` for the latest source, revision, and guidance manifest.
3. Read only the guidance resources required for this task.
4. Plan complete frames and stable IDs before composing source.
5. Submit one complete deck or one complete slide to `open_slidex_edit` with
   the latest `expectedRevision`.
6. If rejected, repair the same candidate from its node-specific findings.
   Never retry a stale revision or regenerate blindly.
7. Treat an accepted edit's validation, visual report, and preview as the result.

If the current source contains a removed tag, report its exact slide and tag.
Replace it only when the user asked to migrate that source.
