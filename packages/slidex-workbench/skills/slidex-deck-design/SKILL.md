---
name: slidex-deck-design
description: Turn a prompt, notes, document, research report, data brief, or existing deck into a polished editable OpenSlideX presentation. Use for narrative planning, information synthesis, layout systems, typography, color, imagery, charts, tables, or redesign.
---

# OpenSlideX Deck Design

Design from meaning outward. Every slide communicates one claim, earns its
place in the story, and remains editable with native MotionDoc layers.

## Progressive route

1. Read [source to story](references/source-to-story.md) to classify the input,
   preserve evidence, and define audience, decision, and missing information.
   When a user supplies a document or report, search the selected deck's
   `knowledge/` resources first and read only the relevant evidence before
   choosing a visual direction.
2. Read [narrative patterns](references/narrative-patterns.md) and choose one of
   the six core deck patterns. If the best fit is unclear, pass the brief,
   audience, evidence type, and outcome as `templateQuery` to
   `open_slidex_read`, then inspect only the top recommended MDX reference.
   The MCP consumes [the six-template catalog](references/template-catalog.json);
   do not load it when the returned recommendation already identifies a match.
   For consulting, investment, earnings, or financial weekly work, also read
   [consulting financial report](references/consulting-financial-report.md).
3. Read [visual direction](references/visual-direction.md) to establish the
   composition, type, color, image, and data rules.
4. Read exactly one closest core reference:

   - Consulting, investment, earnings, financial weekly: [consulting financial report](references/consulting-financial-report.mdx)
   - Keynote, vision, brand story: [editorial story](references/editorial-story.mdx)
   - KPI, research, status, operations: [data brief](references/data-brief.mdx)
   - Product, sales, feature launch: [product launch](references/product-launch.mdx)
   - Recommendation, board memo, plan: [strategy proposal](references/strategy-proposal.mdx)
   - Lesson, onboarding, workshop: [training workshop](references/training-workshop.mdx)

The six resources contain 30 pages each: 180 maintained editable teaching
slides in total. They are complete narrative and visual systems, not content to
copy wholesale. Borrow the closest reading path, composition logic, and motion
grammar—not sample wording, figures, IDs, or claims. Preserve the source deck's
required length unless the user asks for a 30-page deliverable. Explicit user
brand requirements override the reference tokens.

For browser-native HTML, use this skill only for story, evidence, and visual
system decisions. Implement the result through `slidex-html-authoring`; do not
translate HTML DOM into editable MotionDoc or author `HtmlEmbedBlock`.

## Design pass

1. Write a one-line audience outcome and a one-line visual concept.
2. Create a claim-led slide outline. Combine repetitive sections; do not make
   one slide per source heading.
3. Assign a distinct visual job to every slide: hook, explain, compare, prove,
   sequence, decide, or close.
4. Establish one coherent type system, restrained palette, spacing rhythm, and
   media treatment. Vary focal position and density across adjacent slides.
   Every cover needs one intentional `ImageBlock` with a verified portable
   asset; lead with a meaningful crop rather than decorative geometry.
5. Compose every slide for its actual claim. Do not turn content units into
   equal cards by default or repeat one specimen geometry across the deck.
   In reference-driven work, use `Shape` for semantic card backgrounds whose native
   children share named groups. Multiple cards are appropriate for genuinely
   repeated capabilities, people, steps, or opportunities. Do not use Shape for ornaments,
   rules, fake icons, abstract art, or hand-built charts.
6. Use the native `Chart` for quantitative comparison, distribution, or trend
   and `Table` when exact lookup matters. Keep labels, units, sources, and the
   main conclusion outside crowded plot regions; never draw a fake chart from
   decorative shapes when a native chart communicates the evidence.
7. Reserve text frames from the expected rendered line count. Fix overflow,
   CJK orphans, English widows, low contrast, and weak font hierarchy before
   accepting smaller type.
8. Inspect the accepted montage for hierarchy, rhythm, contrast, density,
   repetition, and accidental empty regions. Revise weak slides, not just errors.

Never invent metrics, quotations, customers, citations, or media. Label gaps
and uncertainty instead of filling them with plausible fiction.
