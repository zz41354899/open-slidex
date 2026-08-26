import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repositoryRoot, "packages/slidex-workbench/skills/slidex-deck-design/references");

const photos = [
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1600&auto=format&fit=crop&q=82",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1600&auto=format&fit=crop&q=82"
];

const decks = [
  {
    id: "consulting-financial-report", file: "consulting-financial-report.mdx", title: "Consulting Financial Report", label: "BOARD DECISION", thesis: "Make risk, evidence, and action easy to audit.",
    accent: "#0A8FA5", soft: "#E2F4F4", bg: "#F7FAFA", dark: "#091923", text: "#10232B", muted: "#53676D", photo: 2,
    titles: ["From signal to a funded decision.", "Make the meeting answer three questions.", "Frame the board decision before opening the model.", "Put the reporting perimeter on one quiet page.", "Use the scorecard to orient, not to conclude.", "Revenue needs a driver, not just a variance.", "A bridge must reconcile start, drivers, and end.", "Cash is a sequence of triggers, not a single balance.", "Mix reveals where quality of growth is changing.", "Put comparable channels on one shared scale.", "Manage concentration before renewal risk becomes a surprise.", "Reconcile performance before debating the forecast.", "Cash conversion now sets the operating pace.", "Show actual, plan, and prior period on one defensible scale.", "Every KPI needs a period, unit, source, and status.", "The operating context explains why the number moved.", "Separate baseline, upside, and downside assumptions.", "Volume, price, and mix point to different actions.", "One reconciled variance can change the capital plan.", "Fund the proven driver and pre-commit the downside response.", "Use value, confidence, and reversibility to allocate capital.", "Connect each threshold to an owner and review date.", "Act before downside reaches the liquidity trigger.", "Compare defend, fund, and defer on one shared basis.", "Fund the highest-confidence driver behind a measurable gate.", "Turn approval into a ninety-day evidence plan.", "Visible ownership keeps the decision live after the meeting.", "Track the few conditions that can invalidate the thesis.", "Document definitions, sources, and what the analysis cannot say.", "Decision. Owner. Evidence. Next review."]
  },
  {
    id: "data-brief", file: "data-brief.mdx", title: "Data Brief", label: "OPERATING BRIEF", thesis: "A useful dashboard ends in a decision.",
    accent: "#149BB4", soft: "#E7F7FA", bg: "#FFFFFF", dark: "#0A2530", text: "#111820", muted: "#5A6870", photo: 0,
    titles: ["A useful dashboard ends in a decision.", "Orient the audience around the operating question.", "Begin with the question, not the dashboard.", "Define the population, period, and denominator.", "Use the scorecard to locate the exception.", "Show the first trend that changes the operating view.", "Compare cohorts before treating the mean as normal.", "Separate activation, retention, and expansion drivers.", "Make missing values and definitions visible.", "Show where the signal enters the real workflow.", "Give every metric an owner and review rhythm.", "Move from dashboard orientation to actionable anomalies.", "The exception matters more than the average.", "Pair the trend with the event that explains it.", "Keep denominator, cohort, and missing values visible.", "One workflow scene can explain the metric.", "Compare before and after with one shared definition.", "Separate drivers before choosing an intervention.", "One investigated anomaly can change the operating plan.", "Turn the strongest signal into an owned experiment.", "Prioritize by impact, confidence, and effort.", "Give each metric a cadence and escalation path.", "A metric becomes risky when nobody owns the threshold.", "Compare observe, test, and scale on the same evidence.", "Run the smallest experiment that can change the decision.", "Move from baseline to test to scaled practice.", "Name the owner, milestone, and stop condition.", "Monitor the leading signal, not only the lagging result.", "Preserve method, caveats, and source dates.", "One owner. One deadline. One test."]
  },
  {
    id: "editorial-story", file: "editorial-story.mdx", title: "Editorial Story", label: "FIELD NOTES", thesis: "The strongest story changes what the audience notices.",
    accent: "#B36A4C", soft: "#F6ECE6", bg: "#FBF8F3", dark: "#281D18", text: "#241D19", muted: "#6F625B", photo: 1,
    titles: ["Begin with a detail the audience can feel.", "Orient the story without explaining it away.", "Open on one human moment.", "Name the setting, voice, and evidence boundary.", "Let the first pattern emerge slowly.", "Use evidence to reveal recurrence.", "Contrast the inherited frame with the new lens.", "Show the forces shaping the pattern.", "Keep scene, pattern, and implication distinct.", "Let the environment carry texture.", "Return to people whenever the story becomes abstract.", "Widen the frame from one moment to a shared pattern.", "One detail can carry the emotional memory.", "Reveal recurrence without flattening the people.", "Keep every observation traceable to its source.", "A concrete scene makes the system visible.", "Contrast what was noticed before and after.", "Show causality without pretending certainty.", "A field note can explain the wider system.", "Turn recognition into a new way of seeing.", "Connect moment, pattern, and implication.", "Give the story a carrier, ritual, and next encounter.", "Protect the story from unsupported universality.", "Compare possible frames by truth and usefulness.", "Choose the lens that changes what people notice.", "Sequence reveal, evidence, reflection, and commitment.", "Name who carries the story forward.", "Look for the behavior that proves it landed.", "State sources, voices, limits, and unresolved tensions.", "Return to the opening detail with new meaning."]
  },
  {
    id: "product-launch", file: "product-launch.mdx", title: "Product Launch", label: "PRODUCT RELEASE", thesis: "Show the transformation before listing the features.",
    accent: "#6C5CE7", soft: "#EEEAFE", bg: "#FBFAFF", dark: "#15132D", text: "#17152A", muted: "#625E78", photo: 2,
    titles: ["Show the transformation before the feature list.", "Orient the launch around one customer promise.", "Introduce the promise before the product anatomy.", "Name the user, moment, and old constraint.", "Make the old friction unmistakable.", "Reveal the first useful product moment.", "Compare the old and new experience.", "Connect capabilities to one transformed workflow.", "Use proof, not feature count.", "Put the product inside the work it changes.", "Align the launch team around customer evidence.", "Move from promise to the first useful proof.", "Time to first value is the launch metric that matters.", "Show adoption as a sequence, not a vanity total.", "Tie every capability to a user moment and proof.", "A credible use context makes the promise tangible.", "Make before and after impossible to confuse.", "Separate reach, activation, and retained use.", "One first-use moment can make the promise believable.", "Turn launch attention into repeated customer value.", "Connect promise, proof, habit, and expansion.", "Align product, sales, success, and support.", "Treat weak activation as a product risk.", "Compare broad launch, focused cohort, and staged rollout.", "Launch where the clearest customer proof can emerge.", "Sequence readiness, release, adoption, and learning.", "Give every adoption milestone an owner.", "Track retained use after attention fades.", "Document evidence sources, cohorts, and limitations.", "Make the next useful action obvious."]
  },
  {
    id: "strategy-proposal", file: "strategy-proposal.mdx", title: "Strategy Proposal", label: "DECISION MEMO", thesis: "Lead with the decision and make the trade-off visible.",
    accent: "#2587B5", soft: "#E7F2F7", bg: "#F8FAFB", dark: "#0B1E2D", text: "#10212D", muted: "#596B76", photo: 3,
    titles: ["Lead with the decision the audience must make.", "Orient the choice around explicit criteria.", "Frame the recommendation before the analysis.", "Define scope, constraints, and decision rights.", "Show why the status quo no longer earns inaction.", "Name the strategic opportunity and evidence.", "Compare options with one set of criteria.", "Make every trade-off visible.", "Identify the conditions that make one option win.", "Ground strategy in operating reality.", "Make a bounded pilot test the thesis.", "Move from context to the trade-off the audience must own.", "Value matters only if commitment stays reversible.", "Show the trajectory that makes action necessary.", "Score every option with the same criteria.", "A real operating scene makes abstraction testable.", "Put value, control, speed, and risk on one page.", "Separate assumptions that drive the choice.", "A bounded pilot can make a claim testable.", "Approve the smallest reversible move that unlocks learning.", "Use value, confidence, and reversibility.", "Translate the choice into rights and milestones.", "Pre-commit the stop condition before funding.", "Show why alternatives lose, not only why one wins.", "Recommend one option with an explicit boundary.", "Sequence proof before scale and scale before lock-in.", "Assign every decision gate to one owner.", "Track the assumption most likely to invalidate the strategy.", "Document sources, scoring method, and limitations.", "Approve the next reversible step."]
  },
  {
    id: "training-workshop", file: "training-workshop.mdx", title: "Training Workshop", label: "LEARNING SESSION", thesis: "A workshop succeeds when people can perform the behavior.",
    accent: "#2C9C78", soft: "#E8F5EF", bg: "#FAFCF8", dark: "#153027", text: "#17251F", muted: "#5D6D65", photo: 6,
    titles: ["Define the behavior learners must perform.", "Orient the session around an observable outcome.", "Start with the real situation learners face.", "Set expectations, safety, and evidence of learning.", "Teach one model before adding complexity.", "Demonstrate what good looks like.", "Compare novice and proficient choices.", "Break the behavior into practiceable moves.", "Use criteria learners can apply themselves.", "Let learners see the behavior in context.", "Make coaching and peer feedback visible.", "Move from explanation to observable performance.", "Practice is the evidence of understanding.", "Show progress across attempts, not attendance.", "Connect objective, activity, evidence, and feedback.", "A credible setting makes the behavior memorable.", "Contrast choices using visible criteria.", "Separate knowledge, practice, feedback, and transfer.", "A worked example makes quality observable.", "Move the new behavior from the room into real work.", "Use observe, try, feedback, and apply.", "Give facilitator, peer, and learner distinct roles.", "The main risk is fluency without transfer.", "Compare demonstration, guided practice, and application.", "End with one behavior performed in context.", "Sequence preparation, practice, coaching, and follow-up.", "Make the transfer owner and review date explicit.", "Measure behavior in context, not satisfaction alone.", "Document objectives, evidence, access needs, and limits.", "End with an observable commitment."]
  }
];

