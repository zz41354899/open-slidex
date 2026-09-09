import assert from "node:assert/strict";
import test from "node:test";

import { updateMotionDocSlideProps } from "@/core/motion-doc/application/motionDocAutomation";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { presenterNotesKey } from "@/features/pitch/application/presenterNotes";

test("speaker notes stay attached to the native slide source", () => {
  const source = `<Slide><Text id="one">Opening</Text></Slide>`;
  const updated = updateMotionDocSlideProps(source, 0, {
    presenterNotes: "Open with the audience question.\nPause for two beats."
  }).source;

  assert.equal(
    parseMotionDoc(updated).scenes[0]?.props.presenterNotes,
    "Open with the audience question.\nPause for two beats."
  );
});

test("session notes are independent, follow native slide identity, and do not mutate the deck", () => {
  const source = '<Slide presenterNotes="Original"><Text id="a">First</Text></Slide><Slide><Text id="b">Second</Text></Slide>';
  const document = parseMotionDoc(source);
  const before = JSON.stringify(document);
  const first = document.scenes[0]!, second = document.scenes[1]!;
  const notes = { [presenterNotesKey(first, 0)]: "Live draft" };
  assert.equal(notes[presenterNotesKey(first, 1)], "Live draft");
  assert.equal(notes[presenterNotesKey(second, 0)], undefined);
  assert.equal(JSON.stringify(document), before);
  assert.equal(first.props.presenterNotes, "Original");
});
