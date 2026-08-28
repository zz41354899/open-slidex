import assert from "node:assert/strict";
import test from "node:test";
import {
  autoLinkSharedMorphSequenceScenes,
  autoLinkSharedMorphScenes,
  buildMotionDocHtml,
  hasSharedMorphReturnLink,
  interpolateShapeMorphPath,
  parseInteraction,
  parseMotionDoc,
  shapeMorphPoints,
  setSharedMorphReturnLinkScenes,
  sharedMorphEffectProps,
  summarizeMotionDoc,
  unlinkSharedMorphGroupScenes
} from "./index";

test("Morph setup auto-links compatible layers while preserving independent block ids", () => {
  const document = parseMotionDoc(`# Auto pair\n\n<Slide><Text id="one" name="Hero" x={10} y={10} w={30} h={10}>Hello</Text><Shape id="shape-one" shape="circle" x={10} y={30} w={20} h={20} /></Slide>\n\n<Slide><Text id="two" name="Hero" x={20} y={8} w={50} h={16}>Hello</Text><Shape id="shape-two" shape="diamond" x={50} y={35} w={28} h={28} /></Slide>`);
  const [source, target] = autoLinkSharedMorphScenes(document.scenes[0]!, document.scenes[1]!);
  assert.equal(source.blocks[0]?.props.sharedId, target.blocks[0]?.props.sharedId);
  assert.equal(source.blocks[1]?.props.sharedId, target.blocks[1]?.props.sharedId);
  assert.notEqual(source.blocks[0]?.props.id, target.blocks[0]?.props.id);
});

test("Morph setup links every adjacent edge in a multi-slide sequence", () => {
  const document = parseMotionDoc(`<Slide slideTransition="morph"><Text id="one">Planet</Text></Slide><Slide slideTransition="morph"><Text id="two">Planet</Text></Slide><Slide><Text id="three">Planet</Text></Slide>`);
  const scenes = autoLinkSharedMorphSequenceScenes(document.scenes, 0, 2);
  assert.equal(scenes[0]?.blocks[0]?.props.sharedId, scenes[1]?.blocks[0]?.props.sharedId);
  assert.equal(scenes[1]?.blocks[0]?.props.sharedId, scenes[2]?.blocks[0]?.props.sharedId);
  assert.equal(summarizeMotionDoc(sequenceSource(scenes)).validation.isValid, true);
});

test("later Morph edges can inherit the overview effect in preview and HTML export", () => {
  const source = `<Slide slideTransition="morph" morphEasing="spring" transitionDuration={1.1} morphShapeSoftness={0.64}><Text id="one" sharedId="title">Planet</Text></Slide><Slide slideTransition="morph" morphEffectMode="inherit" morphEasing="linear" transitionDuration={0.2}><Text id="two" sharedId="title">Planet</Text></Slide><Slide><Text id="three" sharedId="title">Planet</Text></Slide>`;
  const document = parseMotionDoc(source);
  const resolved = sharedMorphEffectProps(document.scenes, 1);
  assert.equal(resolved.morphEasing, "spring");
  assert.equal(resolved.transitionDuration, 1.1);
  assert.equal(resolved.morphShapeSoftness, 0.64);

  const html = buildMotionDocHtml(source);
  assert.equal((html.match(/data-morph-easing="spring"/g) ?? []).length, 2);
  assert.equal((html.match(/--slide-transition-duration:1.1s/g) ?? []).length, 2);

  const invalid = summarizeMotionDoc(source.replace('morphEffectMode="inherit"', 'morphEffectMode="linked"'));
  assert.equal(invalid.validation.isValid, false);
  assert.match(invalid.validation.issues.map((issue) => issue.message).join(" "), /morphEffectMode/);
});

test("MotionDoc rejects a Morph edge without a compatible adjacent shared pair", () => {
  const summary = summarizeMotionDoc(`<Slide slideTransition="morph"><Text id="one" sharedId="title">Planet</Text></Slide><Slide><Shape id="two" sharedId="title" shape="circle" /></Slide>`);
  assert.equal(summary.validation.isValid, false);
  assert.equal(summary.validation.issues.some((issue) => issue.code === "morph_missing_shared_pair"), true);
});

