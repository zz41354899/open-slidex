import {
  chartDatumColor,
  formatMotionDocChartValue,
  motionDocChartModel,
  type MotionDocChartLocale,
  type MotionDocChartModel
} from "@/core/motion-doc/domain/chart";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";

const WIDTH = 800;
const HEIGHT = 420;
const RADIAL_LEGEND_MAX_ITEMS = 8;
type ChartLayout = { height: number; labelY: number; plot: { bottom: number; left: number; right: number; top: number }; width: number };
type MotionDocChartAppearance = "default" | "editor-modern";

export type MotionDocChartRenderOptions = {
  appearance?: MotionDocChartAppearance;
  frame?: MotionDocFrame;
  locale?: MotionDocChartLocale;
  motionMode?: "animated" | "editor-static";
};

export function renderMotionDocChartSvg(props: MotionDocProps, options: MotionDocChartRenderOptions = {}) {
  const model = motionDocChartModel(props, options.locale);
  const appearance = options.appearance ?? "default";
  const layout = chartLayout(options.frame, appearance);
  const title = escapeXml(String(props.ariaLabel ?? `${model.type} chart`));
  const content = model.type === "bar"
    ? renderBars(model, layout, appearance)
    : model.type === "line" || model.type === "area"
      ? renderTrend(model, model.type === "area", layout, appearance)
      : model.type === "scatter"
        ? renderScatter(model, layout, appearance)
        : renderRadial(model, model.type === "donut", layout, appearance);

  const staticClass = options.motionMode === "editor-static" ? " motion-chart--editor-static" : "";
  const appearanceClass = appearance === "editor-modern" ? " motion-chart--modern" : "";
  const themeClass = ` motion-chart--theme-${model.theme}`;
  const styleVariables = [
    ...(appearance === "editor-modern" ? [
      `--chart-label-size:${round(clamp(Math.min(layout.width, layout.height) * 0.052, 19, 32))}px`,
      `--chart-value-size:${round(clamp(Math.min(layout.width, layout.height) * 0.06, 22, 36))}px`,
      `--chart-center-size:${round(clamp(Math.min(layout.width, layout.height) * 0.075, 28, 46))}px`
    ] : []),
    ...(model.labelColor ? [`--chart-label-color:${model.labelColor}`] : [])
  ];
  const appearanceStyle = styleVariables.length > 0 ? ` style="${styleVariables.join(";")}"` : "";
  return `<svg class="motion-chart motion-chart--${model.type} motion-chart--${model.motion}${themeClass}${appearanceClass}${staticClass}"${appearanceStyle} role="img" aria-label="${title}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${title}</title><g class="chart-content">${content}</g></svg>`;
}

function renderBars(model: MotionDocChartModel, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const values = model.data.map((item) => Math.max(item.value, 0));
  const maximum = niceMaximum(Math.max(...values, model.referenceValue ?? 0, 1));
  const plotWidth = plot.right - plot.left;
  const slot = plotWidth / Math.max(model.data.length, 1);
  const density = model.barGap === "compact" ? .76 : model.barGap === "airy" ? .48 : .64;
  const responsiveWidthCap = appearance === "editor-modern"
    ? clamp(plotWidth * .28, 132, 260)
    : clamp(plotWidth * .14, 86, 154);
  const barWidth = Math.min(slot * density, responsiveWidthCap);
  const grid = model.showAxes ? renderGrid(model, maximum, 4, layout, 0, model.showGrid) : "";
  const reference = renderReferenceLine(model, maximum, layout);
  const gradientBaseId = `chart-bar-gradient-${stableId(`${model.data.map((item) => `${item.label}:${item.value}`).join("|")}:${model.palette.join("|")}`)}`;
  const gradients = model.colorMode === "gradient"
    ? `<defs>${model.data.map((_, index) => {
      const color = chartColor(model, index, appearance);
      return `<linearGradient id="${gradientBaseId}-${index}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".48"/></linearGradient>`;
    }).join("")}</defs>`
    : "";
  const bars = model.data.map((item, index) => {
    const height = Math.max(item.value, 0) / maximum * (plot.bottom - plot.top);
    const x = plot.left + slot * index + (slot - barWidth) / 2;
    const y = plot.bottom - height;
    const delay = `${index * 70}ms`;
    const fill = model.colorMode === "gradient" ? `url(#${gradientBaseId}-${index})` : chartColor(model, index, appearance);
    const radius = model.barRadiusCustom
      ? model.barRadius >= 999 ? barWidth / 2 : Math.min(model.barRadius, barWidth / 2)
      : 0;
    return `<g class="chart-series" style="--chart-delay:${delay}"><rect class="chart-bar" fill="${fill}" fill-opacity="${chartOpacity(model, index)}" height="${round(height)}" rx="${round(radius)}" width="${round(barWidth)}" x="${round(x)}" y="${round(y)}" />${valueLabel(model, item.value, round(x + barWidth / 2), round(Math.max(y - 12, 18)))}${categoryLabel(model, item.label, round(x + barWidth / 2), layout.labelY)}</g>`;
  }).join("");
  const annotationIndex = model.annotationIndex ?? model.emphasisIndex;
  const annotationItem = typeof annotationIndex === "number" ? model.data[annotationIndex] : undefined;
  const annotation = annotationItem && model.annotationText && typeof annotationIndex === "number"
    ? renderPointAnnotation(
      model,
      plot.left + slot * annotationIndex + slot / 2,
      plot.bottom - Math.max(annotationItem.value, 0) / maximum * (plot.bottom - plot.top),
      layout
    )
    : "";
  return `${grid}${reference}${gradients}${bars}${annotation}`;
}

