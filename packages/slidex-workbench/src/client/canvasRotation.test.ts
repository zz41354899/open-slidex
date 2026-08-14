import assert from "node:assert/strict";
import test from "node:test";

import { isMovableBlock } from "../../../../features/pitch/application/previewCanvas";

test("native media and graphic blocks receive canvas transform controls without explicit positions", () => {
  const rotatingTypes = ["ImageBlock", "VideoBlock", "Chart", "Table", "Shape"] as const;

  for (const type of rotatingTypes) {
    assert.equal(
      isMovableBlock({ props: {}, type } as never),
      true,
      `${type} should have a selectable default frame for move, resize, and rotate`
    );
  }
});
