# PPTX and HTML conversion

`open_slidex_source_import` first inspects ordered source slides or sections, text blocks, image frames, title hints, and warnings. `import-media` is the PPTX-only follow-up that converts supported embedded images to `assets/*.webp` and returns their native percentage geometry. It never executes HTML and does not produce MotionDoc by itself.

## PPTX

- Preserve slide order and the author’s information hierarchy. Use each extracted text block to decide whether it is a title, supporting copy, label, caption, or data point.
- Treat themes, master layouts, animations, SmartArt, embedded objects, and unsupported chart types as visual references. Recreate their meaning with native layers, not copied XML or raster screenshots.
- For each returned image with `status: "imported"`, author an `ImageBlock` with its `src`, `x`, `y`, `w`, and `h`. Preserve the frame before making any intentional design adjustment. Never emit a block for `missing` or `unsupported` images.

## HTML

- A `section`, `article`, or `main` is a likely slide boundary. If the HTML is a normal document, use its heading hierarchy to choose meaningful slide boundaries rather than making one slide per paragraph.
- CSS, scripts, iframes, canvases, and responsive layout are not transferable. Recreate their visual role with the target’s own native layer system.
- Do not copy literal HTML into MDX. Copy only verified content and reauthor it as positioned `Text`, `Shape`, `Chart`, `Table`, or media layers.

## Conversion decisions

| Source evidence | Native OpenSlideX result |
| --- | --- |
| Title and short lead | One title `Text` plus a supporting `Text` layer |
| Repeated metric items | Individual `Text` and `Shape` layers; use `Chart` only for actual data |
| Tabular values | `Table` when the cells are meaningful, otherwise concise text or chart |
| Decorative card/grid | Native `Shape` backgrounds plus independently editable `Text` layers |
| Image or illustration | `ImageBlock` only after a portable asset is imported |

If source content is unclear or visual fidelity matters more than semantic conversion, ask the user for the original assets or a screenshot reference before replacing the destination deck.
