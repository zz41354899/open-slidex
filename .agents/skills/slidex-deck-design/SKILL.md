---
name: slidex-deck-design
description: Art-direct polished, non-generic OpenSlideX presentations in editable MotionDoc MDX. Use when creating or redesigning a deck, choosing narrative structure, typography, spacing, color, imagery, composition, or a coherent visual system across slides.
---

# OpenSlideX Deck Design

Create one recognizable visual world for the deck. Resolve content hierarchy
before decoration.

## Direction

1. Define the audience, presentation goal, tone, and one-sentence visual concept.
2. Build a story arc: hook, context, evidence, decision, close.
3. Choose one type system, spacing rhythm, palette, and image treatment.
4. Vary composition while preserving margins, hierarchy, and visual logic.

Before writing MDX for a new deck, make a compact slide plan. For each slide,
choose its narrative role, one-sentence claim, proof or next action, dominant
focal element, content density, and image need. Adjacent slides must not reuse
the same focal position, text width, and content density.

For a focused edit, inherit the existing deck's type, palette, spacing, and
image language. Do not introduce a second visual system for one slide.

## Layout rules

- Use a 1920x1080 canvas with 6-8% outer margins.
- Align to a 12-column mental grid and avoid near-miss alignment.
- Give each slide one dominant focal element.
- Prefer 42-72pt display text, 24-36pt headings, and 14-24pt body text.
- Use whitespace as structure and avoid repeated generic card grids.
- Limit a normal slide to one title plus roughly 3-5 meaningful content units.
- Keep contrast and line length readable at presentation distance.
- Leave at least 2.5% canvas distance between independent text frames. Large
  numerals and display words need optical clearance beyond their declared box.
- Size the frame for the rendered line height. Never solve overflow by reducing
  body text below the readable scale.

## Copy and typesetting

- Give each slide one repeatable claim, one supporting reason, and one proof
  point or next action. Do not fill space with generic adjectives.
- Lead with the conclusion and use concrete verbs. Preserve unknown facts as a
  clearly marked gap instead of inventing metrics, customers, or evidence.
- Keep a headline to two rendered lines. Keep normal body copy to roughly three
  to five rendered lines and split the idea when it needs more.
- For `zh-TW`, avoid a final line containing only one or two CJK characters,
  and never leave punctuation alone at the start or end of a line. Rewrite or
  rebalance width before shrinking type.
- For English, avoid one- or two-word widow lines and keep phrases intact when
  a line break would weaken meaning.
- Use manual line breaks only when they improve meaning and have been checked
  in the rendered output; do not use them to force a fragile fit.

## Images and data

- Use supplied brand and user assets first.
- Choose one image language and crop for composition without stretching.
- Use data graphics only when they communicate evidence better than prose.
- If no suitable image exists, compose with typography, shape, icon, and data
  layers instead of fake URLs.

Every slide must work as a still frame and remain editable native MDX.

## Tool workflow

- Inspect the selected slide before proposing visual changes.
- Use `open_slidex_catalog` with the smallest relevant section; request `all`
  only when planning a full deck.
- Apply one revision-safe edit batch. `open_slidex_edit` performs structural
  validation and rendered QA before writing, then returns the accepted preview.
  Correct its node-specific findings through rejected-candidate patch retry.
- Do not call validate, render, or quality-check again after an accepted edit.
  Use those standalone tools only for an explicit read-only review.
