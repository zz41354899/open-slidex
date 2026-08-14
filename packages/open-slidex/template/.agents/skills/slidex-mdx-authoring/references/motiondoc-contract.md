# MotionDoc authoring contract

Read this file before emitting or repairing OpenSlideX MDX.

## Document shape

```mdx
# Deck title

<Slide duration={5} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" background="#F7F7F5" theme="light">
  <Text id="slide-01-title" role="title" x={8} y={8} w={84} h={14} fontFamily="Roboto" fontSize={42} fontWeight={700}>One clear claim</Text>
</Slide>
```

- Use one document heading, followed by one or more complete `Slide` blocks.
- Use percentage geometry on the 100 by 100 canvas. `canvasWidth` and
  `canvasHeight` describe the 1920 by 1080 design surface.
- Keep values literal and serializable. Strings are quoted; numbers and
  booleans use braces. Do not use variables, functions, objects, or JSX spread.

## Native toolbar layers

| Layer | Purpose | Core content |
| --- | --- | --- |
| `Text` | Titles, body, labels, numerals | Paired tag with visible text |
| `ImageBlock` | Portable still images | `src`, `alt`, `fit` |
| `VideoBlock` | Portable video | `src`, optional `poster`, `fit` |
| `Chart` | Quantitative comparison or trend | `type`, JSON `data` |
| `Table` | Exact values or structured comparison | serialized `cells` |
| `Shape` | Fields, rules, lines, highlights | `shape`, `fill`, `stroke` |

Every visible layer needs unique `id`, `x`, `y`, `w`, and `h`. Common visual
props include `rotation`, `opacity`, `radius`, `enter`, `groupId`, and
`groupName`. A shared `groupId` groups native children without a wrapper tag.

Use `<Text role="title">` for a title. Canonical text props are `fontFamily`,
`fontSize`, `fontWeight`, `fontStyle`, `letterSpacing`, `lineHeight`,
`textAlign`, and `textVerticalAlign`.

## Invalid source

`Card`, `Metric`, `Stack`, `Group`, `Title`, `Icon`, and `Notes` do not exist in
the authoring format. Raw HTML, visible Markdown inside a slide, arbitrary JSX,
imports, exports, scripts, event handlers, and executable expressions are also
invalid. Rebuild their visible meaning from positioned native layers.

## Geometry discipline

- Keep normal content inside 6-8% outer margins.
- Reserve the layer height needed by rendered line height; do not rely on crop.
- Keep independent text frames separated and align related edges exactly.
- Use stable descriptive IDs. Preserve IDs for unchanged layers during edits.
- A focused edit returns one complete `Slide`; a deck edit returns the complete
  document. Never send a partial JSX fragment.
