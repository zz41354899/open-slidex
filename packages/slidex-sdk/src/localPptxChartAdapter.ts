import type PptxGenJS from "pptxgenjs";

import { motionDocChartModel } from "@/core/motion-doc/domain/chart";
import { motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";

const PPTX_HEIGHT = 7.5;
const PPTX_WIDTH = PPTX_HEIGHT * 16 / 9;

export function addOpenSlideXChartToPptx({
  block,
  foreground,
  muted,
  pptx,
  slide
}: {
  block: MotionDocBlock;
  foreground: string;
  muted: string;
  pptx: PptxGenJS;
  slide: ReturnType<PptxGenJS["addSlide"]>;
}) {
  if (block.type !== "Chart") return false;

  const model = motionDocChartModel(block.props);
  const isCircular = model.type === "pie" || model.type === "donut";
  const type =
    model.type === "donut" ? pptx.ChartType.doughnut :
      model.type === "scatter" ? pptx.ChartType.scatter :
        pptx.ChartType[model.type];
  const labels = model.type === "scatter"
    ? model.data.map((datum, index) => String(datum.x ?? index + 1))
    : model.data.map((datum) => datum.label);
  const data: PptxGenJS.OptsChartData[] = [{
    labels,
    name: "Series",
    sizes: model.type === "scatter" ? model.data.map((datum) => datum.size ?? 10) : undefined,
    values: model.data.map((datum) => datum.value)
  }];
  const textColor = pptxColor(foreground, "111827");
  const mutedColor = pptxColor(muted, "64748B");

  slide.addChart(type, data, {
    ...pptxFrame(block),
    altText: stringProp(block.props.ariaLabel) ?? `${model.type} chart`,
    barDir: model.type === "bar" ? "col" : undefined,
    chartArea: { border: { color: "FFFFFF", pt: 0 }, fill: { color: "FFFFFF", transparency: 100 } },
    chartColors: model.palette.map((color) => pptxColor(color, "7C3AED")),
    catAxisHidden: isCircular || !model.showAxes,
    catAxisLabelColor: mutedColor,
    catAxisLineColor: mutedColor,
    catAxisLineShow: model.showAxes,
    catGridLine: { style: "none" },
    dataLabelColor: textColor,
    dataLabelPosition: isCircular ? "bestFit" : "outEnd",
    holeSize: model.type === "donut" ? 62 : undefined,
    legendColor: mutedColor,
    legendFontSize: 10,
    legendPos: "b",
    lineDataSymbol: model.type === "line" || model.type === "area" ? "circle" : undefined,
    lineDataSymbolSize: 5,
    lineSize: 2.25,
    lineSmooth: model.type === "line" || model.type === "area",
    plotArea: { border: { color: "FFFFFF", pt: 0 }, fill: { color: "FFFFFF", transparency: 100 } },
    showLabel: isCircular && model.showLabels,
    showLegend: isCircular,
    showPercent: isCircular && model.showLabels,
    showValue: !isCircular && model.showLabels,
    showTitle: false,
    valAxisHidden: isCircular || !model.showAxes,
    valAxisLabelColor: mutedColor,
    valAxisLineColor: mutedColor,
    valAxisLineShow: model.showAxes,
    valGridLine: { color: "E2E8F0", size: 0.75, style: model.showAxes ? "solid" : "none" }
  });

  return true;
}

function pptxFrame(block: MotionDocBlock) {
  const frame = motionDocBlockFrame(block);
  return {
    h: frame.h / 100 * PPTX_HEIGHT,
    w: frame.w / 100 * PPTX_WIDTH,
    x: frame.x / 100 * PPTX_WIDTH,
    y: frame.y / 100 * PPTX_HEIGHT
  };
}

function pptxColor(value: string, fallback: string) {
  const normalized = value.trim().replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function stringProp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