for (const deck of decks) {
  if (deck.titles.length !== 30) throw new Error(`${deck.id} must define exactly 30 slide titles.`);
  await writeFile(path.join(outputRoot, deck.file), createDeck(deck), "utf8");
}

process.stdout.write(`Built ${decks.length} core decks with ${decks.length * 30} editable slides.\n`);

function createDeck(deck) {
  const slides = deck.titles.map((title, index) => renderSlide(deck, index + 1, title));
  return `# ${deck.title} Thirty-Page Reference\n\n${slides.join("\n\n")}\n`;
}

function renderSlide(d, page, title) {
  if (page === 1) return cover(d, title);
  if (page === 30) return close(d, page, title);
  if ([12, 20].includes(page)) return section(d, page, title);
  if ([4, 10, 16, 19, 25].includes(page)) return imageClaim(d, page, title);
  if ([5, 11, 15, 22, 23, 24, 26, 27, 29].includes(page)) return tableSlide(d, page, title);
  if ([6, 9, 14, 18, 28].includes(page)) return chartSlide(d, page, title);
  if ([7, 17].includes(page)) return compare(d, page, title);
  if ([8, 21].includes(page)) return framework(d, page, title);
  if (page === 13) return metric(d, page, title);
  return statement(d, page, title);
}

function open(d, dark = false, transition = "fade") {
  return `<Slide duration={7} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" background="${dark ? d.dark : d.bg}" theme="${dark ? "dark" : "light"}" slideTransition="${transition}">`;
}

