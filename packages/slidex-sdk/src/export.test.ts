import assert from "node:assert/strict";
import test from "node:test";

import { buildMotionDocHtml } from "@/core/motion-doc/infrastructure/export/motionDocExport";

test("HTML export is byte-stable for the same MotionDoc source", () => {
  const source = `# Stable export

<Slide><Text>Same input, same HTML.</Text></Slide>`;

  assert.equal(buildMotionDocHtml(source), buildMotionDocHtml(source));
});
