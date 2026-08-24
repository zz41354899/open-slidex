import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");
const sourceCatalog = JSON.parse(await readFile(path.join(referenceRoot, "style-catalog.json"), "utf8"));
const expectedStyleIds = ["S01", "S05", "S08", "S09", "S19", "S20", "S25", "S27"];
const catalog = { ...sourceCatalog, styles: sourceCatalog.styles.filter((style) => expectedStyleIds.includes(style.id)) };

if (catalog.styles.map((style) => style.id).join(",") !== expectedStyleIds.join(",")) {
  throw new Error(`Expected curated style IDs ${expectedStyleIds.join(", ")}.`);
}

const allPhotos = [
  "https://images.unsplash.com/photo-1786999100475-7fce5e9b60c9?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=82"
];

const styleDirections = {
  S01: { accent: "#19B8D1", label: "PRODUCT SYSTEM", thesis: "Make complexity feel immediately navigable." },
  S05: { accent: "#43AFC0", label: "QUIET EDITORIAL", thesis: "Let restraint make the important detail visible." },
  S08: { accent: "#197FA8", label: "DARK EXECUTIVE", thesis: "Use contrast to focus attention without hiding detail." },
  S09: { accent: "#18B6CE", label: "COMPANY PROFILE", thesis: "Turn corporate information into a calm, credible story." },
  S19: { accent: "#4B98AA", label: "LUXURY EDITORIAL", thesis: "Give the story the pace of a considered publication." },
  S20: { accent: "#2C9C8B", label: "NATURE REPORT", thesis: "Connect evidence to the living system it affects." },
  S25: { accent: "#00A9C7", label: "STARTUP NARRATIVE", thesis: "Pair momentum with a specific proof and next move." },
  S27: { accent: "#0A8FA5", label: "FINTECH TRUST", thesis: "Make risk, evidence, and action easy to audit." }
};

const narratives = [
  { fileName: "data-brief.mdx", id: "data-brief", title: "Data Brief", label: "OPERATING BRIEF", accent: "#149BB4", thesis: "A useful dashboard ends in a decision." },
  { fileName: "editorial-story.mdx", id: "editorial-story", title: "Editorial Story", label: "FIELD NOTES", accent: "#3D9BAD", thesis: "The strongest story changes what the audience notices." },
  { fileName: "product-launch.mdx", id: "product-launch", title: "Product Launch", label: "PRODUCT RELEASE", accent: "#16B6D0", thesis: "Show the transformation before listing the features." },
  { fileName: "strategy-proposal.mdx", id: "strategy-proposal", title: "Strategy Proposal", label: "DECISION MEMO", accent: "#2587B5", thesis: "Lead with the decision and make the tradeoff visible." },
  { fileName: "training-workshop.mdx", id: "training-workshop", title: "Training Workshop", label: "LEARNING SESSION", accent: "#21A7BC", thesis: "A workshop succeeds when people can perform the behavior." }
];

