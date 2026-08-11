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

export type MotionDocChartDatum = {
  color?: string;
  label: string;
  size?: number;
  value: number;
  x?: number;
};

export type MotionDocChartModel = {
  data: MotionDocChartDatum[];
  motion: Exclude<MotionDocChartMotion, "auto">;
  palette: readonly string[];
  showAxes: boolean;
  showLabels: boolean;
  type: MotionDocChartType;
};

const chartPalettes = {
  aurora: ["#7c3aed", "#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"],
  editorial: ["#111827", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"],
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

export function isMotionDocChartType(value: unknown): value is MotionDocChartType {
  return motionDocChartTypes.includes(value as MotionDocChartType);
}

export function normalizeMotionDocChartType(value: unknown): MotionDocChartType {
  return isMotionDocChartType(value) ? value : "bar";
}

export function isMotionDocChartMotion(value: unknown): value is MotionDocChartMotion {
  return motionDocChartMotions.includes(value as MotionDocChartMotion);
}

export function parseMotionDocChartData(value: unknown): MotionDocChartDatum[] {
  if (typeof value !== "string" || !value.trim()) return defaultMotionDocChartData;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return defaultMotionDocChartData;
  }

  if (!Array.isArray(parsed)) return defaultMotionDocChartData;
  const data = parsed.flatMap((item, index): MotionDocChartDatum[] => {
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
  });

  return data.length > 0 ? data.slice(0, 24) : defaultMotionDocChartData;
}

export function validateMotionDocChartProps(props: MotionDocProps) {
  const issues: string[] = [];
  if (!isMotionDocChartType(props.type)) {
    issues.push(`type must be one of: ${motionDocChartTypes.join(", ")}.`);
  }
  if (props.chartMotion !== undefined && !isMotionDocChartMotion(props.chartMotion)) {
    issues.push(`chartMotion must be one of: ${motionDocChartMotions.join(", ")}.`);
  }
  if (typeof props.data !== "string") {
    issues.push("data must be a JSON string.");
  } else {
    try {
      const parsed = JSON.parse(props.data);
      if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 24) {
        issues.push("data must contain between 1 and 24 rows.");
      } else if (parsed.some((item) => !item || typeof item !== "object" || !Number.isFinite(Number((item as Record<string, unknown>).value)))) {
        issues.push("every chart row must include a finite numeric value.");
      }
    } catch {
      issues.push("data must contain valid JSON.");
    }
  }
  return issues;
}

export function motionDocChartModel(props: MotionDocProps): MotionDocChartModel {
  const type = normalizeMotionDocChartType(props.type);
  const requestedMotion = isMotionDocChartMotion(props.chartMotion) ? props.chartMotion : "auto";
  const defaultMotion: MotionDocChartModel["motion"] =
    type === "bar" ? "grow" :
      type === "line" || type === "area" ? "draw" :
        type === "scatter" ? "pop" : "sweep";
  const paletteName = typeof props.palette === "string" && props.palette in chartPalettes
    ? props.palette as keyof typeof chartPalettes
    : "aurora";

  return {
    data: parseMotionDocChartData(props.data),
    motion: requestedMotion === "auto" ? defaultMotion : requestedMotion,
    palette: chartPalettes[paletteName],
    showAxes: props.showAxes !== "false" && props.showAxes !== 0,
    showLabels: props.showLabels !== "false" && props.showLabels !== 0,
    type
  };
}

export function chartDatumColor(model: MotionDocChartModel, index: number) {
  return model.data[index]?.color ?? model.palette[index % model.palette.length];
}
