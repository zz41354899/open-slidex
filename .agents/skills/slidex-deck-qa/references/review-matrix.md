# OpenSlideX review matrix

Run an evidence pass and a visual pass. Fix blockers before polish.

## Release blockers

- Any `Card`, `Metric`, `Stack`, `Group`, `Title`, `Icon`, or `Notes` tag.
- Raw HTML, arbitrary JSX, visible Markdown, executable expressions, missing
  IDs, or missing explicit geometry on visible layers.
- Clipped or overflowing text, unintended overlap, off-canvas layers, broken
  assets, stretched media, unreadable contrast, or unsupported motion.
- A factual claim, metric, quotation, citation, or customer presented without
  support from the supplied source.
- A missing rendered preview when rendering is available.

## Evidence pass

- Prompt: assumptions are labeled and facts are not invented.
- Notes: duplicates are removed and priorities remain faithful.
- Document: conclusions are preserved without copying its section structure.
- Research: method, units, dates, limitations, and attribution survive.
- Data: values, denominator, period, category, and missing values are correct.
- Existing deck: unrelated user content and assets remain unchanged.

## Visual pass

Inspect the complete montage, then every materially changed slide:

- hierarchy and presentation-distance legibility;
- exact alignment, safe margins, and intentional whitespace;
- contrast, type consistency, and controlled line lengths;
- focal and density variation across adjacent slides;
- media crop, aspect ratio, portability, and attribution where needed;
- chart choice, labels, units, and table readability;
- static final state for motion, raster, HTML, and editable PPTX.

## Repair order

1. Invalid source or broken assets.
2. Overflow, clipping, overlap, and off-canvas geometry.
3. Unsupported evidence or misleading visual encoding.
4. Hierarchy, contrast, density, and reading order.
5. Repetition, polish, and motion restraint.

After each material repair, render again. Do not infer visual success from a
valid parser result.
