import assert from "node:assert/strict";
import test from "node:test";

import { parseMotionDoc } from "./index";

for (const component of ["Card", "Metric", "Stack", "Group", "Title", "Icon", "Notes"] as const) {
  test(`parser rejects removed ${component} components`, () => {
    const body = component === "Group"
      ? `<Group id="legacy"><Text id="child" x={8} y={8} w={40} h={10}>Child</Text></Group>`
      : component === "Title"
        ? `<Title id="legacy" x={8} y={8} w={40} h={10}>Legacy</Title>`
        : component === "Notes"
          ? `<Notes>Legacy</Notes>`
        : `<${component} id="legacy" x={8} y={8} w={40} h={10} />`;
    assert.throws(
      () => parseMotionDoc(`# Legacy\n\n<Slide>${body}</Slide>`),
      new RegExp(`Unsupported MotionDoc component: ${component}`)
    );
  });
}

test("Text role title remains a supported native text layer", () => {
  const document = parseMotionDoc(
    '# Native\n\n<Slide><Text id="title" role="title" x={8} y={8} w={60} h={14}>Native title</Text></Slide>'
  );
  assert.equal(document.scenes[0]?.blocks[0]?.type, "Text");
  assert.equal(document.scenes[0]?.blocks[0]?.props.role, "title");
});
