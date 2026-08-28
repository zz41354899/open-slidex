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
| `SvgBlock` | Declarative shared SVG scenes | `src`, `sharedScene`, `stage` |
| `Chart` | Quantitative comparison or trend | `type`, JSON `data` |
| `Table` | Exact values or structured comparison | serialized `cells` |
| `Shape` | Fields, rules, lines, highlights | `shape`, `fill`, `stroke` |

Every visible layer needs unique `id`, `x`, `y`, `w`, and `h`. Common visual
props include `rotation`, `opacity`, `radius`, `enter`, `groupId`, and
`groupName`. A shared `groupId` groups native children without a wrapper tag.

Use `<Text role="title">` for a title. Canonical text props are `fontFamily`,
`fontSize`, `fontWeight`, `fontStyle`, `letterSpacing`, `lineHeight`,
`textAlign`, and `textVerticalAlign`.

## Declarative animation

Use `slideTransition="morph"` with `transitionDuration`, `morphEasing`, and
`morphFadeUnmatched` for Shared Morph. Optional `morphShapeSoftness` (0-1) and
`morphShapePrecision` (12-96) control shape-to-shape contour interpolation.
`morphEasing="custom"` additionally accepts `morphCurveX1`, `morphCurveY1`,
`morphCurveX2`, and `morphCurveY2` cubic controls. Compatible adjacent `Text`,
`ImageBlock`, `Shape`, and `SvgBlock` layers pair through a per-slide-unique
`sharedId`; normal `id` values remain unique across the complete deck.
For an N-slide Morph sequence, author N-1 adjacent edges: every slide except
the final one has `slideTransition="morph"`, and every edge has at least one
compatible same-type `sharedId` pair. Read and replace the complete affected
sequence when repairing it; a valid first-to-last match does not excuse an
unpaired intermediate edge.
On a later Morph source slide, `morphEffectMode="inherit"` reuses the first
edge's duration, easing, curve, fade, softness, and precision in both Workbench
preview and exported HTML. Use `morphEffectMode="custom"` or omit the prop for
independent edge settings. This does not replace the adjacent `sharedId`
pairing requirement.

Same-slide Action Tween uses a strict version-1 JSON string in `motion`. Action
IDs and `order` values are unique, the first action cannot be `withPrevious`,
and the last tween `to` state must match the layer's native `x`, `y`, `w`, `h`,
`rotation`, and `opacity`. Never combine `motion` with legacy `enter`, `delay`,
or `duration`. The native properties always describe the complete final frame.
An optional `exit` action may use `fadeOut`, `fadeDown`, `slideRight`,
`zoomOut`, or `shrink`; it affects playback only and never replaces that
native static final frame.
For numeric Text, a tween may use `preset: "numberRange"` with a required
`numberRange: { from, to, step }`. `step` must be positive, geometry stays
unchanged, and the Text content must equal the final `to` value.

Click interactions use a strict `interaction` JSON string with `version: 1`,
`trigger: "click"`, and one action: `nextSlide`, `previousSlide`,
`goToSlide` with a positive 1-based slide number, or `openUrl` with an HTTP(S),
mailto, or local-hash URL. Never author handlers or executable code.

## Declarative shared SVG

Use a verified script-free `assets/*.svg` source. Layers in one animated scene
must use the same `src` and `sharedScene`. `stage` is a nonnegative integer;
`stageDuration` is optional and must be from 0 through 30 seconds. The SVG may
use declarative `data-stage` and `data-motion` markers, but never scripts,
handlers, SMIL animation, embedded documents or media, or external references.

```mdx
<SvgBlock id="journey-stage-1" x={8} y={22} w={84} h={62} src="assets/journey.svg" sharedScene="journey" stage={1} stageDuration={0.7} />
```

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
