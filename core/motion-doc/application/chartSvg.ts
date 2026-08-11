import {
  chartDatumColor,
  motionDocChartModel,
  type MotionDocChartModel
} from "@/core/motion-doc/domain/chart";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";

const WIDTH = 800;
const HEIGHT = 420;
type ChartLayout = { height: number; labelY: number; plot: { bottom: number; left: number; right: number; top: number }; width: number };
type MotionDocChartAppearance = "default" | "editor-modern";

const modernChartPalette = ["#6670f2", "#747df3", "#828af4", "#9097f5", "#9ea5f6", "#acb3f7"] as const;

export type MotionDocChartRenderOptions = {
  appearance?: MotionDocChartAppearance;
  frame?: MotionDocFrame;
  motionMode?: "animated" | "editor-static";
};

export function renderMotionDocChartSvg(props: MotionDocProps, options: MotionDocChartRenderOptions = {}) {
  const model = motionDocChartModel(props);
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
  const appearanceStyle = appearance === "editor-modern"
    ? ` style="--chart-label-size:${round(clamp(Math.min(layout.width, layout.height) * 0.052, 19, 32))}px;--chart-value-size:${round(clamp(Math.min(layout.width, layout.height) * 0.06, 22, 36))}px;--chart-center-size:${round(clamp(Math.min(layout.width, layout.height) * 0.075, 28, 46))}px"`
    : "";
  return `<svg class="motion-chart motion-chart--${model.type} motion-chart--${model.motion}${appearanceClass}${staticClass}"${appearanceStyle} role="img" aria-label="${title}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${title}</title><g class="chart-content">${content}</g></svg>`;
}

function renderBars(model: MotionDocChartModel, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const values = model.data.map((item) => Math.max(item.value, 0));
  const maximum = niceMaximum(Math.max(...values, 1));
  const plotWidth = plot.right - plot.left;
  const slot = plotWidth / Math.max(model.data.length, 1);
  const barWidth = Math.min(slot * (appearance === "editor-modern" ? 0.5 : 0.64), appearance === "editor-modern" ? 72 : 86);
  const grid = model.showAxes ? renderGrid(maximum, 4, layout) : "";
  const bars = model.data.map((item, index) => {
    const height = Math.max(item.value, 0) / maximum * (plot.bottom - plot.top);
    const x = plot.left + slot * index + (slot - barWidth) / 2;
    const y = plot.bottom - height;
    const delay = `${index * 70}ms`;
    return `<g class="chart-series" style="--chart-delay:${delay}"><rect class="chart-bar" fill="${chartColor(model, index, appearance)}" height="${round(height)}" rx="${appearance === "editor-modern" ? Math.min(barWidth / 7, 10) : Math.min(barWidth / 4, 18)}" width="${round(barWidth)}" x="${round(x)}" y="${round(y)}" />${model.showLabels ? `<text class="chart-value" text-anchor="middle" x="${round(x + barWidth / 2)}" y="${round(Math.max(y - 12, 18))}">${formatValue(item.value)}</text><text class="chart-label" text-anchor="middle" x="${round(x + barWidth / 2)}" y="${layout.labelY}">${escapeXml(item.label)}</text>` : ""}</g>`;
  }).join("");
  return `${grid}${bars}`;
}

function renderTrend(model: MotionDocChartModel, area: boolean, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const values = model.data.map((item) => item.value);
  const minimum = Math.min(0, ...values);
  const maximum = niceMaximum(Math.max(...values, 1));
  const range = Math.max(maximum - minimum, 1);
  const points = model.data.map((item, index) => ({
    item,
    x: plot.left + index / Math.max(model.data.length - 1, 1) * (plot.right - plot.left),
    y: plot.bottom - (item.value - minimum) / range * (plot.bottom - plot.top)
  }));
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${round(points.at(-1)?.x ?? plot.right)} ${plot.bottom} L ${round(points[0]?.x ?? plot.left)} ${plot.bottom} Z`;
  const gradientId = `chart-area-gradient-${stableId(`${model.type}:${model.data.map((item) => `${item.label}:${item.value}`).join("|")}`)}`;
  const labels = model.showLabels ? points.map(({ item, x, y }, index) => `<g class="chart-series" style="--chart-delay:${index * 70}ms">${appearance === "editor-modern" ? `<circle class="chart-point-halo" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" r="10" />` : ""}<circle class="chart-point" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" r="${appearance === "editor-modern" ? 4.5 : 6}" /><text class="chart-value" text-anchor="middle" x="${round(x)}" y="${round(y - 15)}">${formatValue(item.value)}</text><text class="chart-label" text-anchor="middle" x="${round(x)}" y="${layout.labelY}">${escapeXml(item.label)}</text></g>`).join("") : "";
  const primaryColor = chartColor(model, 0, appearance);
  return `${model.showAxes ? renderGrid(maximum, 4, layout, minimum) : ""}<defs><linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${primaryColor}" stop-opacity="${appearance === "editor-modern" ? ".2" : ".38"}"/><stop offset="1" stop-color="${primaryColor}" stop-opacity=".02"/></linearGradient></defs>${area ? `<path class="chart-area" d="${areaPath}" fill="url(#${gradientId})" />` : ""}<path class="chart-line" d="${linePath}" fill="none" stroke="${primaryColor}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${appearance === "editor-modern" ? 5 : 7}" pathLength="1" />${labels}`;
}

