# Long-deck motion system

Use this system when the user explicitly requests deliberate animation across a
deck longer than 20 pages. Every slide receives one motion beat, but not every
layer needs to move.

## Deck grammar

- Default transition: one family such as `fade`, `rise`, or `pushLeft` for most
  pages at 0.6-0.8 seconds.
- Section transition: one stronger family such as `wipe` or `curtain`, used only
  at real chapter boundaries.
- Content reveal: zero to two entrance families per page. A page transition is
  sufficient for a quiet claim, appendix, or complete comparison.
- Data motion: `grow` for bars, `draw` for lines and areas, `sweep` for pie or
  donut, and `pop` for scatter. Animate once in the reading direction.
- Sequence: stagger steps by 0.08-0.14 seconds and cap the sequence so the page
  reaches its complete state quickly.

## Pattern rotation

Rotate by meaning, not slide number:

- claim: title then one proof;
- trend: chart motion then conclusion;
- comparison: paired reveal with minimal delay;
- process: ordered reveal in reading direction;
- decision: alternatives together, recommendation last;
- section reset: stronger transition, no competing entrance;
- appendix: default transition and complete static content.

Avoid using a different transition on every page. Variation comes from the
evidence and reveal order, while the deck-level family provides continuity.

## QA contract

The final frame must contain every fact. Verify first, middle, last, every
section boundary, and every chart family. Reduced motion, thumbnails, raster,
and PPTX show the complete state without waiting for a reveal.
