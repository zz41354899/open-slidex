import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const motionDocChartTypes = [
  "bar",
  "line",
  "area",
  "pie",
  "donut",
  "scatter"
] as const;

export type MotionDocChartType = (typeof motionDocChartTypes)[number];

export const motionDocChartMotions = [
  "auto",
  "grow",
  "draw",
  "sweep",
  "pop",
  "none"
] as const;

export type MotionDocChartMotion = (typeof motionDocChartMotions)[number];

export const motionDocChartColorModes = [
  "palette",
  "single",
  "emphasis",
  "gradient"
] as const;

export type MotionDocChartColorMode = (typeof motionDocChartColorModes)[number];

export const motionDocChartLabelModes = [
  "all",
  "value",
  "category",
  "none"
] as const;

export type MotionDocChartLabelMode = (typeof motionDocChartLabelModes)[number];

export const motionDocChartBarGaps = ["compact", "balanced", "airy"] as const;
export type MotionDocChartBarGap = (typeof motionDocChartBarGaps)[number];

export const motionDocChartPresetNames = ["executive", "minimal", "vivid"] as const;
export type MotionDocChartPreset = (typeof motionDocChartPresetNames)[number];

export const motionDocChartNumberFormats = ["auto", "integer", "decimal", "percent", "currency", "compact"] as const;
export type MotionDocChartNumberFormat = (typeof motionDocChartNumberFormats)[number];

export const motionDocChartSortModes = ["input", "ascending", "descending"] as const;
export type MotionDocChartSortMode = (typeof motionDocChartSortModes)[number];

export const motionDocChartThemes = ["light", "dark-gold"] as const;
export type MotionDocChartTheme = (typeof motionDocChartThemes)[number];

export const motionDocChartLocales = ["en", "zh-TW"] as const;
export type MotionDocChartLocale = (typeof motionDocChartLocales)[number];

export type MotionDocChartDatum = {
  color?: string;
  label: string;
  size?: number;
  value: number;
  x?: number;
};

export type MotionDocChartDataByType = Partial<Record<MotionDocChartType, MotionDocChartDatum[]>>;

export type MotionDocChartModel = {
  annotationColor: string;
  annotationIndex: number | null;
  annotationText: string;
  areaOpacity: number;
  areaOpacityCustom: boolean;
  barGap: MotionDocChartBarGap;
  barRadius: number;
  barRadiusCustom: boolean;
  chartPreset: MotionDocChartPreset;
  colorMode: MotionDocChartColorMode;
  currency: string;
  data: MotionDocChartDatum[];
  decimals: number;
  donutHole: number;
  donutHoleCustom: boolean;
  emphasisIndex: number | null;
  labelMode: MotionDocChartLabelMode;
  labelColor: string | null;
  lineSmooth: boolean;
  locale: MotionDocChartLocale;
  motion: Exclude<MotionDocChartMotion, "auto">;
  numberFormat: MotionDocChartNumberFormat;
  palette: readonly string[];
  referenceColor: string;
  referenceLabel: string;
  referenceValue: number | null;
  showAxes: boolean;
  showGrid: boolean;
  showLabels: boolean;
  sort: MotionDocChartSortMode;
  theme: MotionDocChartTheme;
  type: MotionDocChartType;
};

