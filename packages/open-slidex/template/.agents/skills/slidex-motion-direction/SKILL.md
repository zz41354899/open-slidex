---
name: slidex-motion-direction
description: Add or review deliberate OpenSlideX animation after static design is complete. Use for entrances, staggered reveals, slide transitions, chart motion, timing, reduced-motion behavior, or motion polish.
---

# OpenSlideX Motion Direction

Finish and verify the static composition first. Motion must clarify hierarchy,
sequence, causality, feedback, or state change; otherwise use `none`.

## Required reference

Read [motion patterns](references/motion-patterns.md) before adding or changing
motion. It contains the valid vocabulary, timing ranges, and pattern selection.

## Workflow

1. Read the complete affected slide and its latest revision.
2. State what the motion explains in one sentence.
3. Use at most two entrance families on a normal slide and preserve a complete
   static final frame.
4. For a native `SvgBlock` scene, use `sharedScene`, `stage`, and
   `stageDuration` only after its script-free SVG and static final state pass.
5. Submit the complete updated slide through `open_slidex_edit`.
6. Inspect the accepted preview and verify reduced-motion, raster, and PPTX
   output do not hide information.

Never embed animation code, use unsupported motion names or removed components,
or use motion to conceal an overcrowded static layout.
