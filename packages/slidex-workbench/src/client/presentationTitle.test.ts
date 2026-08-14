import assert from "node:assert/strict";
import test from "node:test";

import { normalizePresentationTitle, renamePresentationSource } from "./presentationTitle";

test("presentation titles normalize unsafe multiline input", () => {
  assert.equal(normalizePresentationTitle("  Quarterly\n<{launch}>  "), "Quarterly launch");
});

test("renaming changes only the MotionDoc document heading", () => {
  const source = "# Original\n\n<Slide>\n  <Text role=\"title\">Original slide title</Text>\n</Slide>\n";
  const renamed = renamePresentationSource(source, "New deck name");
  assert.match(renamed, /^# New deck name$/m);
  assert.match(renamed, /<Text role="title">Original slide title<\/Text>/);
});
