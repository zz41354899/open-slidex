---
name: slidex-source-import
description: Convert a local PowerPoint or HTML source into an editable native OpenSlideX deck. Use when a user supplies a .pptx, .html, or .htm file to recreate or migrate, not for an existing MotionDoc MDX deck.
---

# OpenSlideX Source Import

Turn a supplied local PPTX or HTML source into a coherent editable MotionDoc deck. Preserve the source's message and meaningful hierarchy; do not copy foreign markup or assume its layout is portable.

## Read the source safely

1. In Workspace scope, use `open_slidex_workspace` to select the destination deck. The source file must be inside that selected deck directory.
2. Call `open_slidex_read` with `intent: "import"`, then read this skill and the task-relevant references it names.
3. Call `open_slidex_source_import` with `action: "inspect"` to review source structure. For a PPTX with images, call it again with `action: "import-media"` and the latest `expectedRevision`; use only returned images whose `status` is `imported` and whose `source` is `assets/...`. Its `imageBlock` is the native MDX starting tag with the recovered geometry.
4. Call `open_slidex_read` again immediately before editing to obtain the latest revision and complete destination source.

## Rebuild, do not transplant

- Read [PPTX and HTML conversion](references/pptx-and-html.md) before planning either source format.
- Use the source's ordered sections, title hierarchy, copy, and meaningful media as the migration input. Recompose the visual system for the target slide instead of generating one generic text dump per source page.
- Follow `slidex-mdx-authoring` for every emitted layer. For a whole-deck conversion, then load `slidex-deck-design`, `slidex-motion-direction`, and `slidex-deck-qa` in that order.
- Keep only native `Text`, `ImageBlock`, `VideoBlock`, `Chart`, `Table`, and `Shape` layers. Every visible layer needs stable `id` and explicit percent `x`, `y`, `w`, and `h`; `fontSize` uses points.
- Preserve each imported PPTX image frame's returned `x`, `y`, `w`, and `h` in an `ImageBlock`. Do not emit an `ImageBlock` for `missing` or `unsupported` images.

## Commit one validated result

Plan the complete target deck before writing. Submit one complete deck to `open_slidex_edit` with its latest `expectedRevision`; repair a rejected candidate from its node-specific visual QA findings. Do not persist source HTML, PowerPoint XML, scripts, Base64, foreign components, or absolute paths inside `presentation.mdx`.