function cover(d, title) {
  const imageRight = d.photo % 2 === 0;
  return `${open(d)}
  <ImageBlock id="${d.id}-01-image" src="${photos[d.photo]}" alt="Verified Unsplash cover photograph for ${attr(d.title)}" fit="cover" x={${imageRight ? 55 : 0}} y={0} w={45} h={100} radius={0} enter="fadeIn" />
  <Text id="${d.id}-01-label" x={${imageRight ? 7 : 54}} y={13} w={39} h={6} color="${d.accent}" fontFamily="Inter" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>${text(d.label)} · EDITABLE REFERENCE</Text>
  <Text id="${d.id}-01-title" role="title" x={${imageRight ? 7 : 54}} y={31} w={39} h={29} color="${d.text}" fontFamily="Inter" fontSize={39} fontWeight={790} lineHeight={1.0} enter="rise">${text(title)}</Text>
  <Text id="${d.id}-01-thesis" x={${imageRight ? 7 : 54}} y={69} w={37} h={12} color="${d.muted}" fontFamily="Inter" fontSize={12} lineHeight={1.4} enter="fadeUp">${text(d.thesis)}</Text>
  <Text id="${d.id}-01-meta" x={${imageRight ? 7 : 54}} y={89} w={39} h={5} color="${d.muted}" fontFamily="Inter" fontSize={8.5}>OPENSLIDEX · 30 NATIVE EDITABLE SLIDES · 01 / 30</Text>
</Slide>`;
}

