---
name: slidex-deck-qa
description: Validate and visually inspect editable OpenSlideX decks. Use before completion, after material source or design changes, and for overflow, overlap, contrast, asset, montage, motion, evidence, or export-readiness review.
---

# OpenSlideX Deck QA

Source validity is necessary but never substitutes for rendered proof.

## Required reference

Read [the review matrix](references/review-matrix.md). Apply every release
blocker and the checks relevant to the deck's source type.

## Acceptance loop

1. Confirm the selected deck, current revision, and exact source scope with
   `open_slidex_read`.
2. For an edit, rely on `open_slidex_edit`: it validates, renders, visually
   checks, and writes atomically only when the candidate passes.
3. If rejected, repair the same candidate using the reported slide, code,
   node IDs, and metrics. Stop after two focused repair attempts and report the
   remaining blocker.
4. For review-only work, call `open_slidex_review` and inspect the complete
   montage plus every materially changed slide.
5. Do one evidence pass and one visual pass. A deck is complete only when both
   pass and the editable MDX preserves the intended hierarchy.

For a deck longer than 20 pages, inspect the complete montage and every slide,
not only a representative sample. For browser-native HTML, verify the canonical
page count, one thumbnail per mapped page, and first, middle, last, and section
boundary pages in full-screen playback.

Never declare completion without an accepted rendered preview when visual QA is
available.