function renderTrend(model: MotionDocChartModel, area: boolean, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const values = model.data.map((item) => item.value);
  const minimum = Math.min(0, ...values, model.referenceValue ?? 0);
  const maximum = niceMaximum(Math.max(...values, model.referenceValue ?? 0, 1));
  const range = Math.max(maximum - minimum, 1);
  const points = model.data.map((item, index) => ({
    item,
    x: plot.left + index / Math.max(model.data.length - 1, 1) * (plot.right - plot.left),
    y: plot.bottom - (item.value - minimum) / range * (plot.bottom - plot.top)
  }));
  const linePath = model.lineSmooth ? smoothPath(points) : straightPath(points);
  const areaPath = `${linePath} L ${round(points.at(-1)?.x ?? plot.right)} ${plot.bottom} L ${round(points[0]?.x ?? plot.left)} ${plot.bottom} Z`;
  const gradientId = `chart-area-gradient-${stableId(`${model.type}:${model.data.map((item) => `${item.label}:${item.value}`).join("|")}`)}`;
  const labels = model.showLabels ? points.map(({ item, x, y }, index) => `<g class="chart-series" style="--chart-delay:${index * 70}ms">${appearance === "editor-modern" ? `<circle class="chart-point-halo" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" fill-opacity="${chartOpacity(model, index)}" r="10" />` : ""}<circle class="chart-point" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" fill-opacity="${chartOpacity(model, index)}" r="${appearance === "editor-modern" ? 4.5 : 6}" />${valueLabel(model, item.value, round(x), round(y - 15))}${categoryLabel(model, item.label, round(x), layout.labelY)}</g>`).join("") : "";
  const primaryColor = chartColor(model, 0, appearance);
  const areaOpacity = model.areaOpacityCustom ? model.areaOpacity : appearance === "editor-modern" ? .2 : .38;
  const annotationIndex = model.annotationIndex ?? model.emphasisIndex;
  const annotationPoint = annotationIndex === null ? undefined : points[annotationIndex];
  return `${model.showAxes ? renderGrid(model, maximum, 4, layout, minimum, model.showGrid) : ""}${renderReferenceLine(model, maximum, layout, minimum)}<defs><linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${primaryColor}" stop-opacity="${round(areaOpacity)}"/><stop offset="1" stop-color="${primaryColor}" stop-opacity=".02"/></linearGradient></defs>${area ? `<path class="chart-area" d="${areaPath}" fill="url(#${gradientId})" />` : ""}<path class="chart-line" d="${linePath}" fill="none" stroke="${primaryColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${appearance === "editor-modern" ? 5 : 7}" pathLength="1" />${labels}${annotationPoint && model.annotationText ? renderPointAnnotation(model, annotationPoint.x, annotationPoint.y, layout) : ""}`;
}

function renderRadial(model: MotionDocChartModel, donut: boolean, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const wide = layout.width / layout.height >= 1.45 && layout.width >= 520;
  const denseLegend = model.showLabels && model.data.length > 4;
  const chartWidth = wide ? layout.width * (denseLegend ? .5 : .62) : layout.width;
  const cx = wide ? chartWidth * 0.5 : layout.width * 0.5;
  const cy = wide ? layout.height * .5 : layout.height * (denseLegend ? .28 : .37);
  const availableRadius = wide
    ? Math.min(chartWidth * .34, layout.height * .38)
    : Math.min(layout.width * .34, layout.height * (denseLegend ? .2 : .27));
  const outerRadius = Math.max(42, availableRadius);
  const innerRadius = donut
    ? outerRadius * (model.donutHoleCustom ? model.donutHole : appearance === "editor-modern" ? .64 : .53)
    : 0;
  const total = model.data.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  const totalForAngles = total || 1;
  let startAngle = -90;
  const slices = model.data.map((item, index) => {
    const angle = Math.max(item.value, 0) / totalForAngles * 360;
    const endAngle = startAngle + angle;
    const path = radialSlicePath(cx, cy, outerRadius, innerRadius, startAngle, endAngle);
    const labelRadius = donut ? (outerRadius + innerRadius) / 2 : outerRadius * 0.66;
    const middle = polar(cx, cy, labelRadius, startAngle + angle / 2);
    const slice = `<g class="chart-series" style="--chart-delay:${index * 75}ms"><path class="chart-slice" d="${path}" fill="${chartColor(model, index, appearance)}" fill-opacity="${chartOpacity(model, index)}" />${showValueLabel(model) && angle > 12 ? `<text class="chart-value chart-value--radial" text-anchor="middle" x="${round(middle.x)}" y="${round(middle.y)}">${Math.round(angle / 3.6)}%</text>` : ""}</g>`;
    startAngle = endAngle;
    return slice;
  }).join("");
  const visibleLegendItems = model.data.length > RADIAL_LEGEND_MAX_ITEMS
    ? model.data.slice(0, RADIAL_LEGEND_MAX_ITEMS - 1)
    : model.data;
  const hiddenLegendItemCount = model.data.length - visibleLegendItems.length;
  const legendEntries = hiddenLegendItemCount > 0
    ? [...visibleLegendItems.map((item) => ({ item, label: item.label })), { item: null, label: model.locale === "zh-TW" ? `＋${hiddenLegendItemCount} 個其他項目` : `+${hiddenLegendItemCount} more` }]
    : visibleLegendItems.map((item) => ({ item, label: item.label }));
  const legendColumns = denseLegend ? 2 : 1;
  const legendRows = Math.max(Math.ceil(legendEntries.length / legendColumns), 1);
  const legend = model.showLabels ? legendEntries.map((entry, index) => {
    const column = Math.floor(index / legendRows);
    const row = index % legendRows;
    const legendX = wide
      ? layout.width * (denseLegend ? .54 : .66) + column * ((layout.width * (denseLegend ? .42 : .3)) / legendColumns)
      : layout.width * .1 + column * (layout.width * .8 / legendColumns);
    const legendHeight = wide ? layout.height * .68 : layout.height * (denseLegend ? .4 : .25);
    const itemHeight = clamp(legendHeight / legendRows, 22, 48);
    const markerSize = clamp(itemHeight * 0.38, 12, 18);
    const legendY = (wide ? layout.height * .17 : denseLegend ? layout.height * .55 : layout.height * .7) + row * itemHeight;
    const legendWidth = wide ? layout.width * (denseLegend ? .42 : .3) / legendColumns : layout.width * .8 / legendColumns;
    const valueX = legendWidth - 8;
    const label = truncateLegendLabel(entry.label, legendColumns);
    return `<g class="chart-series chart-legend-item" style="--chart-delay:${320 + index * 75}ms" transform="translate(${round(legendX)} ${round(legendY)})"><rect fill="${entry.item ? chartColor(model, index, appearance) : "none"}" fill-opacity="${entry.item ? chartOpacity(model, index) : 0}" height="${round(markerSize)}" rx="${round(appearance === "editor-modern" ? markerSize / 2 : markerSize / 3)}" stroke="${entry.item ? "none" : "currentColor"}" stroke-dasharray="3 2" width="${round(markerSize)}"/>${showCategoryLabel(model) ? `<text class="chart-legend" x="${round(markerSize + 14)}" y="${round(markerSize * 0.78)}">${escapeXml(label)}</text>` : ""}${entry.item && showValueLabel(model) ? `<text class="chart-legend-value" text-anchor="end" x="${round(valueX)}" y="${round(markerSize * 0.78)}">${formatMotionDocChartValue(model, entry.item.value)}</text>` : ""}</g>`;
  }).join("") : "";
  const centerMetric = donut && appearance === "editor-modern"
    ? `<g class="chart-center-metric" style="--chart-delay:220ms"><text text-anchor="middle" x="${round(cx)}" y="${round(cy - 2)}">${formatMotionDocChartValue(model, total)}</text><text class="chart-center-label" text-anchor="middle" x="${round(cx)}" y="${round(cy + 22)}">${model.locale === "zh-TW" ? "總計" : "Total"}</text></g>`
    : "";
  const annotation = model.annotationText
    ? `<text class="chart-annotation-text" fill="${model.annotationColor}" text-anchor="end" x="${round(layout.width - 20)}" y="${round(layout.height * .08)}">${escapeXml(model.annotationText)}</text>`
    : "";
  return `<g class="chart-radial">${slices}</g>${centerMetric}${legend}${annotation}`;
}

function truncateLegendLabel(value: string, columns: number) {
  const maximum = columns > 1 ? 11 : 24;
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function renderScatter(model: MotionDocChartModel, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const xValues = model.data.map((item, index) => item.x ?? index + 1);
  const yValues = model.data.map((item) => item.value);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(0, ...yValues, model.referenceValue ?? 0);
  const yMax = niceMaximum(Math.max(...yValues, model.referenceValue ?? 0, 1));
  const circles = model.data.map((item, index) => {
    const x = plot.left + ((item.x ?? index + 1) - xMin) / Math.max(xMax - xMin, 1) * (plot.right - plot.left);
    const y = plot.bottom - (item.value - yMin) / Math.max(yMax - yMin, 1) * (plot.bottom - plot.top);
    const radius = Math.min(item.size ?? 10, Math.max((plot.bottom - plot.top) * 0.08, 6));
    return `<g class="chart-series" style="--chart-delay:${index * 70}ms"><circle class="chart-bubble" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" fill-opacity="${round(chartOpacity(model, index) * (appearance === "editor-modern" ? .9 : .78))}" r="${radius}"/>${showCategoryLabel(model) ? `<text class="chart-value" text-anchor="middle" x="${round(x)}" y="${round(y - radius - 10)}">${escapeXml(item.label)}</text>` : ""}${showValueLabel(model) ? `<text class="chart-label" text-anchor="middle" x="${round(x)}" y="${round(y + radius + 18)}">${formatMotionDocChartValue(model, item.value)}</text>` : ""}</g>`;
  }).join("");
  const annotationIndex = model.annotationIndex ?? model.emphasisIndex;
  const annotationItem = annotationIndex === null ? undefined : model.data[annotationIndex];
  const annotation = annotationItem && model.annotationText
    ? renderPointAnnotation(
      model,
      plot.left + ((annotationItem.x ?? annotationIndex! + 1) - xMin) / Math.max(xMax - xMin, 1) * (plot.right - plot.left),
      plot.bottom - (annotationItem.value - yMin) / Math.max(yMax - yMin, 1) * (plot.bottom - plot.top),
      layout
    )
    : "";
  return `${model.showAxes ? renderGrid(model, yMax, 4, layout, yMin, model.showGrid) : ""}${renderReferenceLine(model, yMax, layout, yMin)}${circles}${annotation}`;
}

function renderGrid(model: MotionDocChartModel, maximum: number, count: number, layout: ChartLayout, minimum = 0, showGrid = true) {
  const { plot } = layout;
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = minimum + (maximum - minimum) * index / count;
    const y = plot.bottom - index / count * (plot.bottom - plot.top);
    return `${showGrid ? `<line class="chart-grid${index === 0 ? " chart-grid--baseline" : ""}" x1="${plot.left}" x2="${plot.right}" y1="${round(y)}" y2="${round(y)}"/>` : ""}<text class="chart-axis-label" text-anchor="end" x="${round(plot.left - 16)}" y="${round(y + 5)}">${formatMotionDocChartValue(model, value)}</text>`;
  }).join("");
}

function renderReferenceLine(model: MotionDocChartModel, maximum: number, layout: ChartLayout, minimum = 0) {
  if (model.referenceValue === null) return "";
  const { plot } = layout;
  const y = plot.bottom - (model.referenceValue - minimum) / Math.max(maximum - minimum, 1) * (plot.bottom - plot.top);
  const label = model.referenceLabel || formatMotionDocChartValue(model, model.referenceValue);
  return `<g class="chart-reference" style="--chart-reference-color:${model.referenceColor}"><line x1="${plot.left}" x2="${plot.right}" y1="${round(y)}" y2="${round(y)}"/><text text-anchor="end" x="${plot.right}" y="${round(y - 8)}">${escapeXml(label)}</text></g>`;
}

function renderPointAnnotation(model: MotionDocChartModel, x: number, y: number, layout: ChartLayout) {
  const anchorRight = x > layout.width * .64;
  const targetX = clamp(x + (anchorRight ? -32 : 32), 18, layout.width - 18);
  const targetY = clamp(y - 38, 18, layout.height - 18);
  return `<g class="chart-annotation" style="--chart-annotation-color:${model.annotationColor}"><line x1="${round(x)}" x2="${round(targetX)}" y1="${round(y)}" y2="${round(targetY)}"/><circle cx="${round(x)}" cy="${round(y)}" r="4"/><text text-anchor="${anchorRight ? "end" : "start"}" x="${round(targetX + (anchorRight ? -6 : 6))}" y="${round(targetY - 4)}">${escapeXml(model.annotationText)}</text></g>`;
}

function chartLayout(frame?: MotionDocFrame, appearance: MotionDocChartAppearance = "default"): ChartLayout {
  const width = frame
    ? Math.max(240, round(frame.w / 100 * MOTION_DOC_CANVAS_WIDTH))
    : WIDTH;
  const height = frame
    ? Math.max(160, round(frame.h / 100 * MOTION_DOC_CANVAS_HEIGHT))
    : HEIGHT;
  const horizontalInset = clamp(width * (appearance === "editor-modern" ? 0.07 : 0.085), 42, 76);
  const rightInset = clamp(width * (appearance === "editor-modern" ? 0.035 : 0.04), 20, 42);
  const topInset = clamp(height * (appearance === "editor-modern" ? 0.1 : 0.075), 18, 38);
  const bottomInset = clamp(height * (appearance === "editor-modern" ? 0.16 : 0.17), 44, 66);

  return {
    height,
    labelY: round(height - clamp(height * 0.055, 20, 30)),
    plot: {
      bottom: round(height - bottomInset),
      left: round(horizontalInset),
      right: round(width - rightInset),
      top: round(topInset)
    },
    width
  };
}

function chartColor(model: MotionDocChartModel, index: number, _appearance: MotionDocChartAppearance) {
  if (model.data[index]?.color) return chartDatumColor(model, index);
  if (model.colorMode === "single" || model.colorMode === "emphasis") {
    return model.palette[0];
  }
  return chartDatumColor(model, index);
}

function chartOpacity(model: MotionDocChartModel, index: number) {
  if (model.colorMode !== "emphasis" || model.emphasisIndex === null) {
    return 1;
  }
  return index === model.emphasisIndex ? 1 : .24;
}

function showValueLabel(model: MotionDocChartModel) {
  return model.showLabels && (model.labelMode === "all" || model.labelMode === "value");
}

function showCategoryLabel(model: MotionDocChartModel) {
  return model.showLabels && (model.labelMode === "all" || model.labelMode === "category");
}

function valueLabel(model: MotionDocChartModel, value: number, x: number, y: number) {
  return showValueLabel(model)
    ? `<text class="chart-value" text-anchor="middle" x="${x}" y="${y}">${formatMotionDocChartValue(model, value)}</text>`
    : "";
}

function categoryLabel(model: MotionDocChartModel, label: string, x: number, y: number) {
  return showCategoryLabel(model)
    ? `<text class="chart-label" text-anchor="middle" x="${x}" y="${y}">${escapeXml(label)}</text>`
    : "";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${round(point.x)} ${round(point.y)}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${round(controlX)} ${round(previous.y)}, ${round(controlX)} ${round(point.y)}, ${round(point.x)} ${round(point.y)}`;
  }, "");
}

function straightPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
}

function radialSlicePath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const safeEnd = end - start >= 360 ? end - 0.001 : end;
  const outerStart = polar(cx, cy, outer, start);
  const outerEnd = polar(cx, cy, outer, safeEnd);
  const large = safeEnd - start > 180 ? 1 : 0;
  if (inner <= 0) return `M ${cx} ${cy} L ${round(outerStart.x)} ${round(outerStart.y)} A ${outer} ${outer} 0 ${large} 1 ${round(outerEnd.x)} ${round(outerEnd.y)} Z`;
  const innerEnd = polar(cx, cy, inner, safeEnd);
  const innerStart = polar(cx, cy, inner, start);
  return `M ${round(outerStart.x)} ${round(outerStart.y)} A ${outer} ${outer} 0 ${large} 1 ${round(outerEnd.x)} ${round(outerEnd.y)} L ${round(innerEnd.x)} ${round(innerEnd.y)} A ${inner} ${inner} 0 ${large} 0 ${round(innerStart.x)} ${round(innerStart.y)} Z`;
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function niceMaximum(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  return Math.ceil(value / magnitude) * magnitude;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
