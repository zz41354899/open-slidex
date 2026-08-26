import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeMotionDocSvg } from "@/core/motion-doc/domain/svgPolicy";

test("SvgBlock assets allow declarative stage markers", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path data-stage="1" data-motion="draw sway" d="M0 0L10 10"/><g data-stage="2" data-motion="stagger reveal"><circle/><circle/></g></svg>`;
  assert.equal(assertSafeMotionDocSvg(svg), svg);
});

test("SvgBlock assets reject scripts, handlers, SMIL, and external resources", () => {
  for (const svg of [
    `<svg><script>alert(1)</script></svg>`,
    `<svg><path onclick="alert(1)"/></svg>`,
    `<svg><animate attributeName="opacity"/></svg>`,
    `<svg><image href="https://example.com/a.png"/></svg>`,
    `<svg><style>@import "https://example.com/a.css";</style></svg>`
  ]) {
    assert.throws(() => assertSafeMotionDocSvg(svg));
  }
});