function renderRadial(model: MotionDocChartModel, donut: boolean, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const wide = layout.width / layout.height >= 1.45 && layout.width >= 520;
  const chartWidth = wide ? layout.width * 0.62 : layout.width;
  const cx = wide ? chartWidth * 0.5 : layout.width * 0.5;
  const cy = wide ? layout.height * 0.5 : layout.height * 0.37;
  const availableRadius = wide
    ? Math.min(chartWidth * 0.34, layout.height * 0.38)
    : Math.min(layout.width * 0.34, layout.height * 0.27);
  const outerRadius = Math.max(42, availableRadius);
  const innerRadius = donut ? outerRadius * (appearance === "editor-modern" ? 0.64 : 0.53) : 0;
  const total = model.data.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  let startAngle = -90;
  const slices = model.data.map((item, index) => {
    const angle = Math.max(item.value, 0) / total * 360;
    const endAngle = startAngle + angle;
    const path = radialSlicePath(cx, cy, outerRadius, innerRadius, startAngle, endAngle);
    const labelRadius = donut ? (outerRadius + innerRadius) / 2 : outerRadius * 0.66;
    const middle = polar(cx, cy, labelRadius, startAngle + angle / 2);
    const slice = `<path class="chart-slice" d="${path}" fill="${chartColor(model, index, appearance)}" style="--chart-delay:${index * 75}ms" />${model.showLabels && angle > 12 ? `<text class="chart-value chart-value--radial" text-anchor="middle" x="${round(middle.x)}" y="${round(middle.y)}">${Math.round(angle / 3.6)}%</text>` : ""}`;
    startAngle = endAngle;
    return slice;
  }).join("");
  const legend = model.showLabels ? model.data.map((item, index) => {
    const itemHeight = clamp(layout.height * 0.115, 32, 48);
    const markerSize = clamp(itemHeight * 0.38, 12, 18);
    const legendX = wide ? layout.width * 0.66 : layout.width * 0.12;
    const legendY = wide
      ? layout.height * 0.18 + index * itemHeight
      : layout.height * 0.7 + index * itemHeight;
    const valueX = wide ? layout.width * 0.28 : layout.width * 0.72;
    return `<g class="chart-legend-item" transform="translate(${round(legendX)} ${round(legendY)})"><rect fill="${chartColor(model, index, appearance)}" height="${round(markerSize)}" rx="${round(appearance === "editor-modern" ? markerSize / 2 : markerSize / 3)}" width="${round(markerSize)}"/><text class="chart-legend" x="${round(markerSize + 14)}" y="${round(markerSize * 0.78)}">${escapeXml(item.label)}</text><text class="chart-legend-value" text-anchor="end" x="${round(valueX)}" y="${round(markerSize * 0.78)}">${formatValue(item.value)}</text></g>`;
  }).join("") : "";
  const centerMetric = donut && appearance === "editor-modern"
    ? `<g class="chart-center-metric"><text text-anchor="middle" x="${round(cx)}" y="${round(cy - 2)}">${formatValue(total)}</text><text class="chart-center-label" text-anchor="middle" x="${round(cx)}" y="${round(cy + 22)}">Total</text></g>`
    : "";
  return `<g class="chart-radial">${slices}</g>${centerMetric}${legend}`;
}

function renderScatter(model: MotionDocChartModel, layout: ChartLayout, appearance: MotionDocChartAppearance) {
  const { plot } = layout;
  const xValues = model.data.map((item, index) => item.x ?? index + 1);
  const yValues = model.data.map((item) => item.value);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(0, ...yValues);
  const yMax = niceMaximum(Math.max(...yValues, 1));
  const circles = model.data.map((item, index) => {
    const x = plot.left + ((item.x ?? index + 1) - xMin) / Math.max(xMax - xMin, 1) * (plot.right - plot.left);
    const y = plot.bottom - (item.value - yMin) / Math.max(yMax - yMin, 1) * (plot.bottom - plot.top);
    const radius = Math.min(item.size ?? 10, Math.max((plot.bottom - plot.top) * 0.08, 6));
    return `<g class="chart-series" style="--chart-delay:${index * 70}ms"><circle class="chart-bubble" cx="${round(x)}" cy="${round(y)}" fill="${chartColor(model, index, appearance)}" fill-opacity="${appearance === "editor-modern" ? ".9" : ".78"}" r="${radius}"/>${model.showLabels ? `<text class="chart-value" text-anchor="middle" x="${round(x)}" y="${round(y - radius - 10)}">${escapeXml(item.label)}</text>` : ""}</g>`;
  }).join("");
  return `${model.showAxes ? renderGrid(yMax, 4, layout, yMin) : ""}${circles}`;
}

function renderGrid(maximum: number, count: number, layout: ChartLayout, minimum = 0) {
  const { plot } = layout;
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = minimum + (maximum - minimum) * index / count;
    const y = plot.bottom - index / count * (plot.bottom - plot.top);
    return `<line class="chart-grid${index === 0 ? " chart-grid--baseline" : ""}" x1="${plot.left}" x2="${plot.right}" y1="${round(y)}" y2="${round(y)}"/><text class="chart-axis-label" text-anchor="end" x="${round(plot.left - 16)}" y="${round(y + 5)}">${formatValue(value)}</text>`;
  }).join("");
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

function chartColor(model: MotionDocChartModel, index: number, appearance: MotionDocChartAppearance) {
  if (model.data[index]?.color) return chartDatumColor(model, index);
  return appearance === "editor-modern"
    ? modernChartPalette[index % modernChartPalette.length]
    : chartDatumColor(model, index);
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

function formatValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
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
