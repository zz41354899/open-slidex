import assert from "node:assert/strict";
import test from "node:test";

import { canvasSlideRowsForRender } from "../../../../features/pitch/application/canvasSlideRender";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import { appendBlockToSlide, replaceSlideSource } from "../../../../features/pitch/application/motionDocCommands";

test("the canvas keeps every slide mounted while editing another slide", () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({ duration: 5, index, layers: 0, title: `Slide ${index + 1}` }));

  assert.deepEqual(
    canvasSlideRowsForRender(rows).map((row) => row.index),
    [0, 1, 2, 3, 4, 5]
  );
});

test("editing a middle slide preserves source-backed slides before and after it", () => {
  const source = `<Deck title="Visibility"><Slide><Text>One</Text></Slide><Slide><Text>Two</Text></Slide><Slide><Text>Three</Text></Slide><Slide><Text>Four</Text></Slide></Deck>`;
  const before = parseMotionDoc(source);
  const edited = appendBlockToSlide(before.scenes[2]!, "Text", { props: { id: "new-copy" } });
  const next = parseMotionDoc(replaceSlideSource(source, 2, edited.slide));

  assert.equal(next.scenes.length, 4);
  assert.deepEqual(next.scenes[0], before.scenes[0]);
  assert.deepEqual(next.scenes[1], before.scenes[1]);
  assert.deepEqual(next.scenes[3], before.scenes[3]);
  assert.equal(next.scenes[2]?.blocks.length, before.scenes[2]?.blocks.length + 1);
});
