import assert from "node:assert/strict";
import test from "node:test";

import { buildMotionDocHtml, generateSlideString, parseMotionDoc, summarizeMotionDoc } from "./index";

const source = `# Shared SVG

<Slide>
  <SvgBlock id="tree-1" src="assets/tree.svg" sharedScene="tree" stage={1} stageDuration={0.7} x={10} y={10} w={80} h={80} />
</Slide>
<Slide>
  <SvgBlock id="tree-2" src="assets/tree.svg" sharedScene="tree" stage={2} stageDuration={1.2} x={5} y={5} w={90} h={90} />
</Slide>`;

test("SvgBlock parses, serializes, and exports one persistent shared scene", () => {
  const document = parseMotionDoc(source);
  assert.equal(document.scenes[0]?.blocks[0]?.type, "SvgBlock");
  assert.match(generateSlideString(document.scenes[0]!), /<SvgBlock[^>]+sharedScene="tree"[^>]+stage=\{1\}/);
  const html = buildMotionDocHtml(source);
  assert.equal(html.match(/data-svg-shared-scene="tree"/g)?.length, 1);
  assert.match(html, /data-svg-shared-declarations=/);
  assert.match(html, /function applySvgStage/);
  assert.match(html, /prefers-reduced-motion/);
});

test("SvgBlock validation enforces unique ids and one source per shared scene", () => {
  const invalid = source
    .replace('id="tree-2"', 'id="tree-1"')
    .replace('src="assets/tree.svg" sharedScene="tree" stage={2}', 'src="assets/other.svg" sharedScene="tree" stage={2.5}');
  const issues = summarizeMotionDoc(invalid).validation.issues;
  assert.ok(issues.some((issue) => /unique across the deck/.test(issue.message)));
  assert.ok(issues.some((issue) => /must use the same src/.test(issue.message)));
  assert.ok(issues.some((issue) => /non-negative integer/.test(issue.message)));
});

