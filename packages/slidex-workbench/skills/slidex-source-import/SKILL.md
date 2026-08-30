---
name: slidex-source-import
description: Ingest a supplied document, image, or PowerPoint source for an editable native OpenSlideX deck. Use when a user provides MD, text, CSV, PDF, image, or PPTX evidence, not for an existing MotionDoc MDX deck.
---

# OpenSlideX Source Intake

Bring supplied evidence into the selected deck before composing native MotionDoc. Keep source text in `knowledge/`, visual evidence in `assets/`, and preserve meaning without treating a foreign layout as portable code.

## Read the source safely

1. In Workspace scope, use `open_slidex_workspace` to select the destination deck, then call `open_slidex_read` with `intent: "import"` and keep its latest revision.
2. For MD, Markdown, text, CSV, PDF, or image input, stage a local attachment under the configured root's `.open-slidex-inbox/`, then call `open_slidex_media` with `action: "ingest-source"`, its inbox-relative `filePath`, and the latest `expectedRevision`. A single public HTTPS image URL may be passed directly as `filePath`.
3. Read every returned `knowledge/...` resource through `open_slidex_read` before planning. Use returned `assets/...` paths for native `ImageBlock` layers; they may represent local attachments, public Notion or AI image URLs, PDF images, or PDF page fallbacks. Treat warnings as evidence gaps.
4. For a supplied PPTX, use the dedicated workflow below.

## Import PowerPoint evidence

1. The PPTX source file must be inside the selected deck directory.
2. Call `open_slidex_read` with `intent: "import"`, then read this skill and the task-relevant references it names.
3. Call `open_slidex_source_import` with `action: "inspect"` to review slide order, recovered text frames, typography hints, and image geometry. Call it again with `action: "import-media"` and the latest `expectedRevision`; use only returned images whose `status` is `imported` and whose `source` is `assets/...`.
4. Call `open_slidex_read` again immediately before editing to obtain the latest revision and complete destination source.

## Rebuild, do not transplant

- For PPTX only, read [PPTX conversion](references/pptx.md) before planning the migration.
- Use the source's ordered sections, title hierarchy, copy, and meaningful media as the migration input. Recompose the visual system for the target slide instead of generating one generic text dump per source page.
- Follow `slidex-mdx-authoring` for every emitted layer. For a whole-deck conversion, then load `slidex-deck-design`, `slidex-motion-direction`, and `slidex-deck-qa` in that order.
- Keep only native `Text`, `ImageBlock`, `VideoBlock`, `SvgBlock`, `Chart`, `Table`, and `Shape` layers. Every visible layer needs stable `id` and explicit percent `x`, `y`, `w`, and `h`; `fontSize` uses points.
- Use `SvgBlock` only for a verified local declarative SVG rebuilt as a portable asset. Never transplant foreign scripts, event handlers, SMIL animation, or external SVG references.
- Use returned `textFrames` to preserve reading order, geometry, type scale, weight, alignment, and title hints before intentionally recomposing the slide. Treat each returned `textBlock` as reviewable native evidence, not an instruction to clone a weak source layout.
- Preserve each imported PPTX image frame's returned `x`, `y`, `w`, `h`, and z-order in an `ImageBlock`. Do not emit an `ImageBlock` for `missing` or `unsupported` images.

## Commit one validated result

Plan the complete target deck before writing. For a redesign, use
`open_slidex_read.templateQuery` to choose exactly one of the six thirty-page
core references, then preserve the source slide count unless the user requests
restructuring. Submit one complete deck to `open_slidex_edit` with its latest
`expectedRevision`; repair a rejected candidate from its node-specific visual
QA findings. Never persist source URLs, Base64, PowerPoint XML, foreign
components, or absolute local paths inside `presentation.mdx`.
