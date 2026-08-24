# Style selection

Choose visual direction only after the source brief and narrative pattern are
clear. Eight curated resources—S01, S05, S08, S09, S19, S20, S25, and S27—teach
visual language; they are not eight
prebuilt decks and are never a substitute for understanding the report.
Content type, audience, decision, evidence density, and brand constraints matter
more than surface mood.

## MCP route

When no curated style is explicit, call `open_slidex_read` with `styleQuery`.
Include the source type, short summary, audience, desired outcome, evidence
density, tone, industry, and any brand constraints in one concise query.
Inspect the three ranked recommendations and choose the strongest fit for the
story—not simply the first result. Then read only its returned
`mdxResourcePath`.

When the user names a style ID, skip recommendation and read the matching
`style-<id>-*.mdx` resource from the manifest. Read `style-catalog.json` only
when MCP recommendation is unavailable and a manual catalog lookup is needed.

## Selection priorities

1. Preserve an explicitly requested style unless it would make the content
   unreadable or violate an explicit brand/accessibility constraint.
2. Match formal reports, board decisions, and dense evidence to disciplined
   grid, editorial, enterprise, or financial directions.
3. Match product launches and future-facing narratives to technology,
   high-energy, or futuristic directions when the audience permits it.
4. Match brand, campaign, keynote, and cultural stories to expressive,
   editorial, luxury, organic, or playful directions.
5. Use restrained styles when the source is ambiguous. Do not infer a dramatic
   aesthetic from a single colorful keyword.

## Applying the specimen

Each style MDX contains twelve teaching roles: image-led cover, contents,
introduction, purpose and operating model, capability cards, native evidence,
people and culture, case/example, process, exact comparison, opportunity, and
closing direction. All share a clean company-profile editorial system:
white or near-white canvas, cyan-blue accents, strong black hierarchy,
disciplined grids, purposeful whitespace, restrained corners, and an image-led
cover. Keep this shared corporate visual world across all eight directions;
their differences come from narrative job, composition, density, and image
selection rather than unrelated color themes. Verified Unsplash HTTPS photography is allowed through
`ImageBlock`; borrow the crop logic, palette roles, typography
hierarchy, spacing rhythm, chart treatment, and motion character. Recompose
geometry for the actual claim and evidence. Do not clone the twelve pages, copy
their instructional wording, or force a real deck to have twelve slides unless
the user requests that length.

Across a complete deck, vary the dominant visual device and use several
different verified image paths rather than repeating one photograph: type-led statement,
diagram, image, native chart, table, sequence, comparison, or deliberate empty
space. Every cover must include one verified, portable `ImageBlock`. Shape is
reserved for a semantic card background with named grouped children; it is not
an ornament, line, abstract illustration, fake icon, or fake chart. Adjacent
slides should not share the same count of equal panels, focal position, and
density.

For quantitative content, select the native chart type from the analytical
question before styling it. Protect room for the conclusion, units, period,
legend, and source. Keep data labels from colliding with marks or one another;
shorten labels, change orientation, or change chart type before reducing them
below presentation distance. Use tables for exact values and diagrams for
relationships that are not quantitative.

Use one display family and one body family at most. Preserve readable contrast
for titles, body text, muted text, data labels, and annotations. Estimate line
count before authoring each `Text` frame, then rely on the rendered quality gate
to repair overflow, clipping, collisions, CJK orphans, and English widows.

Brand Kit colors and required fonts override specimen tokens. Preserve the
selected style's composition and contrast logic when reconciling those values.
Every output remains native MotionDoc and must pass the normal edit quality
gate.