function statement(d, page, title) {
  return `${open(d)}
  ${heading(d, page, title)}
  <Text id="${d.id}-${pad(page)}-statement" x={7} y={47} w={54} h={20} color="${d.accent}" fontFamily="Inter" fontSize={22} fontWeight={730} lineHeight={1.18} enter="rise">One claim, one proof, one implication.</Text>
  <Text id="${d.id}-${pad(page)}-body" x={68} y={46} w={25} h={24} color="${d.muted}" fontFamily="Inter" fontSize={11} lineHeight={1.45} enter="fadeUp">Replace this teaching copy with sourced evidence. Keep observation, interpretation, and action visually distinct.</Text>
  ${footer(d, page)}
</Slide>`;
}

function section(d, page, title) {
  return `${open(d, true, "wipe")}
  <Text id="${d.id}-${pad(page)}-label" x={7} y={16} w={40} h={6} color="${d.accent}" fontFamily="Inter" fontSize={10} fontWeight={760} letterSpacing={1.6}>SECTION · ${pad(page)}</Text>
  <Text id="${d.id}-${pad(page)}-title" role="title" x={7} y={36} w={77} h={27} color="#F7FBFC" fontFamily="Inter" fontSize={35} fontWeight={780} lineHeight={1.04} enter="rise">${text(title)}</Text>
  <Text id="${d.id}-${pad(page)}-body" x={7} y={72} w={50} h={10} color="#BECACD" fontFamily="Inter" fontSize={11.5} lineHeight={1.4}>A quiet chapter reset creates rhythm across a long presentation.</Text>
  <Text id="${d.id}-${pad(page)}-page" x={87} y={90} w={6} h={4} color="${d.accent}" fontFamily="Inter" fontSize={8.5} textAlign="right">${pad(page)} / 30</Text>
</Slide>`;
}

function imageClaim(d, page, title) {
  const right = (page + d.photo) % 2 === 0;
  const imageIndex = (d.photo + page) % photos.length;
  return `${open(d)}
  <ImageBlock id="${d.id}-${pad(page)}-image" src="${photos[imageIndex]}" alt="Verified Unsplash contextual photograph for slide ${page}" fit="cover" x={${right ? 55 : 0}} y={0} w={45} h={100} radius={0} enter="fadeIn" />
  <Text id="${d.id}-${pad(page)}-label" x={${right ? 7 : 54}} y={13} w={39} h={6} color="${d.accent}" fontFamily="Inter" fontSize={9} fontWeight={760} letterSpacing={1.4}>${pad(page)} · CONTEXT</Text>
  <Text id="${d.id}-${pad(page)}-title" role="title" x={${right ? 7 : 54}} y={33} w={39} h={28} color="${d.text}" fontFamily="Inter" fontSize={30} fontWeight={780} lineHeight={1.05} enter="rise">${text(title)}</Text>
  <Text id="${d.id}-${pad(page)}-body" x={${right ? 7 : 54}} y={69} w={36} h={14} color="${d.muted}" fontFamily="Inter" fontSize={11.5} lineHeight={1.45}>Use imagery for evidence, setting, emotion, or memory—not decoration.</Text>
  <Text id="${d.id}-${pad(page)}-page" x={${right ? 7 : 87}} y={90} w={6} h={4} color="${d.muted}" fontFamily="Inter" fontSize={8.5}>${pad(page)} / 30</Text>
</Slide>`;
}

