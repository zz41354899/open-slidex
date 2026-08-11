import assert from "node:assert/strict";
import test from "node:test";

import type { MotionDocBlock, MotionDocProps } from "@open-slidex/sdk";
import { mergeChartProps } from "./ChartInspector";

test("chart inspector patches preserve the existing canvas frame", () => {
  const block = {
    props: {
      data: "[]",
      h: "76.48",
      palette: "aurora",
      type: "donut",
      w: "81.72",
      x: "3.2",
      y: "4.4"
    },
    type: "Chart"
  } as MotionDocBlock;

  assert.deepEqual(mergeChartProps(block, { type: "bar" }), {
    data: "[]",
    h: "76.48",
    palette: "aurora",
    type: "bar",
    w: "81.72",
    x: "3.2",
    y: "4.4"
  });
});

test("chart data, palette, labels, and motion patches keep geometry", () => {
  const block = {
    props: { h: "18", type: "area", w: "42", x: "30", y: "30" },
    type: "Chart"
  } as MotionDocBlock;

  const patches: MotionDocProps[] = [
    { data: "[]" },
    { palette: "editorial" },
    { showAxes: "false" },
    { showLabels: "false" },
    { chartMotion: "none" }
  ];

  for (const patch of patches) {
    const next = mergeChartProps(block, patch);
    assert.equal(next.x, "30");
    assert.equal(next.y, "30");
    assert.equal(next.w, "42");
    assert.equal(next.h, "18");
  }
});
