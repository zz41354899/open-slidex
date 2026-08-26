# Ref grammar: IDAEO and Nov

This is a reusable design analysis of two user-approved HTML references. It is
not a content library. Never copy their names, claims, metrics, citations,
client material, or prose into another deck.

## What the references prove

The 11-page IDAEO reference demonstrates an editorial consulting narrative:

- a warm paper field with ink, indigo, vermilion, and teal accents;
- bilingual hierarchy that keeps one language primary and the other visibly
  subordinate instead of duplicating every line at equal weight;
- a visual metaphor that develops across sequential stages;
- dense evidence, service, timing, and summary pages separated by quiet covers;
- inline SVG used as meaningful explanation, not decorative filler.

The 52-page Nov reference demonstrates a long dark-field operating narrative:

- a restrained near-black canvas with one red signal color and off-white type;
- recurring eyebrow, claim, rule, evidence, and folio regions;
- chapter openers that reset attention between dense tables, matrices, demos,
  comparisons, and governance decisions;
- repeated takeaway pages that turn a long talk into actionable checkpoints;
- one coherent 16:9 system that remains legible at presentation distance.

## Transferable page anatomy

Every page needs one visual job and one dominant reading path. Choose only the
regions the claim needs:

1. Kicker: section, period, scope, or evidence status.
2. Claim: one sentence that can be understood without reading the body.
3. Proof: chart, table, matrix, process, image, or two to five evidence points.
4. Implication: what changed, why it matters, or what decision follows.
5. Folio: stable page number, source, confidentiality, or reporting period.

Use repetition for orientation, not as a template cage. Alternate quiet claim
pages, dense evidence pages, visual explanation, comparison, decision, and
section reset. After two dense pages, create a lower-density page before asking
the audience to absorb another table.

## HTML composition system

- Stage: 1920 by 1080 logical pixels or an equivalent 16:9 responsive aspect
  ratio. Keep critical content inside a 5-7% safe margin.
- Type: one display family plus one text family; optional mono only for labels,
  code, or financial identifiers. Use tabular numerals for aligned figures.
- Tokens: define canvas, surface, text, muted text, rule, signal, positive,
  caution, and negative colors once in `:root`.
- Density: title 6-14 words; main claim at most two lines; body clusters at most
  five; tables show only decision-relevant columns on the slide.
- Data: state period, unit, currency, denominator, source, and whether a value is
  actual, forecast, estimate, or scenario.
- Pages: author one top-level `[data-slidex-page]` element per page. Include a
  visible folio so the source and OpenSlideX page rail can be cross-checked.

## Motion and projection

Give every page a motion beat only when a long animated deck is requested. A
page transition counts; add an element reveal only when it explains hierarchy,
sequence, comparison, or data direction. Use one primary transition family,
reserve a stronger transition for section changes, and keep the final frame
complete without animation. CSS or WAAPI timelines must be deterministic,
restartable by page, and disabled by `prefers-reduced-motion`.

Test 100% full-screen playback at 16:9, then test a narrower editor preview.
There must be no dependence on browser UI, hover, local fonts, or an extension.

## Quality bar

- No unsupported or invented facts.
- No copy-pasted reference prose or branding.
- No page that is only a heading over decorative shapes.
- No repeated grid that makes adjacent pages visually indistinguishable.
- No local path after save; packaged sidecars resolve from the deck `assets/`.
- No hidden information in reduced motion, thumbnails, print, or static export.