function tableSlide(d, page, title) {
  const dark = page === 23;
  const color = dark ? "#F7FBFC" : d.text;
  return `${open(d, dark)}
  ${heading(d, page, title, dark)}
  <Table id="${d.id}-${pad(page)}-table" x={7} y={42} w={86} h={36} rows={4} columns={4} cells="Item|Evidence|Implication|Owner;Primary|Illustrative|Replace with source|Named;Secondary|Illustrative|Replace with source|Named;Boundary|Illustrative|State limitation|Named" fontSize={10} fontWeight={520} color="${color}" background="${dark ? d.dark : d.bg}" cellBackground="${dark ? "#17313A" : d.soft}" stripeBackground="${dark ? "#102731" : d.bg}" borderColor="${d.accent}" borderWidth={1} enter="fadeUp" />
  ${footer(d, page, dark)}
</Slide>`;
}

function chartSlide(d, page, title) {
  const type = page === 9 ? "donut" : page === 18 ? "bar" : page === 28 ? "area" : "line";
  const motion = type === "bar" ? "grow" : type === "donut" ? "sweep" : "draw";
  return `${open(d)}
  ${heading(d, page, title)}
  <Chart id="${d.id}-${pad(page)}-chart" type="${type}" x={7} y={42} w={59} h={40} data='[{"label":"A","value":42},{"label":"B","value":57},{"label":"C","value":49},{"label":"D","value":68}]' palette="ocean" showAxes="true" showLabels="true" ariaLabel="Illustrative chart; replace with verified data" chartMotion="${motion}" enter="fadeUp" />
  <Text id="${d.id}-${pad(page)}-insight" x={73} y={45} w={18} h={22} color="${d.text}" fontFamily="Inter" fontSize={16} fontWeight={720} lineHeight={1.25}>Put the conclusion beside the evidence.</Text>
  <Text id="${d.id}-${pad(page)}-source" x={73} y={72} w={18} h={9} color="${d.muted}" fontFamily="Inter" fontSize={8.5} lineHeight={1.4}>ILLUSTRATIVE · replace unit, period, source, and status.</Text>
</Slide>`;
}

function compare(d, page, title) {
  return `${open(d)}
  ${heading(d, page, title)}
  ${card(d, `${d.id}-${pad(page)}-left`, 7, 43, "CURRENT", "State the observed condition and its evidence boundary.")}
  ${card(d, `${d.id}-${pad(page)}-right`, 52, 43, "TARGET", "State the changed condition and proof required.")}
  ${footer(d, page)}
</Slide>`;
}

function framework(d, page, title) {
  return `${open(d)}
  ${heading(d, page, title)}
  ${["Frame", "Evidence", "Choice", "Commit"].map((name, index) => compactCard(d, `${d.id}-${pad(page)}-${index + 1}`, 7 + index * 22, 44, `0${index + 1}`, name)).join("\n  ")}
  ${footer(d, page)}
</Slide>`;
}

function metric(d, page, title) {
  return `${open(d)}
  ${heading(d, page, title)}
  <Text id="${d.id}-${pad(page)}-value" x={7} y={44} w={36} h={23} color="${d.accent}" fontFamily="Inter" fontSize={52} fontWeight={800} letterSpacing={-1.4} enter="rise">72</Text>
  <Text id="${d.id}-${pad(page)}-value-label" x={7} y={69} w={35} h={6} color="${d.muted}" fontFamily="Inter" fontSize={9} fontWeight={700} letterSpacing={1}>ILLUSTRATIVE SIGNAL INDEX</Text>
  <Chart id="${d.id}-${pad(page)}-chart" type="bar" x={51} y={42} w={42} h={39} data='[{"label":"Base","value":44},{"label":"Now","value":72},{"label":"Gate","value":61}]' palette="ocean" showAxes="true" showLabels="true" ariaLabel="Illustrative hero metric comparison" chartMotion="grow" enter="fadeUp" />
  ${footer(d, page)}
</Slide>`;
}

