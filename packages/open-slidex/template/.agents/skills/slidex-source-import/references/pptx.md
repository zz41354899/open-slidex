# PPTX conversion

`open_slidex_source_import` inspects ordered PowerPoint slides, text frames,
title hints, typography, alignment, image frames, and warnings. The
`import-media` follow-up converts supported embedded images to `assets/*.webp`
and returns native percentage geometry. It never copies PowerPoint XML into
MotionDoc and does not produce a finished deck by itself.

## Preserve evidence before redesign

- Preserve slide order and the author’s information hierarchy unless the user
  explicitly requests restructuring.
- Read `textFrames` in z-order. Each frame includes recovered text, geometry,
  title hints, font size, weight, alignment, and a reviewable native `textBlock`.
- Treat themes, master layouts, animations, SmartArt, embedded objects, and
  unsupported chart types as visual references. Recreate their meaning with
  native layers rather than copying XML or rasterizing the entire slide.
- For each returned image with `status: "imported"`, preserve its source,
  frame, alt text, and z-order before making an intentional design adjustment.
- Never emit an image for `missing` or `unsupported` media.

## Conversion decisions

| PowerPoint evidence | Native OpenSlideX result |
| --- | --- |
| Title and short lead | Title-role `Text` plus a supporting `Text` layer |
| Positioned text frame | Native `Text` using recovered geometry as evidence |
| Repeated metric items | Grouped `Text` and semantic card `Shape` layers |
| Native or embedded chart | Native `Chart` only when the values are explicit |
| Tabular values | Native `Table` when exact cells matter |
| Decorative card/grid | Semantic card backgrounds with editable native children |
| Image or illustration | `ImageBlock` only after portable media import |

## Quality handoff

After inspection, classify the story and use MCP `templateQuery` to choose
exactly one of the six thirty-page core references. Borrow hierarchy, grids,
image rhythm, cards, and evidence treatments—not the sample wording. Preserve
supported content, label gaps, and submit the complete native deck through the
rendered quality gate.
