---
name: slidex-deck-qa
description: Validate and visually inspect editable OpenSlideX MotionDoc decks. Use before declaring any presentation complete, after material MDX or design changes, and when checking overflow, contrast, montage, per-slide renders, animation names, or export readiness.
---

# OpenSlideX Deck QA

Source validity is necessary but not visual proof.

## Required loop

1. Treat `open_slidex_edit` as a pre-write quality transaction. It validates
   and render-checks the complete candidate before changing `presentation.mdx`.
2. If it returns `quality_gate_failed`, the source and revision did not change.
   Correct the complete candidate using the reported slide, code, node IDs,
   and metrics. Use at most two rejected candidate attempts.
3. An accepted edit returns both the authoritative candidate report and an
   immutable slide or montage preview produced by the same QA pass. Do not run
   a second render, validate, or quality check after success.
4. Use standalone `open_slidex_render`, `open_slidex_validate`, or
   `open_slidex_quality_check` only for review-only work where no edit occurs.
5. For a full deck, inspect both the returned montage and structured deck report for
   story rhythm, focal variety, hierarchy, margins, balance, media treatment,
   contrast, and accidental empty regions.

## Acceptance

- Content is legible at presentation distance.
- Text fits its frame and no layer unintentionally leaves the canvas.
- Media resolves, keeps useful alt text, and is not stretched.
- Colors, typography, and animation vocabulary stay consistent.
- HTML, MDX, and PPTX export without losing the intended hierarchy.

If the edit QA or a review-only quality check cannot start, report visual QA as
blocked. Never substitute source validation or a PNG path for visual proof and
never use shell commands from AI Chat.
