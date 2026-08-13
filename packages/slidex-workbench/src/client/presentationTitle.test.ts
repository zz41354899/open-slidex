import assert from "node:assert/strict";
import test from "node:test";

import { normalizePresentationTitle, renamePresentationSource } from "./presentationTitle";

test("presentation titles normalize unsafe multiline input", () => {
  assert.equal(normalizePresentationTitle("  Quarterly\n<{launch}>  "), "Quarterly launch");
});

test("renaming changes only the MotionDoc document heading", () => {
  const source = "# Original\n\n<Slide>\n  <Title>Original slide title</Title>\n</Slide>\n";
  const renamed = renamePresentationSource(source, "New deck name");
  assert.match(renamed, /^# New deck name$/m);
  assert.match(renamed, /<Title>Original slide title<\/Title>/);
});
