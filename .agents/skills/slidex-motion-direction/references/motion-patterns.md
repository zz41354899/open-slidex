# Motion patterns

Use motion only after the static slide passes visual review.

## Valid vocabulary

- Element `enter`: `none`, `fadeIn`, `fadeUp`, `rise`, `slideLeft`, `zoomIn`,
  `pop`, `reveal`, `blurIn`.
- Slide `slideTransition`: `none`, `fade`, `rise`, `pushLeft`, `scale`, `wipe`,
  `curtain`.
- Chart `chartMotion`: `auto`, `grow`, `draw`, `sweep`, `pop`, `none`.

Unknown values are invalid. Use `grow` for bars, `draw` for line or area,
`sweep` for pie or donut, and `pop` for scatter.

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
