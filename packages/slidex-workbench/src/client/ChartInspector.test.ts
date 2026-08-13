import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildMotionDocHtml, type MotionDocBlock, type MotionDocProps } from "@open-slidex/sdk";
import { renderMotionDocChartSvg } from "@/core/motion-doc/application/chartSvg";
import { clearChartDatumColors, mergeChartProps, withoutDatumColor } from "./chartInspectorState";

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
    { showGrid: "false" },
    { showLabels: "false" },
    { colorMode: "emphasis" },
    { emphasisIndex: "2" },
    { barGap: "airy" },
    { barRadius: "999" },
    { labelMode: "value" },
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

test("palette changes clear row overrides so the selected palette can render", () => {
  const rows = [
    { color: "#ef4444", label: "Q1", value: 42 },
    { label: "Q2", value: 58 }
  ];

  assert.deepEqual(clearChartDatumColors(rows), [
    { label: "Q1", value: 42 },
    { label: "Q2", value: 58 }
  ]);
  assert.deepEqual(withoutDatumColor(rows[0]), { label: "Q1", value: 42 });
});

test("chart inspector presentation stays out of the legacy stylesheet", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const source = readFileSync(new URL("./ChartInspector.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.(?:chart-(?:inspector|section-heading|control-label|live-badge|type-grid|type-check|more-type|tabs|tab-panel|data-table|data-header|data-row|row-color|add-row|help|preset-grid|palette-grid|toggle-grid|segmented-control|select-field|range-control|aria-field|motion-list|layout-details)|palette-dots|motion-glyph)\b/);
  assert.doesNotMatch(css, /\.(?:inspector-(?:drawer|handle|fields)|field-(?:grid|note)|chart-inspector-fields)\b/);
  assert.doesNotMatch(css, /#inspector-v4\s+:is\(/);
  assert.doesNotMatch(css, /font-size:\s*14px\s*!important/);
  assert.match(source, /label: cells\[0\] \|\| ""/);
});

test("editor-modern charts render the palette selected in the inspector", () => {
  const props: MotionDocProps = {
    colorMode: "palette",
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }]),
    palette: "sunset",
    type: "bar"
  };

  const svg = renderMotionDocChartSvg(props, { appearance: "editor-modern" });

  assert.match(svg, /fill="#e11d48"/);
  assert.match(svg, /fill="#f43f5e"/);
  assert.doesNotMatch(svg, /#6670f2/);
});

test("chart visual controls render an intentional emphasis treatment", () => {
  const svg = renderMotionDocChartSvg({
    areaOpacity: "55",
    barGap: "airy",
    barRadius: "999",
    colorMode: "emphasis",
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }, { label: "Q3", value: 73 }]),
    emphasisIndex: "2",
    labelMode: "value",
    palette: "ocean",
    showGrid: "false",
    type: "bar"
  }, { appearance: "editor-modern" });

  assert.match(svg, /fill="#2563eb" fill-opacity="0\.24"/);
  assert.match(svg, /fill="#2563eb" fill-opacity="1"/);
  assert.doesNotMatch(svg, /chart-grid/);
  assert.match(svg, />42<\/text>/);
  assert.doesNotMatch(svg, />Q1<\/text>/);
  assert.match(svg, /rx="[0-9.]+"/);
});

test("presentation bars default to a substantial responsive width", () => {
  const props: MotionDocProps = {
    data: JSON.stringify([
      { label: "Q1", value: 42 },
      { label: "Q2", value: 58 },
      { label: "Q3", value: 73 },
      { label: "Q4", value: 91 },
      { label: "Q5", value: 100 }
    ]),
    type: "bar"
  };
  const frame = { h: 74.4, w: 86.7, x: 6.6, y: 12.8 };
  const svg = renderMotionDocChartSvg(props, { appearance: "editor-modern", frame });
  const widths = [...svg.matchAll(/class="chart-bar"[^>]* width="([0-9.]+)"/g)].map((match) => Number(match[1]));

  assert.equal(widths.length, 5);
  assert.ok(widths.every((width) => width >= 150), `expected substantial bars, received ${widths.join(", ")}`);
});

test("column width choices visibly change bar weight", () => {
  const baseProps: MotionDocProps = {
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }, { label: "Q3", value: 73 }]),
    type: "bar"
  };
  const readWidth = (barGap: "compact" | "balanced" | "airy") => {
    const svg = renderMotionDocChartSvg({ ...baseProps, barGap }, { appearance: "editor-modern" });
    return Number(svg.match(/class="chart-bar"[^>]* width="([0-9.]+)"/)?.[1] ?? 0);
  };

  assert.ok(readWidth("compact") > readWidth("balanced"));
  assert.ok(readWidth("balanced") > readWidth("airy"));
});

test("gradient columns and straight trends remain serializable chart styles", () => {
  const columns = renderMotionDocChartSvg({
    colorMode: "gradient",
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }]),
    type: "bar"
  }, { appearance: "editor-modern" });
  const trend = renderMotionDocChartSvg({
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }]),
    lineSmooth: "false",
    type: "line"
  }, { appearance: "editor-modern" });

  assert.match(columns, /chart-bar-gradient-/);
  assert.match(columns, /fill="url\(#chart-bar-gradient-/);
  assert.match(trend, /d="M [0-9.]+ [0-9.]+ L [0-9.]+ [0-9.]+"/);
});

test("the player uses the editor chart frame and visual system", () => {
  const html = buildMotionDocHtml(`<Slide theme="light" background="#ffffff">
    <Chart type="bar" data='[{"label":"Q1","value":42},{"label":"Q2","value":58}]' palette="editorial" x={6.6} y={12.8} w={86.7} h={74.4} />
  </Slide>`);

  assert.match(html, /motion-chart--modern/);
  assert.match(html, /viewBox="0 0 1664\.64 803\.52"/);
  assert.match(html, /--chart-label-size:/);
  assert.match(html, /\.motion-chart--modern \.chart-grid/);
});
