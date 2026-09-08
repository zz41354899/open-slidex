import assert from "node:assert/strict";
import test from "node:test";

import {
  isReactPresentationSource,
  motionDocToReactPresentationSource,
  reactPresentationToMotionDocSource,
  validateReactPresentationSource
} from "../../../core/react-presentation/reactPresentationSource";
import { parseMotionDoc } from "./index";

const mdx = `# Example

<Slide duration={5} background="#fff">
  <Text id="title" x={8} y={12} w={60} h={15}>Hello</Text>
</Slide>`;

test("native MotionDoc round-trips through canonical React TSX", () => {
  const tsx = motionDocToReactPresentationSource(mdx);
  assert.equal(isReactPresentationSource(tsx), true);
  assert.match(tsx, /@open-slidex\/sdk\/react/);
  assert.equal(validateReactPresentationSource(tsx).length, 0);
  assert.equal(reactPresentationToMotionDocSource(tsx), mdx);
  assert.equal(parseMotionDoc(tsx).scenes[0]?.blocks[0]?.type, "Text");
});

test("React source rejects imports outside the deck boundary", () => {
  const tsx = motionDocToReactPresentationSource(mdx).replace(
    "export default",
    'import fs from "node:fs";\n\nexport default'
  );
  assert.match(validateReactPresentationSource(tsx)[0]?.message ?? "", /not allowed/);
});

test("public React primitive names materialize as native MotionDoc layers", () => {
  const tsx = `import { Deck, Image, Slide, Svg, Video, definePresentation } from "@open-slidex/sdk/react";
export default definePresentation({ title: "Media", component: function Presentation() {
  return <Deck title="Media"><Slide id="slide-1"><Image id="image-1" x={0} y={0} w={25} h={25} src="assets/a.webp" /><Video id="video-1" x={25} y={0} w={25} h={25} src="assets/a.mp4" /><Svg id="svg-1" x={50} y={0} w={25} h={25} src="assets/a.svg" /></Slide></Deck>;
} });`;
  assert.deepEqual(parseMotionDoc(tsx).scenes[0]?.blocks.map((block) => block.type), [
    "ImageBlock",
    "VideoBlock",
    "SvgBlock"
  ]);
});
