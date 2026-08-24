# Visual direction

Define one coherent visual world, then vary composition without losing identity.

## System before slides

Write a one-sentence visual concept that connects tone to form, for example:
“precise editorial contrast with warm evidence photography.” Choose:

- one display and one body family, or one versatile family;
- a restrained palette with explicit background, text, muted, and accent roles;
- a 4/8-point spacing rhythm and consistent 6-8% outer margins;
- one image treatment and one data-visualization treatment;
- a density range appropriate to viewing distance.

## Composition

- Use a 1920 by 1080 canvas and a 12-column mental grid.
- Give each slide one dominant focal element and a first-second-third reading path.
- Prefer 42-72pt display text, 24-36pt headings, and 14-24pt body text.
- Keep normal slides to one title and roughly 3-5 meaningful content units.
- Leave at least 2.5% between independent text frames and more around large
  numerals or charts.
- Vary adjacent slides by focal position, scale, density, and visual job while
  preserving margins and typography.
- Make the cover image-led: use at least one intentional `ImageBlock` with a
  meaningful crop, then place title and metadata in protected whitespace.
- For company profiles or sectioned reports, a contents page and concise
  organization/topic introduction are valid orientation devices. Keep their
  hierarchy editorial rather than turning them into navigation chrome.
- For the bundled eight-style system, use the clean Japanese company-profile
  direction: white canvas, cyan-blue accent, strong black display type,
  restrained corners, compact metadata, and precisely aligned image crops.
  Differentiate styles through composition and narrative purpose, not by
  switching to unrelated dark, vintage, luxury, or decorative color worlds.
- Use a verified `https://images.unsplash.com/...` URL when the user approves
  remote photography. Never persist a local absolute filesystem path; import
  local media into the deck when offline portability is required.
- In style-driven work, use `Shape` only as the background of a semantic card
  whose Text or data children share a named group. Do not draw decorative
  lines, circles, abstract artwork, fake icons, or charts from Shape layers.
  Use imagery, the slide background, whitespace, native Chart/Table, and type
  scale to create composition instead.
- Use several different images across a long deck. Reuse a cover image only for
  a deliberate closing callback, not as the default visual on every page.

## Type and copy

- Lead with the conclusion. Use concrete verbs and one proof point or action.
- Keep headlines within two rendered lines and body copy within 3-5 rendered lines.
- Rewrite CJK orphans and English widows before shrinking type.
- Use manual line breaks only when meaning and the rendered preview improve.
- Avoid fine-print dependency. Source labels may be small but must remain legible.

## Images and data

- Use imagery only when it supplies evidence, setting, emotion, or visual memory.
  A cover always needs that visual memory; import or generate a portable asset
  instead of substituting decorative Shape geometry.
- Crop around the subject; never stretch or mix unrelated treatments.
- Use a chart for a pattern and a table for exact comparison. Annotate the
  insight instead of leaving the audience to hunt for it.
- Choose the native chart type from the question: bars for categorical
  comparison, lines or areas for change over ordered time, scatter for
  relationship, and donut only for a small part-to-whole set. If the evidence
  does not fit one of those questions, use another native composition.
- Reserve clear regions for the conclusion, unit, period, legend, source, and
  annotations. Never let labels collide with marks or the slide title; shorten
  wording, change orientation, or change the chart before shrinking labels.
- Build statistics and visual clusters from separate native layers with shared
  `groupId`; never use removed composite tags.

## Anti-generic check

Replace a composition when it could be swapped into any topic unchanged. A
strong slide expresses this deck's specific claim through scale, sequence,
contrast, imagery, or data—not decorative complexity.
