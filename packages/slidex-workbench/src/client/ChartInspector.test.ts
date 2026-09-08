import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildMotionDocHtml, defaultMotionDocChartDataForType, motionDocChartAnimationDuration, motionDocChartDataForType, motionDocChartModel, validateMotionDocChartProps, type MotionDocBlock, type MotionDocProps } from "@open-slidex/sdk";
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

test("chart types retain independent data and reject mismatched build animations", () => {
  const props: MotionDocProps = {
    chartDataByType: JSON.stringify({
      bar: [{ label: "Revenue", value: 84 }],
      donut: [{ label: "Direct", value: 128 }, { label: "Organic", value: 96 }]
    }),
    chartMotion: "grow",
    data: JSON.stringify([{ label: "Legacy", value: 42 }]),
    type: "donut"
  };

  assert.deepEqual(motionDocChartDataForType(props, "bar"), [{ color: undefined, label: "Revenue", size: undefined, value: 84, x: undefined }]);
  assert.equal(motionDocChartModel(props).motion, "sweep");
  assert.equal(defaultMotionDocChartDataForType("scatter")[0].x, 12);
  assert.equal(defaultMotionDocChartDataForType("pie")[0].label, "Product");
  assert.equal(motionDocChartDataForType({ data: JSON.stringify([{ label: "Q1", value: 42 }]), type: "donut" }, "donut")[0].label, "Q1");
  assert.equal(motionDocChartDataForType({ data: JSON.stringify([{ label: "Leads", value: 42 }]), type: "donut" }, "donut")[0].label, "Leads");
  assert.equal(motionDocChartDataForType({ chartDataByType: JSON.stringify({ donut: [{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }] }), data: "[]", type: "donut" }, "donut")[0].label, "Q1");
});

test("chart animation duration covers every staggered radial legend row", () => {
  const model = motionDocChartModel({
    chartMotion: "pop",
    data: JSON.stringify(Array.from({ length: 12 }, (_, index) => ({ label: `Segment ${index + 1}`, value: index + 1 }))),
    type: "donut"
  });

  // The final legend starts at 320ms + 11 × 75ms and then needs the full 720ms fade.
  assert.equal(motionDocChartAnimationDuration(model), 1_865);
  assert.equal(motionDocChartAnimationDuration(motionDocChartModel({ chartMotion: "none", data: "[]", type: "bar" })), 0);
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
  assert.match(source, /defaultMotionDocChartDataForType\(candidate, locale\)/);
  assert.match(source, /motionDocChartMotionOptions\(type\)/);
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

test("dark charts stay native with a transparent background and gold foreground palette", () => {
  const props: MotionDocProps = {
    chartTheme: "dark-gold",
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }]),
    palette: "aurora",
    type: "bar"
  };
  const model = motionDocChartModel(props);
  const svg = renderMotionDocChartSvg(props, { appearance: "editor-modern" });
  const html = buildMotionDocHtml(`<Slide theme="light" background="#ffffff"><Chart chartTheme="dark-gold" type="bar" data='[{"label":"Q1","value":42}]' x={6} y={12} w={86} h={74} /></Slide>`);

  assert.equal(model.theme, "dark-gold");
  assert.equal(model.palette[0], "#f6df9a");
  assert.match(svg, /motion-chart--theme-dark-gold/);
  assert.match(svg, /fill="#f6df9a"/);
  assert.doesNotMatch(svg, /chart-surface|chart-theme-header/);
  assert.match(html, /--chart-value-color: #fff0bc/);
});