const chartPalettes = {
  aurora: ["#7c3aed", "#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"],
  editorial: ["#111827", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"],
  gilded: ["#f6df9a", "#d9ad4a", "#ae7926", "#fff0b8", "#8e5e1e", "#e7c46d"],
  ocean: ["#2563eb", "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16"],
  sunset: ["#e11d48", "#f43f5e", "#f97316", "#f59e0b", "#eab308", "#a855f7"]
} as const;

export const motionDocChartPaletteNames = Object.keys(chartPalettes) as Array<keyof typeof chartPalettes>;

export const defaultMotionDocChartData: MotionDocChartDatum[] = [
  { label: "Q1", value: 42 },
  { label: "Q2", value: 58 },
  { label: "Q3", value: 73 },
  { label: "Q4", value: 91 }
];

const defaultChartDataByType: Record<MotionDocChartType, readonly MotionDocChartDatum[]> = {
  area: [
    { label: "Week 1", value: 18 },
    { label: "Week 2", value: 31 },
    { label: "Week 3", value: 27 },
    { label: "Week 4", value: 46 }
  ],
  bar: defaultMotionDocChartData,
  donut: [
    { label: "Direct", value: 128 },
    { label: "Organic", value: 96 },
    { label: "Referral", value: 74 },
    { label: "Paid", value: 66 }
  ],
  line: [
    { label: "Jan", value: 34 },
    { label: "Feb", value: 49 },
    { label: "Mar", value: 45 },
    { label: "Apr", value: 63 }
  ],
  pie: [
    { label: "Product", value: 46 },
    { label: "Service", value: 31 },
    { label: "Partner", value: 23 }
  ],
  scatter: [
    { label: "Alpha", size: 16, value: 28, x: 12 },
    { label: "Beta", size: 22, value: 47, x: 26 },
    { label: "Gamma", size: 13, value: 35, x: 41 },
    { label: "Delta", size: 28, value: 61, x: 58 }
  ]
};

const defaultChartDataByTypeZhTw: Record<MotionDocChartType, readonly MotionDocChartDatum[]> = {
  area: [
    { label: "第 1 週", value: 18 },
    { label: "第 2 週", value: 31 },
    { label: "第 3 週", value: 27 },
    { label: "第 4 週", value: 46 }
  ],
  bar: defaultMotionDocChartData,
  donut: [
    { label: "直接流量", value: 128 },
    { label: "自然流量", value: 96 },
    { label: "推薦流量", value: 74 },
    { label: "付費流量", value: 66 }
  ],
  line: [
    { label: "一月", value: 34 },
    { label: "二月", value: 49 },
    { label: "三月", value: 45 },
    { label: "四月", value: 63 }
  ],
  pie: [
    { label: "產品", value: 46 },
    { label: "服務", value: 31 },
    { label: "合作夥伴", value: 23 }
  ],
  scatter: [
    { label: "甲", size: 16, value: 28, x: 12 },
    { label: "乙", size: 22, value: 47, x: 26 },
    { label: "丙", size: 13, value: 35, x: 41 },
    { label: "丁", size: 28, value: 61, x: 58 }
  ]
};

const chartMotionOptionsByType: Record<MotionDocChartType, readonly MotionDocChartMotion[]> = {
  area: ["auto", "draw", "sweep", "grow", "none"],
  bar: ["auto", "grow", "sweep", "pop", "none"],
  donut: ["auto", "sweep", "pop", "none"],
  line: ["auto", "draw", "sweep", "grow", "none"],
  pie: ["auto", "sweep", "pop", "none"],
  scatter: ["auto", "pop", "sweep", "none"]
};

export function isMotionDocChartType(value: unknown): value is MotionDocChartType {
  return motionDocChartTypes.includes(value as MotionDocChartType);
}

export function normalizeMotionDocChartType(value: unknown): MotionDocChartType {
  return isMotionDocChartType(value) ? value : "bar";
}

export function isMotionDocChartMotion(value: unknown): value is MotionDocChartMotion {
  return motionDocChartMotions.includes(value as MotionDocChartMotion);
}

export function motionDocChartMotionOptions(type: MotionDocChartType) {
  return chartMotionOptionsByType[type];
}

export function normalizeMotionDocChartLocale(value: unknown): MotionDocChartLocale {
  return value === "zh-TW" ? "zh-TW" : "en";
}

export function motionDocChartMaximumRows(type: MotionDocChartType) {
  return isCircularChart(type) ? 8 : 24;
}

export function defaultMotionDocChartDataForType(type: MotionDocChartType, locale: MotionDocChartLocale = "en"): MotionDocChartDatum[] {
  const source = locale === "zh-TW" ? defaultChartDataByTypeZhTw : defaultChartDataByType;
  return source[type].map((item) => ({ ...item }));
}

function isMotionDocChartColorMode(value: unknown): value is MotionDocChartColorMode {
  return motionDocChartColorModes.includes(value as MotionDocChartColorMode);
}

function isMotionDocChartLabelMode(value: unknown): value is MotionDocChartLabelMode {
  return motionDocChartLabelModes.includes(value as MotionDocChartLabelMode);
}

function isMotionDocChartBarGap(value: unknown): value is MotionDocChartBarGap {
  return motionDocChartBarGaps.includes(value as MotionDocChartBarGap);
}

function isMotionDocChartPreset(value: unknown): value is MotionDocChartPreset {
  return motionDocChartPresetNames.includes(value as MotionDocChartPreset);
}

function isMotionDocChartNumberFormat(value: unknown): value is MotionDocChartNumberFormat {
  return motionDocChartNumberFormats.includes(value as MotionDocChartNumberFormat);
}

function isMotionDocChartSortMode(value: unknown): value is MotionDocChartSortMode {
  return motionDocChartSortModes.includes(value as MotionDocChartSortMode);
}

function isMotionDocChartTheme(value: unknown): value is MotionDocChartTheme {
  return motionDocChartThemes.includes(value as MotionDocChartTheme);
}

export function parseMotionDocChartData(value: unknown): MotionDocChartDatum[] {
  const data = parseChartDatumArray(value);
  return data.length > 0 ? data : defaultMotionDocChartData;
}

export function parseMotionDocChartDataByType(value: unknown): MotionDocChartDataByType {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return motionDocChartTypes.reduce<MotionDocChartDataByType>((result, type) => {
      const data = parseChartDatumArray((parsed as Record<string, unknown>)[type]);
      if (data.length > 0) result[type] = data;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function motionDocChartDataForType(props: MotionDocProps, type: MotionDocChartType, locale?: MotionDocChartLocale) {
  const chartLocale = normalizeMotionDocChartLocale(locale ?? props.chartLocale);
  const storedData = parseMotionDocChartDataByType(props.chartDataByType)[type];
  const source = storedData ?? parseChartDatumArray(props.data);
  const data = source.length > 0 ? source : defaultMotionDocChartDataForType(type, chartLocale);
  return isCircularChart(type) ? data.map((item) => ({ ...item, value: Math.max(item.value, 0) })) : data;
}

function isCircularChart(type: MotionDocChartType) {
  return type === "pie" || type === "donut";
}

function parseChartDatumArray(value: unknown): MotionDocChartDatum[] {
  let parsed: unknown;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  } else {
    parsed = value;
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item, index): MotionDocChartDatum[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const valueNumber = Number(record.value);
    if (!Number.isFinite(valueNumber)) return [];
    const x = Number(record.x);
    const size = Number(record.size);
    const color = typeof record.color === "string" && /^#[0-9a-f]{6}$/i.test(record.color)
      ? record.color
      : undefined;

    return [{
      color,
      label: typeof record.label === "string" && record.label.trim()
        ? record.label.trim().slice(0, 80)
        : `Item ${index + 1}`,
      size: Number.isFinite(size) ? Math.min(Math.max(size, 4), 48) : undefined,
      value: valueNumber,
      x: Number.isFinite(x) ? x : undefined
    }];
  }).slice(0, 24);
}

export function validateMotionDocChartProps(props: MotionDocProps) {
  const issues: string[] = [];
  const type = normalizeMotionDocChartType(props.type);
  if (!isMotionDocChartType(props.type)) {
    issues.push(`type must be one of: ${motionDocChartTypes.join(", ")}.`);
  }
  if (props.chartMotion !== undefined && !isMotionDocChartMotion(props.chartMotion)) {
    issues.push(`chartMotion must be one of: ${motionDocChartMotions.join(", ")}.`);
  }
  if (props.colorMode !== undefined && !isMotionDocChartColorMode(props.colorMode)) {
    issues.push(`colorMode must be one of: ${motionDocChartColorModes.join(", ")}.`);
  }
  if (props.labelMode !== undefined && !isMotionDocChartLabelMode(props.labelMode)) {
    issues.push(`labelMode must be one of: ${motionDocChartLabelModes.join(", ")}.`);
  }
  if (props.barGap !== undefined && !isMotionDocChartBarGap(props.barGap)) {
    issues.push(`barGap must be one of: ${motionDocChartBarGaps.join(", ")}.`);
  }
  if (props.chartPreset !== undefined && !isMotionDocChartPreset(props.chartPreset)) {
    issues.push(`chartPreset must be one of: ${motionDocChartPresetNames.join(", ")}.`);
  }
  if (props.numberFormat !== undefined && !isMotionDocChartNumberFormat(props.numberFormat)) {
    issues.push(`numberFormat must be one of: ${motionDocChartNumberFormats.join(", ")}.`);
  }
  if (props.sort !== undefined && !isMotionDocChartSortMode(props.sort)) {
    issues.push(`sort must be one of: ${motionDocChartSortModes.join(", ")}.`);
  }
  if (props.chartTheme !== undefined && !isMotionDocChartTheme(props.chartTheme)) {
    issues.push(`chartTheme must be one of: ${motionDocChartThemes.join(", ")}.`);
  }
  if (typeof props.data !== "string") {
    issues.push("data must be a JSON string.");
  } else {
    try {
      const parsed = JSON.parse(props.data);
      const maximumRows = motionDocChartMaximumRows(type);
      if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > maximumRows) {
        issues.push(`data must contain between 1 and ${maximumRows} rows for a ${type} chart.`);
      } else if (parsed.some((item) => !item || typeof item !== "object" || !Number.isFinite(Number((item as Record<string, unknown>).value)))) {
        issues.push("every chart row must include a finite numeric value.");
      } else if (isCircularChart(type) && parsed.some((item) => Number((item as Record<string, unknown>).value) < 0)) {
        issues.push("pie and donut chart values must be zero or greater.");
      }
    } catch {
      issues.push("data must contain valid JSON.");
    }
  }
  return issues;
}

export function motionDocChartModel(props: MotionDocProps, locale?: MotionDocChartLocale): MotionDocChartModel {
  const type = normalizeMotionDocChartType(props.type);
  const chartLocale = normalizeMotionDocChartLocale(locale ?? props.chartLocale);
  const theme = isMotionDocChartTheme(props.chartTheme) ? props.chartTheme : "light";
  const chartPreset = isMotionDocChartPreset(props.chartPreset) ? props.chartPreset : smartChartPreset(type);
  const presetProps = motionDocChartPresetProps(chartPreset, type);
  const requestedMotion = isMotionDocChartMotion(props.chartMotion) ? props.chartMotion : "auto";
  const defaultMotion: MotionDocChartModel["motion"] =
    type === "bar" ? "grow" :
      type === "line" || type === "area" ? "draw" :
        type === "scatter" ? "pop" : "sweep";
  const paletteCandidate = theme === "dark-gold" ? "gilded" : props.palette ?? presetProps.palette;
  const paletteName = typeof paletteCandidate === "string" && paletteCandidate in chartPalettes
    ? paletteCandidate as keyof typeof chartPalettes
    : "aurora";
  const labelMode = isMotionDocChartLabelMode(props.labelMode)
    ? props.labelMode
    : props.showLabels === "false" || props.showLabels === 0
      ? "none"
      : isMotionDocChartLabelMode(presetProps.labelMode)
        ? presetProps.labelMode
        : "all";
  const motion = requestedMotion === "auto" || !motionDocChartMotionOptions(type).includes(requestedMotion)
    ? defaultMotion
    : requestedMotion;
  const sourceData = motionDocChartDataForType(props, type, chartLocale);
  const sort = isMotionDocChartSortMode(props.sort) ? props.sort : "input";
  const data = sortMotionDocChartData(sourceData, sort);
  const colorMode = isMotionDocChartColorMode(props.colorMode ?? presetProps.colorMode)
    ? (props.colorMode ?? presetProps.colorMode) as MotionDocChartColorMode
    : "palette";
  const emphasisIndex = finiteNumber(props.emphasisIndex);
  const areaOpacity = finiteNumber(props.areaOpacity ?? presetProps.areaOpacity);
  const barRadius = finiteNumber(props.barRadius ?? presetProps.barRadius);
  const donutHole = finiteNumber(props.donutHole ?? presetProps.donutHole);
  const referenceValue = finiteNumber(props.referenceValue);
  const annotationIndex = finiteNumber(props.annotationIndex);
  const numberFormat = isMotionDocChartNumberFormat(props.numberFormat) ? props.numberFormat : "auto";
  const decimals = clampNumber(finiteNumber(props.decimals), 0, 3, numberFormat === "decimal" ? 1 : 0);
  const defaultEmphasisIndex = highestValueIndex(data);

  return {
    annotationColor: validHexColor(props.annotationColor, "#dc2626"),
    annotationIndex: annotationIndex === undefined
      ? null
      : Math.min(Math.max(Math.floor(annotationIndex), 0), Math.max(data.length - 1, 0)),
    annotationText: stringProp(props.annotationText, 120),
    areaOpacity: clampNumber(areaOpacity, 20, 70, 32) / 100,
    areaOpacityCustom: areaOpacity !== undefined,
    barGap: isMotionDocChartBarGap(props.barGap ?? presetProps.barGap)
      ? (props.barGap ?? presetProps.barGap) as MotionDocChartBarGap
      : "balanced",
    barRadius: clampNumber(barRadius, 0, 999, 10),
    barRadiusCustom: barRadius !== undefined,
    chartPreset,
    colorMode,
    currency: currencyCode(props.currency),
    data,
    decimals,
    donutHole: clampNumber(donutHole, 42, 78, 64) / 100,
    donutHoleCustom: donutHole !== undefined,
    emphasisIndex: emphasisIndex === undefined
      ? colorMode === "emphasis" ? defaultEmphasisIndex : null
      : Math.min(Math.max(Math.floor(emphasisIndex), 0), Math.max(data.length - 1, 0)),
    labelMode,
    labelColor: validOptionalHexColor(props.labelColor),
    lineSmooth: (props.lineSmooth ?? presetProps.lineSmooth) !== "false" && (props.lineSmooth ?? presetProps.lineSmooth) !== 0,
    locale: chartLocale,
    motion,
    numberFormat,
    palette: chartPalettes[paletteName],
    referenceColor: validHexColor(props.referenceColor, "#dc2626"),
    referenceLabel: stringProp(props.referenceLabel, 80),
    referenceValue: referenceValue ?? null,
    showAxes: (props.showAxes ?? presetProps.showAxes) !== "false" && (props.showAxes ?? presetProps.showAxes) !== 0,
    showGrid: (props.showGrid ?? presetProps.showGrid) !== "false" && (props.showGrid ?? presetProps.showGrid) !== 0,
    showLabels: labelMode !== "none",
    sort,
    theme,
    type
  };
}

/**
 * Returns the longest visible chart motion for one rendered chart. The local
 * editor uses this to keep its temporary animated preview mounted until every
 * staggered data row has reached its final state.
 */
export function motionDocChartAnimationDuration(model: Pick<MotionDocChartModel, "data" | "motion" | "showLabels" | "type">) {
  if (model.motion === "none") return 0;

  const itemCount = Math.max(model.data.length, 1);
  const stagger = model.type === "line" || model.type === "area" || model.type === "scatter" ? 70 : 75;
  const lastItemDelay = (itemCount - 1) * stagger;

  if (model.type === "pie" || model.type === "donut") {
    const radialMotion = model.motion === "sweep" ? 900 : lastItemDelay + 720;
    const legendMotion = model.showLabels ? 320 + lastItemDelay + 720 : 0;
    return Math.max(radialMotion, legendMotion, 640);
  }

  if (model.motion === "draw") {
    return Math.max(1_050, lastItemDelay + 240 + 420);
  }

  if (model.motion === "sweep") return 920;
  return lastItemDelay + 720;
}

export function motionDocChartThemeProps(theme: MotionDocChartTheme): MotionDocProps {
  return theme === "dark-gold"
    ? { chartTheme: theme, colorMode: "gradient", palette: "gilded" }
    : { chartTheme: theme, colorMode: "emphasis", palette: "ocean" };
}

export function chartDatumColor(model: MotionDocChartModel, index: number) {
  return model.data[index]?.color ?? model.palette[index % model.palette.length];
}

export function motionDocChartPresetProps(preset: MotionDocChartPreset, type: MotionDocChartType): MotionDocProps {
  const circular = type === "pie" || type === "donut";
  if (preset === "minimal") {
    return {
      areaOpacity: "20",
      barGap: "balanced",
      barRadius: "0",
      chartPreset: preset,
      colorMode: circular ? "palette" : "single",
      donutHole: "68",
      labelMode: "all",
      lineSmooth: "false",
      palette: "editorial",
      showAxes: String(!circular),
      showGrid: String(!circular)
    };
  }
  if (preset === "vivid") {
    return {
      areaOpacity: "42",
      barGap: "compact",
      barRadius: "0",
      chartPreset: preset,
      colorMode: circular ? "palette" : type === "bar" ? "gradient" : "single",
      donutHole: "60",
      labelMode: "all",
      lineSmooth: "true",
      palette: "aurora",
      showAxes: String(!circular),
      showGrid: "false"
    };
  }
  return {
    areaOpacity: "26",
    barGap: "balanced",
    barRadius: "0",
    chartPreset: "executive",
    colorMode: circular ? "palette" : type === "bar" ? "emphasis" : "single",
    donutHole: "64",
    labelMode: "all",
    lineSmooth: "true",
    palette: circular ? "editorial" : "ocean",
    showAxes: String(!circular),
    showGrid: "false"
  };
}

export function sortMotionDocChartData(data: MotionDocChartDatum[], sort: MotionDocChartSortMode) {
  if (sort === "input") return data;
  return [...data].sort((a, b) => sort === "ascending" ? a.value - b.value : b.value - a.value);
}

export function formatMotionDocChartValue(model: Pick<MotionDocChartModel, "currency" | "decimals" | "numberFormat"> & Partial<Pick<MotionDocChartModel, "locale">>, value: number) {
  const locale = model.locale === "zh-TW" ? "zh-TW" : "en-US";
  if (model.numberFormat === "percent") {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: model.decimals, minimumFractionDigits: model.decimals }).format(value)}%`;
  }
  if (model.numberFormat === "currency") {
    return new Intl.NumberFormat(locale, {
      currency: model.currency,
      maximumFractionDigits: model.decimals,
      minimumFractionDigits: model.decimals,
      style: "currency"
    }).format(value);
  }
  if (model.numberFormat === "compact") {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: Math.max(model.decimals, 1), notation: "compact" }).format(value);
  }
  if (model.numberFormat === "integer") {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  }
  if (model.numberFormat === "decimal") {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: model.decimals, minimumFractionDigits: model.decimals }).format(value);
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

function smartChartPreset(type: MotionDocChartType): MotionDocChartPreset {
  return type === "line" || type === "area" ? "minimal" : "executive";
}

function highestValueIndex(data: MotionDocChartDatum[]) {
  return data.reduce((best, item, index) => item.value > (data[best]?.value ?? Number.NEGATIVE_INFINITY) ? index : best, 0);
}

function validOptionalHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function validHexColor(value: unknown, fallback: string) {
  return validOptionalHexColor(value) ?? fallback;
}

function currencyCode(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "USD";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function stringProp(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = finiteNumber(value);
  return Math.min(Math.max(number ?? fallback, minimum), maximum);
}
