# Media and data authoring

Read this file only when the deck uses media, charts, tables, or imported data.

## Images and video

- Prefer an existing file in the selected deck's `assets/`.
- Import new local or approved remote media through `open_slidex_media`; then
  use the returned relative path.
- Use meaningful `alt` text and choose `fit="cover"` for intentional crops or
  `fit="contain"` when the complete object must remain visible.
- Never invent a URL. Never persist Base64, `blob:`, or an absolute path.
- Keep image treatment consistent: crop logic, radius, border, and color grade
  should belong to one visual system.

## SVG scenes

- Store SVG sources as verified, script-free `assets/*.svg` files and author
  them only through native `SvgBlock` layers.
- Declarative `data-stage` and `data-motion` markers may describe state changes.
  Scripts, event handlers, SMIL, embedded documents or media, and external
  references are invalid.
- Every layer in one `sharedScene` must reuse the same `src`; advance it with a
  nonnegative integer `stage` and an optional 0-30 second `stageDuration`.
- Preserve a complete static final state for reduced motion and export.

## Charts

Valid chart types are `bar`, `line`, `area`, `pie`, `donut`, and `scatter`.
Keep `data` as strict JSON in a quoted attribute and preserve the supplied
numbers exactly. Use charts to reveal comparison, change, composition, or
relationship—not as decoration.

```mdx
<Chart id="adoption-trend" x={9} y={26} w={82} h={54} type="line" data='[{"label":"Q1","value":42},{"label":"Q2","value":58}]' />
```

Do not infer missing periods or values. State units, time range, and source in
nearby `Text` layers when the evidence provides them.

## Tables

`cells` uses `|` between columns and `;` between rows. It is not JSON.

```mdx
<Table id="market-table" x={9} y={28} w={82} h={48} cells="Market|Signal|Owner;North|Rising|Ava;South|Stable|Noah" />
```

Use a table for exact lookup or multi-attribute comparison. If the point is one
ranking or trend, prefer a chart or a concise visual statement.

## Research evidence

- Keep observed findings separate from interpretation and recommendation.
- Preserve caveats, sample size, date, and source attribution when available.
- Never turn a qualitative statement into a numeric claim.
- If an asset or datum is missing, mark the gap; do not create a plausible
  substitute.