test("Workbench preview gives dark gold chart text the same contrast as exported output", () => {
  const preview = readFileSync(new URL("../../../../features/pitch/ui/preview/motion/ChartBlock.tsx", import.meta.url), "utf8");

  assert.match(preview, /motion-chart--theme-dark-gold\{--chart-grid-color:#d9b85d/);
  assert.match(preview, /chart-value-color,var\(--slide-fg,currentColor\)/);
  assert.doesNotMatch(preview, /\.chart-(?:surface|theme-header)\b/);
});

test("radial legends retain their SVG translate positions while animating", () => {
  const svg = renderMotionDocChartSvg({ type: "donut", data: JSON.stringify([{ label: "Direct", value: 128 }, { label: "Organic", value: 96 }]) }, { appearance: "editor-modern" });
  const preview = readFileSync(new URL("../../../../features/pitch/ui/preview/motion/ChartBlock.tsx", import.meta.url), "utf8");
  const exportStyles = readFileSync(new URL("../../../../core/motion-doc/infrastructure/export/motionDocExportStyles.ts", import.meta.url), "utf8");

  assert.match(svg, /chart-legend-item" style="--chart-delay:320ms" transform="translate\(528 71\.4\)"/);
  assert.match(svg, /chart-legend-value" text-anchor="end" x="232"/);
  assert.match(preview, /chart-legend-item\{animation-name:slidex-chart-fade\}/);
  assert.doesNotMatch(preview, /chart-legend-item\{animation-name:slidex-chart-fade-up/);
  assert.match(exportStyles, /\.motion-chart--sweep \.chart-legend-item \{\s+animation-name: chart-fade;/);
});

test("circular charts clamp invalid values, localize their defaults, and keep legends in bounds", () => {
  const negativeProps: MotionDocProps = {
    data: JSON.stringify([{ label: "Returns", value: -10 }, { label: "Adjustments", value: -4 }]),
    type: "donut"
  };
  const negativeModel = motionDocChartModel(negativeProps, "zh-TW");
  const negativeSvg = renderMotionDocChartSvg(negativeProps, { appearance: "editor-modern", locale: "zh-TW" });
  const exportedZhSvg = renderMotionDocChartSvg({ ...negativeProps, chartLocale: "zh-TW" }, { appearance: "editor-modern" });
  const narrowSvg = renderMotionDocChartSvg({
    data: JSON.stringify(Array.from({ length: 8 }, (_, index) => ({ label: `分類 ${index + 1}`, value: index + 1 }))),
    type: "donut"
  }, { appearance: "editor-modern", frame: { h: 32, w: 20, x: 10, y: 10 } });
  const viewBoxHeight = Number(narrowSvg.match(/viewBox="0 0 [0-9.]+ ([0-9.]+)"/)?.[1]);
  const legendYs = [...narrowSvg.matchAll(/chart-legend-item[^>]*transform="translate\([^ ]+ ([0-9.]+)\)"/g)].map((match) => Number(match[1]));

  assert.deepEqual(negativeModel.data.map((item) => item.value), [0, 0]);
  assert.match(negativeSvg, />0<\/text><text class="chart-center-label"[^>]*>總計<\/text>/);
  assert.match(exportedZhSvg, />總計<\/text>/);
  assert.equal(defaultMotionDocChartDataForType("donut", "zh-TW")[0].label, "直接流量");
  assert.ok(validateMotionDocChartProps(negativeProps).includes("pie and donut chart values must be zero or greater."));
  assert.equal(legendYs.length, 8);
  assert.ok(Math.max(...legendYs) < viewBoxHeight, `legend overflow: ${legendYs.join(", ")} / ${viewBoxHeight}`);
});

test("chart theme controls have Traditional Chinese translations", () => {
  const i18n = readFileSync(new URL("../../../../features/pitch/ui/pitchI18n.ts", import.meta.url), "utf8");

  assert.match(i18n, /"Visual theme": "視覺主題"/);
  assert.match(i18n, /"Light": "淺色"/);
  assert.match(i18n, /"Dark": "深色"/);
  assert.match(i18n, /"Gilded": "金色"/);
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

test("bar charts default to square corners while keeping manual rounding available", () => {
  const props: MotionDocProps = {
    data: JSON.stringify([{ label: "Q1", value: 42 }, { label: "Q2", value: 58 }]),
    type: "bar"
  };
  const square = renderMotionDocChartSvg(props, { appearance: "editor-modern" });
  const rounded = renderMotionDocChartSvg({ ...props, barRadius: "999" }, { appearance: "editor-modern" });

  assert.match(square, /class="chart-bar"[^>]* rx="0"/);
  assert.match(rounded, /class="chart-bar"[^>]* rx="[1-9]/);
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
