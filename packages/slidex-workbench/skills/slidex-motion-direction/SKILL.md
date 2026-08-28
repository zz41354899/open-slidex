---
name: slidex-motion-direction
description: Add or review deliberate OpenSlideX animation after static design is complete. Use for entrances, Action Tween, exits, Shared Morph, staggered reveals, slide transitions, chart motion, timing, reduced-motion behavior, or motion polish.
---

# OpenSlideX Motion Direction

Finish and verify the static composition first. Motion must clarify hierarchy,
sequence, causality, feedback, or state change; otherwise use `none`.

## Required reference

Read [motion patterns](references/motion-patterns.md) before adding or changing
motion. It contains the valid vocabulary, timing ranges, and pattern selection.
For an animated deck longer than 20 pages, also read
[long-deck motion](references/long-deck-motion.md) to keep every page animated
without producing repetitive or exhausting motion.

## Workflow

1. Read the complete affected slide and its latest revision.
2. State what the motion explains in one sentence.
3. Use at most two entrance families on a normal slide and preserve a complete
   static final frame.
4. For Action Tween, author a validated `MotionSequenceV1` JSON string in
   `motion`; keep each action ID and slide-wide order unique, and make the last
   tween `to` equal the layer's native final geometry and opacity.
5. For a composed build, keep the object sequence legible as entrance, one or
   more tweens, then an optional exit. Exit playback never changes the native
   static final state.
6. For Shared Morph, use `slideTransition="morph"` on the source slide
   and reuse `sharedId` only on compatible layers across adjacent slides.
   Treat an N-slide Morph as N-1 independently valid adjacent edges: every
   slide except the final one carries the Morph transition, and every edge has
   at least one same-type `sharedId` pair. Read and submit the complete affected
   sequence so repairing one edge cannot disconnect a later edge.
   Shape pairs may use different supported shape presets; preserve a useful
   final state and use softness only to clarify the transformation. Prefer a
   named Morph easing; use the four `morphCurve*` cubic controls only when a
   custom velocity curve materially explains the state change.
7. For an interactive page or ebook, use the versioned `interaction` prop on a
   native layer for click navigation or a safe link. Never embed event code.
8. For a native `SvgBlock` scene, use `sharedScene`, `stage`, and
   `stageDuration` only after its script-free SVG and static final state pass.
9. Submit the complete updated slide through `open_slidex_edit`.
10. Inspect the accepted preview and verify reduced-motion, raster, and PPTX
   output do not hide information.

Never embed animation code, use unsupported motion names or removed components,
or use motion to conceal an overcrowded static layout.
