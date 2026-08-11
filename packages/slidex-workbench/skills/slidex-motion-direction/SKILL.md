---
name: slidex-motion-direction
description: Add deliberate, valid animation to OpenSlideX MotionDoc MDX. Use when a presentation needs element entrances, staggered reveals, slide transitions, motion timing, or animation review.
---

# OpenSlideX Motion Direction

Finish the static composition first. Motion must communicate hierarchy,
sequence, causality, feedback, or a state transition.

## Valid vocabulary

Element `enter` values:

`none`, `fadeIn`, `fadeUp`, `rise`, `slideLeft`, `zoomIn`, `pop`, `reveal`, `blurIn`

Slide `slideTransition` values:

`none`, `fade`, `rise`, `pushLeft`, `scale`, `wipe`, `curtain`

Unknown values are invalid and must never silently fall back.

Chart `chartMotion` values:

`auto`, `grow`, `draw`, `sweep`, `pop`, `none`

Prefer `grow` for bars, `draw` for line and area, `sweep` for pie and donut,
and `pop` for scatter. Preview and HTML animate; raster and PPTX keep the same
visible final state. Always honor reduced-motion preferences.

## Timing

- Use 0.45-0.8 seconds for normal entrances.
- Stagger related layers by 0.08-0.16 seconds.
- Keep slide transitions between 0.6-0.9 seconds.
- Reveal the focal element first and supporting evidence second.
- Use the same motion family for elements with the same role.
- Most slides need no more than two entrance styles.

Keep the final static frame valid and inspect the accepted preview.

## Tool workflow

Inspect the affected slide first. Apply motion through `open_slidex_edit` with
the latest revision; its accepted result already includes validation, rendered
QA, and preview. Do not repeat validate, render, or quality tools after success.
Never use shell commands or invent unsupported motion names.
