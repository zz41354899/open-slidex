---
name: slidex-mdx-authoring
description: Create, rewrite, or repair editable OpenSlideX presentations as strict MotionDoc MDX. Use for any task that changes presentation.mdx, creates slides or layers, adds media, groups layers, or needs valid source for OpenSlideX render and export.
---

# OpenSlideX MDX Authoring

Treat `presentation.mdx` as the only presentation source. Match the read and
edit scope to the request instead of rewriting unrelated slides.

## Source contract

- Start with one `# Deck title`.
- Put every slide inside `<Slide>...</Slide>`.
- Inside a slide, CommonMark supports headings, paragraphs, bold, italic,
  links, blockquotes, inline or fenced code, and ordered or unordered lists.
- Use built-in serializable JSX elements only: `Title`, `Text`, `ImageBlock`,
  `VideoBlock`, `Icon`, `Table`, `Chart`, `Shape`, `Card`, `Metric`, `Stack`,
  and `Group`.
- `<Chart>` supports `bar`, `line`, `area`, `pie`, `donut`, and `scatter`.
  Store rows as strict JSON in `data`; each row needs `label` and numeric
  `value`, while scatter may add `x`, `size`, and hex `color`.
- Use `<Group id="..." name="...">` only to organize native child layers.
- `<Notes>...</Notes>` is presenter-only CommonMark. Use at most one direct
  child per slide. Never place visual layers inside it.
- Give editable layers stable, unique `id` props.
- Use percentage coordinates for `x`, `y`, `w`, and `h`; use points for
  `fontSize`.
- Use canonical typography props only: `fontFamily`, `fontSize`, `fontWeight`,
  `fontStyle`, `letterSpacing`, `lineHeight`, `textAlign`, and
  `textVerticalAlign`. Never use the ignored aliases `weight`, `tracking`, or
  `align`.
- Give text frames enough `h` for every rendered line at the chosen
  `fontSize` and `lineHeight`; declared coordinates do not guarantee glyph fit.
- Attributes accept quoted strings or literal numbers and booleans only.
- Never add imports, exports, scripts, handlers, unknown runtime components,
  or executable JavaScript expressions.

## Media

- Prefer files already supplied under `assets/`.
- Store generated or uploaded media as replaceable relative asset paths.
- Never invent URLs or save Base64, `blob:`, or absolute local paths.
- Always provide meaningful `alt` text and a deliberate `fit`.

## Workflow

1. For a selected slide or layer, call `open_slidex_inspect` and keep every
   unrelated slide unchanged. Read the complete source only for whole-deck work.
2. For a new deck or full redesign, read the selected template blueprint when
   present, then decide narrative, visual system, and asset needs before writing.
3. Apply one coherent batch with `open_slidex_edit` and the latest
   `expectedRevision`. Never retry a stale revision.
4. Treat the accepted `open_slidex_edit` result as the authoritative structural
   validation, rendered QA, and preview proof for that candidate. Do not call
   `open_slidex_validate`, `open_slidex_render`, or
   `open_slidex_quality_check` again after the accepted edit.
5. Use standalone validate, render, or quality tools only for an explicit
   read-only review where no edit is being made. Report only tool-confirmed
   edits and findings.
