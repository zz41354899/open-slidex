import assert from "node:assert/strict";
import test from "node:test";

import { buildMotionDocHtml, parseMotionDoc, summarizeMotionDoc } from "./index";

test("HtmlEmbedBlock supports one persistent source mapped across pages", () => {
  const source = `# Shared HTML

<Slide><HtmlEmbedBlock id="html-1" src="assets/source.html" sharedScene="html" page={1} /></Slide>
<Slide><HtmlEmbedBlock id="html-2" src="assets/source.html" sharedScene="html" page={2} /></Slide>`;
  const document = parseMotionDoc(source);
  assert.equal(document.scenes.length, 2);
  assert.deepEqual(document.scenes.map((scene) => scene.blocks[0]?.props.page), [1, 2]);
  assert.equal(summarizeMotionDoc(source).validation.isValid, true);
  const html = buildMotionDocHtml(source);
  assert.equal(html.match(/data-html-shared-scene="html"/g)?.length, 1);
  assert.match(html, /class="block-html-embed"/);
  assert.match(html, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
  assert.match(html, /sandbox="[^"]*allow-downloads[^"]*allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin/);
  assert.match(html, /open-slidex:html-page/);
  assert.doesNotMatch(html, /Interactive HTML is available only/);
});

test("HtmlEmbedBlock rejects Base64 HTML and keeps document source as an asset path", () => {
  const portableHtml = `data:text/html;base64,${Buffer.from("<!doctype html><html><body>Portable</body></html>").toString("base64")}`;
  const source = `# Portable HTML

<Slide>
  <HtmlEmbedBlock id="html" src="${portableHtml}" page={1} />
  <HtmlEmbedBlock id="asset" src="assets/source.html" page={1} />
</Slide>`;
  const document = parseMotionDoc(source);
  assert.equal(document.scenes[0]?.blocks[0]?.props.src, "");
  assert.equal(document.scenes[0]?.blocks[1]?.props.src, "assets/source.html");
  const exported = buildMotionDocHtml(source);
  assert.doesNotMatch(exported, /data:text\/html;base64/i);
  assert.match(exported, /src="assets\/source\.html"/);
  assert.match(exported, /script-src 'unsafe-inline'[^;]+https:/);
  assert.match(exported, /connect-src[^;]+wss:/);
});

test("HtmlEmbedBlock shared pages require one source and positive integer pages", () => {
  const invalid = `# Invalid shared HTML

<Slide><HtmlEmbedBlock id="html-1" src="assets/a.html" sharedScene="html" page={0} /></Slide>
<Slide><HtmlEmbedBlock id="html-2" src="assets/b.html" sharedScene="html" page={2.5} /></Slide>`;
  const issues = summarizeMotionDoc(invalid).validation.issues;
  assert.ok(issues.some((issue) => /same src/.test(issue.message)));
  assert.equal(issues.filter((issue) => /positive integer/.test(issue.message)).length, 2);
});
