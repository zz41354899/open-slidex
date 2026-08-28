# Motion patterns

Use motion only after the static slide passes visual review.

## Valid vocabulary

- Element `enter`: `none`, `fadeIn`, `fadeUp`, `rise`, `slideLeft`, `zoomIn`,
  `pop`, `reveal`, `blurIn`.
- Slide `slideTransition`: `none`, `fade`, `rise`, `pushLeft`, `scale`, `wipe`,
  `curtain`, `morph`.
- Chart `chartMotion`: `auto`, `grow`, `draw`, `sweep`, `pop`, `none`.

Unknown values are invalid. Use `grow` for bars, `draw` for line or area,
`sweep` for pie or donut, and `pop` for scatter.

## Action Tween

Use the versioned JSON string prop `motion` for same-slide actions. Each action
uses one slide-wide nonnegative `order`, a unique `id`, `onClick`,
`afterPrevious`, or `withPrevious`, a 0.1-30 second duration, and `linear`,
`easeIn`, `easeOut`, or `easeInOut`. The first slide action cannot use
`withPrevious`. A tween has complete `from` and `to` states for `x`, `y`, `w`,
`h`, `rotation`, and `opacity`; an optional `path` has one `controlX` and
`controlY`. The last tween destination must exactly equal the layer's native
final properties. Do not combine `motion` with legacy `enter`, `delay`, or
`duration` on the same layer.

The lightweight composer uses three stages: Start, Action, and End. Start uses
a curated entrance preset; Action uses `move`, `drift`, `scale`, `rotate`,
`fade`, `arcUp`, `arcDown`, or the Text-only `numberRange` as an editor preset.
`drift` combines a short curved move, subtle scale, rotation, and fade as one
polished lightweight tween template.
`numberRange` adds `{ from, to, step }`, animates numeric text without changing
geometry, and requires the native Text content to equal `to` so static output
keeps the final number. Other Action presets retain explicit endpoints;
End uses an `exit` action with `fadeOut`, `fadeDown`, `slideRight`, `zoomOut`,
or `shrink`. Exit is playback-only, so the native layer remains visible in
reduced motion and static output.

## Shared Morph

Put `slideTransition="morph"` on the source slide that links to the next page. Optional props are
`transitionDuration={0.72}`, `morphEasing="easeInOut"`, and
`morphFadeUnmatched="true"`. Pair adjacent `Text`, `ImageBlock`, `Shape`, or
`SvgBlock` layers with the same `sharedId`; each `sharedId` must be unique within
one slide. Text content changes crossfade while geometry and style move.
`Chart`, `Table`, `VideoBlock`, and imported HTML remain unmatched and fade.

A paired shared layer may also carry a valid `motion` sequence. Preview and
HTML must measure the destination's native final frame before applying that
sequence's initial state, then defer its Action initialization until the Morph
handoff. Do not suppress the Action or let its entrance state distort Morph
measurement. The visible order is Morph first, followed by the shared layer's
Action; unmatched destination Actions use the same transition delay.

A contiguous N-slide Morph sequence contains N-1 adjacent Morph edges. Put
`slideTransition="morph"` on every slide except the final slide, and give every
edge at least one compatible same-type pair with the same `sharedId`. Preview
must play the complete sequence in order and recapture the completed target
before starting the next edge. HTML playback follows the same edge-by-edge
model. Never validate only the first and final slide while skipping the middle
slides.

Each later Morph source may independently use `morphEffectMode="inherit"` to
reuse the sequence's first edge duration, easing, custom curve, fade, shape
softness, and shape precision. Omit it or use `morphEffectMode="custom"` when
that edge should keep its own settings. Inheritance changes motion settings,
not layer pairing: every adjacent edge still needs a valid same-type
`sharedId` pair. Workbench preview and exported HTML must resolve the same
effective settings.

Paired `Shape` layers may change between circle, rectangle, triangle, polygon,
star, diamond, arrow, chevron, corner, hexagon, and parallelogram. The player
normalizes both outlines before interpolation; `morphShapeSoftness` (0-1,
default 0.32) softens the intermediate contour and `morphShapePrecision`
(12-96, default 48) controls outline detail. Line shapes fall back to fade.
Morph-only easing also accepts `smooth` and `spring`.

Workbench also exposes `emphasized`, `backOut`, and `custom` Morph curves.
Custom curves use `morphCurveX1`, `morphCurveY1`, `morphCurveX2`, and
`morphCurveY2` as cubic-bezier controls. X values stay between 0 and 1; Y
values may range from -1.5 to 2.5 for restrained overshoot. Selecting Morph
auto-pairs compatible adjacent native layers. Unlinking a Morph group restores
ordinary independent slides in one update, removes Morph-only settings, and
clears the group's `sharedId` pairing identity.
Workbench presents a contiguous Morph chain as a slide sequence. Adding a Morph
slide duplicates the final state with regenerated native IDs, keeps adjacent
`sharedId` values, and leaves the new final slide without a dangling Morph transition.
An overview click area may jump directly to any detail slide in the same Morph
sequence, including a non-adjacent slide. Pair the overview hotspot and its detail
object with the same `sharedId`; preview and HTML playback then Morph those shared
objects across the jump. Enable Return Morph on a detail slide to give the paired
object a declarative `goToSlide` action back to the overview without removing its
Morph identity.

## Interactive actions

Any native layer can be a click area through a strict version-1 JSON string in
`interaction`. The supported actions are `nextSlide`, `previousSlide`,
`goToSlide` with a positive 1-based `slide`, and `openUrl` with an HTTP(S),
mailto, or local-hash URL. Interaction must remain declarative so Workbench
preview and exported HTML share behavior while MDX stays portable and safe.

## Timing

- Normal entrances: 0.45-0.8 seconds.
- Slide transitions: 0.6-0.9 seconds.
- Related-layer stagger: 0.08-0.16 seconds.
- Reveal the focal layer first and supporting evidence second.
- Use no more than two entrance families on a normal slide.

## Choose by meaning

- Hierarchy: focal title or claim first, proof second.
- Sequence: reveal ordered steps in reading order.
- Comparison: reveal both sides close enough to compare, not as a long cascade.
- Data: animate the mark in the direction the value is read.
- Transition: use one deck-level family; reserve a stronger transition for a
  real section or state change.

Motion must never be the only carrier of information. Reduced motion, raster,
and PPTX must show the complete final state.

## Shared SVG stages

Use `SvgBlock` for a declarative SVG scene whose layers share one `src` and
`sharedScene`. Advance the scene with a nonnegative integer `stage`; use
`stageDuration` only for deliberate state timing. The asset may contain
`data-stage` and `data-motion` markers, but never JavaScript, event handlers, or
SMIL animation. Reduced motion, raster, and PPTX must show the static final
state without depending on intermediate stages.
