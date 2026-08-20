import assert from "node:assert/strict";
import test from "node:test";

import { materializeFreeformDocument, materializeFreeformSource } from "../../../core/motion-doc/application/motionDocFreeform";
import { parseMotionDoc } from "../../../core/motion-doc/domain/motionDocParser";

test("freeform materialization returns the same normalized document that it serializes", () => {
  const source = `# Legacy freeform

<Slide alignX="center">
  <Text id="title">A title without an explicit frame</Text>
  <Text id="body">Body copy without an explicit frame</Text>
</Slide>`;

  const materialized = materializeFreeformDocument(source);

  assert.equal(materializeFreeformSource(source), materialized.source);
  const reparsed = parseMotionDoc(materialized.source);
  assert.equal(reparsed.title, materialized.document.title);
  assert.equal(reparsed.scenes.length, materialized.document.scenes.length);
  assert.deepEqual(
    reparsed.scenes[0]?.blocks.map((block) => block.props.id),
    materialized.document.scenes[0]?.blocks.map((block) => block.props.id)
  );
  assert.match(materialized.source, /id=/);
  assert.match(materialized.source, /x=\{/);
});