function close(d, page, title) {
  const right = d.photo % 2 === 0;
  return `${open(d, true)}
  <ImageBlock id="${d.id}-30-image" src="${photos[d.photo]}" alt="Verified Unsplash closing photograph for ${attr(d.title)}" fit="cover" x={${right ? 55 : 0}} y={0} w={45} h={100} radius={0} enter="fadeIn" />
  <Text id="${d.id}-30-label" x={${right ? 7 : 54}} y={13} w={39} h={6} color="${d.accent}" fontFamily="Inter" fontSize={9.5} fontWeight={760} letterSpacing={1.5}>30 · CLOSE</Text>
  <Text id="${d.id}-30-title" role="title" x={${right ? 7 : 54}} y={34} w={39} h={27} color="#F7FBFC" fontFamily="Inter" fontSize={34} fontWeight={790} lineHeight={1.04} enter="rise">${text(title)}</Text>
  <Text id="${d.id}-30-body" x={${right ? 7 : 54}} y={69} w={36} h={14} color="#C4CFD2" fontFamily="Inter" fontSize={11.5} lineHeight={1.45}>Replace the teaching copy with the real commitment, owner, evidence, and next review date.</Text>
  <Text id="${d.id}-30-page" x={${right ? 7 : 87}} y={90} w={6} h={4} color="${d.accent}" fontFamily="Inter" fontSize={8.5}>30 / 30</Text>
</Slide>`;
}

function heading(d, page, title, dark = false) {
  return `<Text id="${d.id}-${pad(page)}-label" x={7} y={10} w={45} h={5} color="${d.accent}" fontFamily="Inter" fontSize={9} fontWeight={760} letterSpacing={1.4}>${pad(page)} · ${text(d.label)}</Text>
  <Text id="${d.id}-${pad(page)}-title" role="title" x={7} y={20} w={72} h={15} color="${dark ? "#F7FBFC" : d.text}" fontFamily="Inter" fontSize={28} fontWeight={780} lineHeight={1.08}>${text(title)}</Text>`;
}

function footer(d, page, dark = false) {
  return `<Text id="${d.id}-${pad(page)}-footer" x={7} y={88} w={86} h={5} color="${dark ? "#B8C7CB" : d.muted}" fontFamily="Inter" fontSize={8.5}>ILLUSTRATIVE TEACHING CONTENT · REPLACE WITH VERIFIED EVIDENCE · ${pad(page)} / 30</Text>`;
}

function card(d, id, x, y, label, body) {
  const group = `${id}-card-group`;
  return `<Shape id="${id}-card" groupId="${group}" groupName="${label} card" shape="rectangle" x={${x}} y={${y}} w={41} h={35} fill="${d.soft}" stroke="${d.accent}" strokeWidth={1} radius={10} enter="fadeUp" />
  <Text id="${id}-label" groupId="${group}" groupName="${label} card" x={${x + 3}} y={${y + 4}} w={35} h={6} color="${d.accent}" fontFamily="Inter" fontSize={9} fontWeight={760} letterSpacing={1}>${label}</Text>
  <Text id="${id}-body" groupId="${group}" groupName="${label} card" x={${x + 3}} y={${y + 14}} w={35} h={16} color="${d.text}" fontFamily="Inter" fontSize={14} fontWeight={680} lineHeight={1.3}>${text(body)}</Text>`;
}

function compactCard(d, id, x, y, index, title) {
  const group = `${id}-card-group`;
  return `<Shape id="${id}-card" groupId="${group}" groupName="${title} card" shape="rectangle" x={${x}} y={${y}} w={19} h={33} fill="${d.soft}" stroke="${d.accent}" strokeWidth={1} radius={9} enter="fadeUp" />
  <Text id="${id}-index" groupId="${group}" groupName="${title} card" x={${x + 2}} y={${y + 4}} w={15} h={7} color="${d.accent}" fontFamily="Inter" fontSize={13} fontWeight={780}>${index}</Text>
  <Text id="${id}-title" groupId="${group}" groupName="${title} card" x={${x + 2}} y={${y + 16}} w={15} h={8} color="${d.text}" fontFamily="Inter" fontSize={12.5} fontWeight={720}>${title}</Text>
  <Text id="${id}-body" groupId="${group}" groupName="${title} card" x={${x + 2}} y={${y + 25}} w={15} h={5} color="${d.muted}" fontFamily="Inter" fontSize={8.5}>One clear job.</Text>`;
}

function pad(value) { return String(value).padStart(2, "0"); }
function text(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function attr(value) { return text(value).replaceAll('"', "&quot;"); }