for (const [index, style] of catalog.styles.entries()) {
  const direction = {
    ...styleDirections[style.id],
    fileName: path.basename(style.mdxResourcePath),
    id: style.id.toLowerCase(),
    photoOffset: index,
    title: style.name,
    variant: index
  };
  await writeFile(path.join(referenceRoot, direction.fileName), createDeck(direction, true), "utf8");
}
await writeFile(path.join(referenceRoot, "style-catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
for (const [index, direction] of narratives.entries()) {
  await writeFile(path.join(referenceRoot, direction.fileName), createDeck({ ...direction, photoOffset: index + 8, variant: index + 8 }, false), "utf8");
}

process.stdout.write(`Redesigned ${catalog.styles.length} curated styles and ${narratives.length} narrative examples as twelve-page image-led systems.\n`);

function createDeck(direction, isStyle) {
  const story = storyFor(direction.id);
  const d = {
    ...direction,
    ...story,
    accentSoft: "#E7F7FA",
    background: "#FFFFFF",
    body: "Inter",
    display: "Inter",
    muted: "#5A6870",
    photos: Array.from({ length: 4 }, (_, index) => allPhotos[(direction.photoOffset + index * 3) % allPhotos.length]),
    radius: 8,
    text: "#111820"
  };
  const heading = isStyle ? `${d.title} Twelve-Page Style Grammar` : `${d.title} Twelve-Page Reference`;
  return `# ${heading}\n\n${coverSlide(d)}\n\n${agendaSlide(d)}\n\n${profileSlide(d)}\n\n${businessSlide(d)}\n\n${servicesSlide(d)}\n\n${dataSlide(d)}\n\n${cultureSlide(d)}\n\n${caseSlide(d)}\n\n${processSlide(d)}\n\n${comparisonSlide(d)}\n\n${opportunitiesSlide(d)}\n\n${closingSlide(d)}\n`;
}

function storyFor(id) {
  const base = {
    profileTitle: "A clear introduction earns attention for everything that follows.",
    profileBody: "State who the organization serves, the change it creates, and the evidence the audience should remember.",
    businessTitle: "Connect the mission to a visible operating model.",
    servicesTitle: "Four capabilities, one coherent promise.",
    dataTitle: "Put the conclusion next to the evidence.",
    cultureTitle: "Show the people and environment behind the work.",
    caseTitle: "A concrete example makes the system believable.",
    processTitle: "Make the path from intent to outcome easy to follow.",
    comparisonTitle: "Use exact criteria when the audience must compare.",
    opportunityTitle: "Turn the story into a specific opportunity.",
    closingTitle: "End with one memorable direction.",
    closingBody: "Name the next action, owner, and evidence that will guide the following decision.",
    tableCells: "Option|Strength|Tradeoff;Focus|Clear|Narrow;Balance|Flexible|Slower;Scale|Reach|Complex"
  };
  const overrides = {
    "data-brief": { profileTitle: "Begin with the operating question, not the dashboard.", businessTitle: "Separate observation, interpretation, and action.", servicesTitle: "Four signals deserve four different responses.", dataTitle: "The trend points to the intervention.", cultureTitle: "Give every metric an owner and review rhythm.", caseTitle: "One investigated anomaly can change the plan.", processTitle: "Move from signal to test without losing context.", comparisonTitle: "Locate the operating gap.", opportunityTitle: "Convert the strongest signal into an owned experiment.", closingTitle: "One owner. One deadline. One test.", tableCells: "Area|Signal|Action;Activation|Rising|Scale;Retention|Flat|Investigate;Expansion|Mixed|Segment" },
    "editorial-story": { profileTitle: "Open on a human detail the audience can feel.", businessTitle: "Widen the frame until a shared pattern appears.", servicesTitle: "Build the narrative from four deliberate lenses.", dataTitle: "Evidence supports the story without replacing it.", cultureTitle: "Let people carry the emotional memory.", caseTitle: "One scene can reveal the larger system.", processTitle: "Move from moment to pattern to implication.", comparisonTitle: "Contrast the old frame with the new.", opportunityTitle: "Show what becomes possible under the new lens.", closingTitle: "Return to the opening detail with new meaning.", tableCells: "Frame|What we see|Meaning;Surface|One moment|Personal;Pattern|Repeated signal|Shared;Implication|New lens|Actionable" },
    "product-launch": { profileTitle: "Introduce the promise before the product anatomy.", businessTitle: "Frame the old friction in human terms.", servicesTitle: "Four capabilities create one transformed workflow.", dataTitle: "Show the change, not the feature count.", cultureTitle: "Make the team and product principles visible.", caseTitle: "Demonstrate the first useful moment.", processTitle: "Let the audience see the new journey end to end.", comparisonTitle: "Compare the old and new experience.", opportunityTitle: "Invite one concrete first use.", closingTitle: "Make the next useful action obvious.", tableCells: "Moment|Before|After;Start|Search|Guided;Work|Fragmented|Focused;Finish|Uncertain|Confirmed" },
    "strategy-proposal": { profileTitle: "Lead with the decision the audience must make.", businessTitle: "Connect the recommendation to the governing logic.", servicesTitle: "Use four criteria to evaluate every option.", dataTitle: "One option creates the clearest path.", cultureTitle: "Show the owners and capabilities required to execute.", caseTitle: "A bounded pilot makes the strategy testable.", processTitle: "Sequence the commitment into reversible stages.", comparisonTitle: "Make every tradeoff explicit.", opportunityTitle: "Request the smallest approval that unlocks learning.", closingTitle: "Approve the next reversible step.", tableCells: "Option|Speed|Control;Extend|Fast|Medium;Partner|Medium|Low;Build|Slow|High" },
    "training-workshop": { profileTitle: "Define the behavior learners must perform.", businessTitle: "Teach one model before adding complexity.", servicesTitle: "Four learning moves turn information into practice.", dataTitle: "Practice is the evidence of understanding.", cultureTitle: "Make coaching and peer feedback visible.", caseTitle: "A worked example shows what good looks like.", processTitle: "Move from observe to try to apply.", comparisonTitle: "Use criteria learners can apply themselves.", opportunityTitle: "Plan where the behavior will be used next.", closingTitle: "End with an observable commitment.", tableCells: "Stage|Learner does|Facilitator does;See|Observe|Model;Try|Practice|Coach;Use|Apply|Debrief" }
  };
  return { ...base, ...(overrides[id] ?? {}) };
}

function slideOpen(d, duration = 6) {
  return `<Slide duration={${duration}} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" background="${d.background}" theme="light" slideTransition="fade">`;
}

function image(d, slot) {
  return d.photos[slot % d.photos.length];
}

function coverSlide(d) {
  const id = d.id;
  const right = d.id === "s09" || d.variant % 2 === 0;
  const ix = right ? 52 : 0;
  const tx = right ? 7 : 58;
  return `${slideOpen(d, 7)}
  <ImageBlock id="${id}-cover-image" src="${image(d, 0)}" alt="Verified Unsplash cover photograph for ${escapeAttribute(d.title)}" fit="cover" x={${ix}} y={0} w={48} h={100} radius={0} enter="fadeIn" />
  <Text id="${id}-cover-label" x={${tx}} y={12} w={35} h={7} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>${escapeText(d.label)} · EDITABLE PROFILE</Text>
  <Text id="${id}-cover-title" role="title" x={${tx}} y={31} w={36} h={29} color="${d.text}" fontFamily="${d.display}" fontSize={48} fontWeight={790} letterSpacing={-1.15} lineHeight={0.96} enter="rise">${escapeText(d.title)}</Text>
  <Text id="${id}-cover-thesis" x={${tx}} y={69} w={34} h={12} color="${d.muted}" fontFamily="${d.body}" fontSize={12.5} lineHeight={1.4} enter="fadeUp">${escapeText(d.thesis)}</Text>
  <Text id="${id}-cover-meta" x={${tx}} y={88} w={35} h={6} color="${d.muted}" fontFamily="${d.body}" fontSize={8.5} letterSpacing={0.65}>OPENSLIDEX · 12 EDITABLE LAYOUTS · 2026</Text>
</Slide>`;
}

function agendaSlide(d) {
  const id = d.id;
  const items = ["Company overview", "Business content", "Related information", "Work environment", "Company data", "Opportunity"];
  return `${slideOpen(d)}
  <Text id="${id}-agenda-label" x={7} y={10} w={40} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>01 · CONTENTS</Text>
  <Text id="${id}-agenda-title" role="title" x={7} y={42} w={22} h={18} color="${d.text}" fontFamily="${d.display}" fontSize={25} fontWeight={760}>Contents</Text>
  <Text id="${id}-agenda-intro" x={7} y={64} w={22} h={12} color="${d.muted}" fontFamily="${d.body}" fontSize={10.5} lineHeight={1.45}>A compact orientation page for a structured company or report narrative.</Text>
  ${items.map((item, index) => `<Text id="${id}-agenda-number-${index + 1}" x={39} y={${18 + index * 12}} w={5} h={7} color="${d.accent}" fontFamily="${d.body}" fontSize={10.5} fontWeight={760}>0${index + 1}</Text>
  <Text id="${id}-agenda-item-${index + 1}" x={46} y={${18 + index * 12}} w={34} h={7} color="${d.text}" fontFamily="${d.body}" fontSize={12.5} fontWeight={620}>${item}</Text>`).join("\n  ")}
  <Text id="${id}-agenda-page" x={87} y={84} w={6} h={6} color="${d.muted}" fontFamily="${d.body}" fontSize={8.5} textAlign="right">02 / 12</Text>
</Slide>`;
}

function profileSlide(d) {
  const id = d.id;
  const right = d.variant % 3 !== 1;
  const ix = right ? 58 : 7;
  const tx = right ? 7 : 52;
  const tableCells = `Field|Detail;Direction|${d.title};Focus|${d.label};System|12 editable layouts`;
  return `${slideOpen(d, 7)}
  <Text id="${id}-profile-label" x={${tx}} y={9} w={40} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>02 · COMPANY OVERVIEW</Text>
  <Text id="${id}-profile-title" role="title" x={${tx}} y={19} w={42} h={21} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760} lineHeight={1.08}>${escapeText(d.profileTitle)}</Text>
  <Text id="${id}-profile-body" x={${tx}} y={42} w={42} h={13} color="${d.muted}" fontFamily="${d.body}" fontSize={10.5} lineHeight={1.45}>${escapeText(d.profileBody)}</Text>
  <Table id="${id}-profile-table" x={${tx}} y={59} w={42} h={27} rows={4} columns={2} cells="${escapeAttribute(tableCells)}" fontSize={9.5} fontWeight={500} color="${d.text}" background="#FFFFFF" cellBackground="#FFFFFF" stripeBackground="${d.accentSoft}" borderColor="#C8EAF0" borderWidth={1} enter="fadeUp" />
  <ImageBlock id="${id}-profile-image" src="${image(d, 2)}" alt="Verified Unsplash company overview photograph" fit="cover" x={${ix}} y={20} w={35} h={66} radius={6} enter="fadeIn" />
</Slide>`;
}

function businessSlide(d) {
  const id = d.id;
  const imageRight = d.id === "s09" || d.variant % 2 === 0;
  const ix = imageRight ? 7 : 63;
  const tx = imageRight ? 44 : 7;
  const labels = ["Discover", "Design", "Deliver"];
  const bodies = ["Frame the question and the evidence boundary.", "Translate the operating model into a readable system.", "Connect ownership, action, and the next review point."];
  return `${slideOpen(d)}
  <Text id="${id}-business-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>03 · BUSINESS CONTENT</Text>
  <Text id="${id}-business-title" role="title" x={7} y={18} w={70} h={15} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760} lineHeight={1.08}>${escapeText(d.businessTitle)}</Text>
  <ImageBlock id="${id}-business-image" src="${image(d, 3)}" alt="Verified Unsplash photograph establishing the business context" fit="cover" x={${ix}} y={39} w={30} h={48} radius={6} enter="fadeIn" />
  ${labels.map((label, index) => `<Text id="${id}-business-number-${index + 1}" x={${tx}} y={${40 + index * 16}} w={5} h={7} color="${d.accent}" fontFamily="${d.body}" fontSize={10} fontWeight={760}>0${index + 1}</Text>
  <Text id="${id}-business-item-${index + 1}" x={${tx + 7}} y={${39 + index * 16}} w={38} h={8} color="${d.text}" fontFamily="${d.display}" fontSize={14} fontWeight={700}>${label}</Text>
  <Text id="${id}-business-copy-${index + 1}" x={${tx + 7}} y={${47 + index * 16}} w={42} h={7} color="${d.muted}" fontFamily="${d.body}" fontSize={9.5} lineHeight={1.35}>${bodies[index]}</Text>`).join("\n  ")}
</Slide>`;
}

function servicesSlide(d) {
  const id = d.id;
  const chartRight = d.id === "s09" || d.variant % 2 === 0;
  const cx = chartRight ? 7 : 54;
  const sx = chartRight ? 55 : 7;
  const chartType = ["donut", "bar", "line", "area"][d.variant % 4];
  const motion = chartType === "bar" ? "grow" : chartType === "donut" ? "sweep" : "draw";
  return `${slideOpen(d, 7)}
  <Text id="${id}-services-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>04 · RELATED INFORMATION</Text>
  <Text id="${id}-services-title" role="title" x={7} y={18} w={66} h={19} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760}>${escapeText(d.servicesTitle)}</Text>
  <Chart id="${id}-services-chart" type="${chartType}" x={${cx}} y={37} w={39} h={48} data='[{"label":"Core","value":40},{"label":"Growth","value":30},{"label":"Support","value":18},{"label":"Research","value":12}]' palette="ocean" showAxes="false" showLabels="false" ariaLabel="Illustrative capability distribution" chartMotion="${motion}" enter="fadeUp" />
  ${statCard(d, `${id}-service-stat-one`, sx, 38, 38, 21, "32.4", "ILLUSTRATIVE CURRENT VALUE")}
  ${statCard(d, `${id}-service-stat-two`, sx, 64, 38, 21, "60 / 40", "ILLUSTRATIVE COMPOSITION")}
</Slide>`;
}

function dataSlide(d) {
  const id = d.id;
  const labels = ["Remote-friendly", "Flexible roles", "Learning support", "Visible ownership"];
  const bodies = ["Choose the environment that protects focused work.", "Make expectations and decision rights explicit.", "Connect review notes to shared practice.", "Keep the next action and owner easy to find."];
  return `${slideOpen(d, 7)}
  <Text id="${id}-data-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>05 · WORK ENVIRONMENT</Text>
  <Text id="${id}-data-title" role="title" x={7} y={18} w={66} h={15} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760} lineHeight={1.08}>${escapeText(d.cultureTitle)}</Text>
  ${labels.map((label, index) => environmentCard(d, `${id}-environment-${index + 1}`, 7 + index * 22, 42, 19, 44, `0${index + 1}`, label, bodies[index])).join("\n  ")}
</Slide>`;
}

function cultureSlide(d) {
  const id = d.id;
  const imageRight = d.variant % 2 === 0;
  const ix = imageRight ? 56 : 7;
  const tx = imageRight ? 7 : 54;
  return `${slideOpen(d, 7)}
  <ImageBlock id="${id}-culture-image" src="${image(d, 1)}" alt="Verified Unsplash team or workplace photograph" fit="cover" x={${ix}} y={20} w={37} h={67} radius={6} enter="fadeIn" />
  <Text id="${id}-culture-label" x={${tx}} y={9} w={40} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>06 · PEOPLE &amp; CULTURE</Text>
  <Text id="${id}-culture-title" role="title" x={${tx}} y={20} w={39} h={21} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760} lineHeight={1.08}>Show the people behind the operating model.</Text>
  <Text id="${id}-culture-body" x={${tx}} y={43} w={38} h={15} color="${d.muted}" fontFamily="${d.body}" fontSize={10.5} lineHeight={1.45}>${escapeText(d.profileBody)}</Text>
  <Text id="${id}-culture-stat-one" x={${tx}} y={68} w={9} h={10} color="${d.accent}" fontFamily="${d.display}" fontSize={23} fontWeight={780}>01</Text>
  <Text id="${id}-culture-stat-one-label" x={${tx + 10}} y={69} w={12} h={8} color="${d.text}" fontFamily="${d.body}" fontSize={9.5} fontWeight={650}>OWNERSHIP</Text>
  <Text id="${id}-culture-stat-two" x={${tx + 22}} y={68} w={9} h={10} color="${d.accent}" fontFamily="${d.display}" fontSize={23} fontWeight={780}>02</Text>
  <Text id="${id}-culture-stat-two-label" x={${tx + 32}} y={69} w={10} h={8} color="${d.text}" fontFamily="${d.body}" fontSize={9.5} fontWeight={650}>LEARNING</Text>
</Slide>`;
}

function caseSlide(d) {
  const id = d.id;
  const reverse = d.variant % 2 === 1;
  return `${slideOpen(d)}
  <Text id="${id}-case-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>07 · CASE STUDY</Text>
  <Text id="${id}-case-title" role="title" x={7} y={18} w={68} h={19} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760}>${escapeText(d.caseTitle)}</Text>
  <ImageBlock id="${id}-case-image-one" src="${image(d, 2)}" alt="First verified Unsplash case-study photograph" fit="cover" x={${reverse ? 37 : 7}} y={38} w={56} h={49} radius={6} enter="fadeIn" />
  <ImageBlock id="${id}-case-image-two" src="${image(d, 3)}" alt="Second verified Unsplash case-study photograph" fit="cover" x={${reverse ? 7 : 68}} y={38} w={25} h={22} radius={6} enter="fadeIn" />
  <Text id="${id}-case-body" x={${reverse ? 7 : 68}} y={65} w={25} h={20} color="${d.muted}" fontFamily="${d.body}" fontSize={10.5} lineHeight={1.45}>Use a concrete scene, then explain the decision, evidence, and implication it makes visible.</Text>
</Slide>`;
}

function processSlide(d) {
  const id = d.id;
  const labels = ["Frame", "Align", "Build", "Measure"];
  const bodies = ["Name the outcome.", "Choose the criteria.", "Create the system.", "Review the evidence."];
  const imageRight = d.variant % 2 === 0;
  const imageWidth = [24, 27, 30, 25, 28, 23, 29, 26][d.variant % 8];
  const ix = imageRight ? 93 - imageWidth : 7;
  const tx = imageRight ? 7 : 12 + imageWidth;
  const itemStep = 23;
  return `${slideOpen(d, 7)}
  <Text id="${id}-process-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>08 · PROCESS</Text>
  <Text id="${id}-process-title" role="title" x={7} y={18} w={70} h={19} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760}>${escapeText(d.processTitle)}</Text>
  <ImageBlock id="${id}-process-image" src="${image(d, 0)}" alt="Verified Unsplash photograph accompanying the process" fit="cover" x={${ix}} y={39} w={${imageWidth}} h={48} radius={6} enter="fadeIn" />
  ${labels.map((label, index) => `<Text id="${id}-process-number-${index + 1}" x={${tx + (index % 2) * itemStep}} y={${42 + Math.floor(index / 2) * 22}} w={5} h={7} color="${d.accent}" fontFamily="${d.body}" fontSize={10.5} fontWeight={760}>0${index + 1}</Text>
  <Text id="${id}-process-item-${index + 1}" x={${tx + 6 + (index % 2) * itemStep}} y={${41 + Math.floor(index / 2) * 22}} w={17} h={8} color="${d.text}" fontFamily="${d.display}" fontSize={13.5} fontWeight={700}>${label}</Text>
  <Text id="${id}-process-copy-${index + 1}" x={${tx + 6 + (index % 2) * itemStep}} y={${50 + Math.floor(index / 2) * 22}} w={17} h={7} color="${d.muted}" fontFamily="${d.body}" fontSize={9.5}>${bodies[index]}</Text>`).join("\n  ")}
</Slide>`;
}

function comparisonSlide(d) {
  const id = d.id;
  const imageRight = d.variant % 2 === 0;
  return `${slideOpen(d, 7)}
  <Text id="${id}-comparison-label" x={7} y={9} w={60} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>09 · COMPANY DATA</Text>
  <Text id="${id}-comparison-title" role="title" x={7} y={18} w={68} h={19} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760}>${escapeText(d.comparisonTitle)}</Text>
  <Table id="${id}-comparison-table" x={${imageRight ? 7 : 41}} y={38} w={52} h={49} rows={4} columns={3} cells="${escapeAttribute(d.tableCells)}" fontSize={10} fontWeight={520} color="${d.text}" background="#FFFFFF" cellBackground="#FFFFFF" stripeBackground="${d.accentSoft}" borderColor="#C8EAF0" borderWidth={1} enter="fadeUp" />
  <ImageBlock id="${id}-comparison-image" src="${image(d, 3)}" alt="Verified Unsplash company data context photograph" fit="cover" x={${imageRight ? 64 : 7}} y={38} w={29} h={49} radius={6} enter="fadeIn" />
</Slide>`;
}

function opportunitiesSlide(d) {
  const id = d.id;
  const imageRight = d.variant % 3 !== 1;
  const ix = imageRight ? 66 : 7;
  const tx = imageRight ? 7 : 40;
  const cells = "Field|Detail;Role|Named owner;Timing|Next review;Evidence|Defined before approval;Status|Open for decision";
  return `${slideOpen(d, 7)}
  <Text id="${id}-opportunity-label" x={${tx}} y={9} w={54} h={6} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>10 · OPPORTUNITY</Text>
  <Text id="${id}-opportunity-title" role="title" x={${tx}} y={18} w={53} h={20} color="${d.text}" fontFamily="${d.display}" fontSize={25.5} fontWeight={760} lineHeight={1.08}>${escapeText(d.opportunityTitle)}</Text>
  <Table id="${id}-opportunity-table" x={${tx}} y={43} w={52} h={43} rows={5} columns={2} cells="${cells}" fontSize={9.5} fontWeight={520} color="${d.text}" background="#FFFFFF" cellBackground="#FFFFFF" stripeBackground="${d.accentSoft}" borderColor="#C8EAF0" borderWidth={1} enter="fadeUp" />
  <ImageBlock id="${id}-opportunity-image" src="${image(d, 1)}" alt="Verified Unsplash opportunity or recruiting photograph" fit="cover" x={${ix}} y={21} w={27} h={65} radius={6} enter="fadeIn" />
</Slide>`;
}

function closingSlide(d) {
  const id = d.id;
  const right = d.id === "s09" || d.variant % 2 === 0;
  const ix = right ? 52 : 0;
  const tx = right ? 7 : 58;
  return `${slideOpen(d, 7)}
  <ImageBlock id="${id}-closing-image" src="${image(d, 0)}" alt="Verified Unsplash closing photograph" fit="cover" x={${ix}} y={0} w={48} h={100} radius={0} enter="fadeIn" />
  <Text id="${id}-closing-label" x={${tx}} y={12} w={35} h={7} color="${d.accent}" fontFamily="${d.body}" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>11 · NEXT DIRECTION</Text>
  <Text id="${id}-closing-title" role="title" x={${tx}} y={34} w={36} h={31} color="${d.text}" fontFamily="${d.display}" fontSize={30} fontWeight={770} lineHeight={1.06}>${escapeText(d.closingTitle)}</Text>
  <Text id="${id}-closing-body" x={${tx}} y={68} w={34} h={14} color="${d.muted}" fontFamily="${d.body}" fontSize={11.5} lineHeight={1.42}>${escapeText(d.closingBody)}</Text>
  <Text id="${id}-closing-meta" x={${tx}} y={88} w={35} h={6} color="${d.muted}" fontFamily="${d.body}" fontSize={8.5}>OPENSLIDEX · EDITABLE NATIVE LAYERS</Text>
</Slide>`;
}

function environmentCard(d, id, x, y, w, h, index, title, body) {
  const group = `${id}-card-group`;
  return `<Shape id="${id}-card" groupId="${group}" groupName="${escapeAttribute(title)} card" shape="rectangle" x={${x}} y={${y}} w={${w}} h={${h}} fill="${d.accentSoft}" stroke="${d.accent}" strokeWidth={1} radius={10} enter="fadeUp" />
  <Text id="${id}-index" groupId="${group}" groupName="${escapeAttribute(title)} card" x={${x + 2}} y={${y + 3}} w={${w - 4}} h={7} color="${d.accent}" fontFamily="${d.display}" fontSize={14} fontWeight={780}>${escapeText(index)}</Text>
  <Text id="${id}-title" groupId="${group}" groupName="${escapeAttribute(title)} card" x={${x + 2}} y={${y + 13}} w={${w - 4}} h={9} color="${d.text}" fontFamily="${d.display}" fontSize={12.5} fontWeight={700}>${escapeText(title)}</Text>
  <Text id="${id}-body" groupId="${group}" groupName="${escapeAttribute(title)} card" x={${x + 2}} y={${y + 25}} w={${w - 4}} h={${h - 28}} color="${d.muted}" fontFamily="${d.body}" fontSize={9.2} lineHeight={1.35}>${escapeText(body)}</Text>`;
}

function statCard(d, id, x, y, w, h, value, label) {
  const group = `${id}-card-group`;
  return `<Shape id="${id}-card" groupId="${group}" groupName="${escapeAttribute(label)} card" shape="rectangle" x={${x}} y={${y}} w={${w}} h={${h}} fill="${d.accentSoft}" stroke="${d.accent}" strokeWidth={1} radius={8} enter="fadeUp" />
  <Text id="${id}-value" groupId="${group}" groupName="${escapeAttribute(label)} card" x={${x + 3}} y={${y + 2.5}} w={${w - 6}} h={11} color="${d.accent}" fontFamily="${d.display}" fontSize={25} fontWeight={790}>${escapeText(value)}</Text>
  <Text id="${id}-label" groupId="${group}" groupName="${escapeAttribute(label)} card" x={${x + 3}} y={${y + 14}} w={${w - 6}} h={5} color="${d.text}" fontFamily="${d.body}" fontSize={9} fontWeight={680} letterSpacing={0.6}>${escapeText(label)}</Text>`;
}

function escapeText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}