test("unlinking a Morph group restores ordinary slides and removes pairing identity", () => {
  const document = parseMotionDoc(`# Unlink\n\n<Slide slideTransition="morph" morphEasing="spring" transitionDuration={0.72}><Shape id="one" sharedId="hero" shape="circle" /></Slide>\n\n<Slide><Shape id="two" sharedId="hero" shape="diamond" /></Slide>`);
  const scenes = unlinkSharedMorphGroupScenes(document.scenes, 0, 1);
  assert.equal(scenes[0]?.props.slideTransition, "none");
  assert.equal(scenes[0]?.props.transitionDuration, undefined);
  assert.equal(scenes[0]?.props.morphEasing, undefined);
  assert.equal(scenes[0]?.blocks[0]?.props.sharedId, undefined);
  assert.equal(scenes[1]?.blocks[0]?.props.sharedId, undefined);
});

test("return Morph links pair every detail slide with its own overview hotspot", () => {
  const interaction = (slide: number) => JSON.stringify({ action: { slide, type: "goToSlide" }, trigger: "click", version: 1 });
  const document = parseMotionDoc(`<Slide slideTransition="morph"><Shape id="blue" sharedId="shared-blue" shape="circle" interaction='${interaction(2)}' /><Shape id="red" sharedId="shared-red" shape="circle" interaction='${interaction(3)}' /><Shape id="orange" sharedId="shared-orange" shape="circle" interaction='${interaction(4)}' /></Slide><Slide slideTransition="morph"><Shape id="detail-blue" sharedId="shared-blue" shape="circle" /></Slide><Slide slideTransition="morph"><Shape id="detail-red" sharedId="shared-blue" shape="circle" /></Slide><Slide><Shape id="detail-orange" sharedId="shared-blue" shape="circle" /></Slide>`);
  let scenes = document.scenes;
  assert.equal(hasSharedMorphReturnLink(scenes, 0, 1), false);
  assert.equal(hasSharedMorphReturnLink(scenes, 0, 2), false);
  assert.equal(hasSharedMorphReturnLink(scenes, 0, 3), false);
  scenes = setSharedMorphReturnLinkScenes(scenes, 0, 1, true);
  scenes = setSharedMorphReturnLinkScenes(scenes, 0, 2, true);
  scenes = setSharedMorphReturnLinkScenes(scenes, 0, 3, true);
  assert.equal(scenes[1]?.blocks[0]?.props.sharedId, "shared-blue");
  assert.equal(scenes[2]?.blocks[0]?.props.sharedId, "shared-red");
  assert.equal(scenes[3]?.blocks[0]?.props.sharedId, "shared-orange");
  for (const index of [1, 2, 3]) {
    assert.deepEqual(interactionFromScene(scenes[index]!), { action: { slide: 1, type: "goToSlide" }, trigger: "click", version: 1 });
    assert.equal(hasSharedMorphReturnLink(scenes, 0, index), true);
  }
  scenes = setSharedMorphReturnLinkScenes(scenes, 0, 2, false);
  assert.equal(interactionFromScene(scenes[2]!), null);
  assert.equal(scenes[2]?.blocks[0]?.props.sharedId, "shared-red");
  assert.equal(hasSharedMorphReturnLink(scenes, 0, 2), false);
});

function interactionFromScene(scene: ReturnType<typeof parseMotionDoc>["scenes"][number]) {
  return parseInteraction(scene.blocks[0]?.props.interaction).interaction;
}

function sequenceSource(scenes: ReturnType<typeof parseMotionDoc>["scenes"]) {
  return scenes.map((scene, index) => {
    const transition = scene.props.slideTransition === "morph" ? ' slideTransition="morph"' : "";
    const sharedId = String(scene.blocks[0]?.props.sharedId ?? "");
    return `<Slide${transition}><Text id="sequence-${index}" sharedId="${sharedId}">Planet</Text></Slide>`;
  }).join("");
}

