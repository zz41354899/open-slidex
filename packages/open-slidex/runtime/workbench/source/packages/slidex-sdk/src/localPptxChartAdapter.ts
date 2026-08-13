import type PptxGenJS from "pptxgenjs";

import { chartDatumColor, motionDocChartModel } from "@/core/motion-doc/domain/chart";
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
  const chartColors = model.data.map((_, index) => {
    const color = model.colorMode === "single" || model.colorMode === "emphasis"
      ? model.data[index]?.color ?? model.palette[0]
      : chartDatumColor(model, index);
    return model.colorMode === "emphasis" && model.emphasisIndex !== null && index !== model.emphasisIndex
      ? mixWithWhite(pptxColor(color, "7C3AED"), .76)
      : pptxColor(color, "7C3AED");
  });
  const frame = pptxFrame(block);
  const formatCode = pptxNumberFormatCode(model.numberFormat, model.decimals, model.currency);

  slide.addChart(type, data, {
    ...frame,
    altText: stringProp(block.props.ariaLabel) ?? `${model.type} chart`,
    barDir: model.type === "bar" ? "col" : undefined,
    chartArea: { border: { color: "FFFFFF", pt: 0 }, fill: { color: "FFFFFF", transparency: 100 } },
    chartColors,
    catAxisHidden: isCircular || !model.showAxes,
    catAxisLabelColor: mutedColor,
    catAxisLineColor: mutedColor,
    catAxisLineShow: model.showAxes,
    catGridLine: { style: "none" },
    dataLabelColor: textColor,
    dataLabelFormatCode: formatCode,
    dataLabelPosition: isCircular ? "bestFit" : "outEnd",
    holeSize: model.type === "donut" ? Math.round(model.donutHole * 100) : undefined,
    legendColor: mutedColor,
    legendFontSize: 10,
    legendPos: "b",
    lineDataSymbol: model.type === "line" || model.type === "area" ? "circle" : undefined,
    lineDataSymbolSize: 5,
    lineSize: 2.25,
    lineSmooth: (model.type === "line" || model.type === "area") && model.lineSmooth,
    plotArea: { border: { color: "FFFFFF", pt: 0 }, fill: { color: "FFFFFF", transparency: 100 } },
    showLabel: isCircular && model.showLabels && model.labelMode !== "category",
    showLegend: isCircular,
    showPercent: isCircular && model.showLabels && model.labelMode !== "category",
    showValue: !isCircular && model.showLabels && model.labelMode !== "category",
    showTitle: false,
    valAxisHidden: isCircular || !model.showAxes,
    valAxisLabelFormatCode: formatCode,
    valAxisLabelColor: mutedColor,
    valAxisLineColor: mutedColor,
    valAxisLineShow: model.showAxes,
    valGridLine: { color: "E2E8F0", size: 0.75, style: model.showAxes && model.showGrid ? "solid" : "none" }
  });

  if (!isCircular && model.referenceValue !== null) {
    const values = model.data.map((datum) => datum.value);
    const minimum = Math.min(0, ...values, model.referenceValue);
    const maximum = niceMaximum(Math.max(...values, model.referenceValue, 1));
    const ratio = (model.referenceValue - minimum) / Math.max(maximum - minimum, 1);
    const y = frame.y + frame.h * (.88 - ratio * .74);
    const color = pptxColor(model.referenceColor, "DC2626");
    slide.addShape(pptx.ShapeType.line, {
      x: frame.x + frame.w * .08,
      y,
      w: frame.w * .86,
      h: 0,
      line: { color, dashType: "dash", width: 1.5 }
    });
    slide.addText(model.referenceLabel || String(model.referenceValue), {
      x: frame.x + frame.w * .68,
      y: Math.max(frame.y, y - .24),
      w: frame.w * .26,
      h: .22,
      align: "right",
      color,
      fontFace: "Aptos",
      fontSize: 8,
      margin: 0
    });
  }

  if (model.annotationText) {
    slide.addText(model.annotationText, {
      x: frame.x + frame.w * .62,
      y: frame.y + .02,
      w: frame.w * .34,
      h: .32,
      align: "right",
      bold: true,
      color: pptxColor(model.annotationColor, "DC2626"),
      fontFace: "Aptos",
      fontSize: 10,
      margin: 0
    });
  }

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

function mixWithWhite(color: string, amount: number) {
  const components = [0, 2, 4].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  return components.map((component) => Math.round(component + (255 - component) * amount).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function niceMaximum(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / magnitude) * magnitude;
}

function pptxNumberFormatCode(format: string, decimals: number, currency: string) {
  const decimalPart = decimals > 0 ? `.${"0".repeat(decimals)}` : "";
  if (format === "percent") return `0${decimalPart}%`;
  if (format === "currency") return `[$${currency}]#,##0${decimalPart}`;
  if (format === "compact") return `0${decimalPart},,\"M\"`;
  if (format === "integer") return "0";
  if (format === "decimal") return `0${decimalPart}`;
  return "0.0";
}

function stringProp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