test("shape morph normalizes unlike shapes to a smooth, deterministic path", () => {
  const circle = shapeMorphPoints({ shape: "circle" }, 48);
  const star = shapeMorphPoints({ points: 5, shape: "star" }, 48);
  assert.equal(circle?.length, 48);
  assert.equal(star?.length, 48);
  const start = interpolateShapeMorphPath(circle!, star!, 0, 0.8);
  const middle = interpolateShapeMorphPath(circle!, star!, 0.5, 0.8);
  const end = interpolateShapeMorphPath(circle!, star!, 1, 0.8);
  assert.match(start, /^M/);
  assert.match(middle, / Z$/);
  assert.match(end, /^M/);
  assert.notEqual(middle, start);
  assert.notEqual(middle, end);
  assert.doesNotMatch(middle, /NaN|Infinity/);
});

test("InteractionV1 accepts safe click actions and rejects unsafe URLs", () => {
  const goTo = parseInteraction(JSON.stringify({ action: { slide: 3, type: "goToSlide" }, trigger: "click", version: 1 }));
  assert.deepEqual(goTo.issues, []);
  assert.equal(goTo.interaction?.action.type, "goToSlide");
  const unsafe = parseInteraction(JSON.stringify({ action: { type: "openUrl", url: "javascript:alert(1)" }, trigger: "click", version: 1 }));
  assert.equal(unsafe.interaction, null);
  assert.match(unsafe.issues.join(" "), /https, http, mailto/);
});

test("MotionDoc validation and HTML export preserve shape Morph and click actions", () => {
  const interaction = JSON.stringify({ action: { slide: 2, type: "goToSlide" }, trigger: "click", version: 1 });
  const source = `# Interactive\n\n<Slide slideTransition="morph" morphEasing="spring" morphShapeSoftness={0.55} morphShapePrecision={60}><Shape id="one" sharedId="hero" shape="circle" x={10} y={10} w={20} h={20} interaction='${interaction}' /></Slide>\n\n<Slide><Shape id="two" sharedId="hero" shape="star" points={5} x={40} y={20} w={30} h={30} /></Slide>`;
  const summary = summarizeMotionDoc(source);
  assert.equal(summary.validation.isValid, true, summary.validation.issues.map((issue) => issue.message).join("\n"));
  const html = buildMotionDocHtml(source);
  assert.match(html, /data-morph-shape-softness="0.55"/);
  assert.match(html, /data-shape-kind="circle"/);
  assert.match(html, /data-slidex-interaction=/);
  assert.match(html, /show-interaction-hints/);
  assert.match(html, /interaction-area-hint/);
  assert.match(html, /animateShapeMorph/);
  assert.match(html, /goToSlide/);
  assert.match(html, /querySelectorAll\("\[data-slidex-block-type\]"\)/);
  assert.match(html, /unmatched:/);
});

test("custom Morph curves validate and survive interactive HTML export", () => {
  const source = `# Custom curve\n\n<Slide slideTransition="morph" morphEasing="custom" morphCurveX1={0.18} morphCurveY1={0.72} morphCurveX2={0.26} morphCurveY2={1.18}><Shape id="one" sharedId="hero" shape="circle" x={10} y={10} w={20} h={20} /></Slide>\n\n<Slide><Shape id="two" sharedId="hero" shape="diamond" x={40} y={20} w={30} h={30} /></Slide>`;
  const summary = summarizeMotionDoc(source);
  assert.equal(summary.validation.isValid, true, summary.validation.issues.map((issue) => issue.message).join("\n"));
  const html = buildMotionDocHtml(source);
  assert.match(html, /data-morph-easing="custom"/);
  assert.match(html, /data-morph-curve-x1="0.18"/);
  assert.match(html, /cubicBezierProgress/);

  const invalid = summarizeMotionDoc(source.replace("morphCurveX1={0.18}", "morphCurveX1={1.8}"));
  assert.equal(invalid.validation.isValid, false);
  assert.match(invalid.validation.issues.map((issue) => issue.message).join(" "), /morphCurveX1/);
});
