import type { MotionDocPropInput, MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  isMotionDocEnterAnimation,
  type MotionDocEnterAnimation
} from "@/core/motion-doc/domain/motionVocabulary";

export const MOTION_SEQUENCE_PROP = "motion";

export const motionActionStarts = ["onClick", "afterPrevious", "withPrevious"] as const;
export type MotionActionStart = (typeof motionActionStarts)[number];

export const motionEasings = ["linear", "easeIn", "easeOut", "easeInOut"] as const;
export type MotionEasing = (typeof motionEasings)[number];

export const motionExitPresets = ["fadeOut", "fadeDown", "slideRight", "zoomOut", "shrink"] as const;
export type MotionExitPreset = (typeof motionExitPresets)[number];

export const motionTweenPresets = ["move", "drift", "scale", "rotate", "fade", "arcUp", "arcDown", "numberRange"] as const;
export type MotionTweenPreset = (typeof motionTweenPresets)[number];

export type MotionNumberRange = {
  from: number;
  step: number;
  to: number;
};

export type MotionTweenState = {
  h: number;
  opacity: number;
  rotation: number;
  w: number;
  x: number;
  y: number;
};

export type MotionPath = {
  controlX: number;
  controlY: number;
};

type MotionActionBase = {
  duration: number;
  easing: MotionEasing;
  id: string;
  order: number;
  start: MotionActionStart;
};

export type MotionEnterAction = MotionActionBase & {
  preset: Exclude<MotionDocEnterAnimation, "none">;
  type: "enter";
};

export type MotionTweenAction = MotionActionBase & {
  from: MotionTweenState;
  numberRange?: MotionNumberRange;
  path?: MotionPath;
  preset?: MotionTweenPreset;
  to: MotionTweenState;
  type: "tween";
};

export type MotionExitAction = MotionActionBase & {
  preset: MotionExitPreset;
  type: "exit";
};

export type MotionAction = MotionEnterAction | MotionTweenAction | MotionExitAction;

export type MotionSequenceV1 = {
  actions: MotionAction[];
  version: 1;
};

export type MotionSequenceParseResult =
  | { sequence: MotionSequenceV1; issues: string[] }
  | { sequence: null; issues: string[] };

const actionStartSet = new Set<string>(motionActionStarts);
const easingSet = new Set<string>(motionEasings);
const exitPresetSet = new Set<string>(motionExitPresets);
const tweenPresetSet = new Set<string>(motionTweenPresets);

export function createMotionActionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `action-${globalThis.crypto.randomUUID()}`;
  }
  return `action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseMotionSequence(value: unknown): MotionSequenceParseResult {
  if (typeof value !== "string" || !value.trim()) return { sequence: null, issues: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { sequence: null, issues: ["motion must be valid JSON."] };
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.actions)) {
    return { sequence: null, issues: ["motion must use MotionSequence version 1 with an actions array."] };
  }

  const issues: string[] = [];
  const actions = parsed.actions.flatMap((candidate, index) => {
    const action = normalizeAction(candidate, index, issues);
    return action ? [action] : [];
  });

  const ids = new Set<string>();
  const orders = new Set<number>();
  actions.forEach((action, index) => {
    if (ids.has(action.id)) issues.push(`motion actions[${index}].id must be unique.`);
    ids.add(action.id);
    if (orders.has(action.order)) issues.push(`motion actions[${index}].order must be unique.`);
    orders.add(action.order);
  });
  const ordered = [...actions].sort((left, right) => left.order - right.order);
  if (ordered[0]?.order === 0 && ordered[0].start === "withPrevious") {
    issues.push("The first motion action cannot start withPrevious.");
  }

  return issues.length > 0
    ? { sequence: null, issues }
    : { sequence: { actions: ordered, version: 1 }, issues: [] };
}

export function motionSequenceFromProps(props: MotionDocPropInput) {
  return parseMotionSequence(props[MOTION_SEQUENCE_PROP]).sequence;
}

export function serializeMotionSequence(sequence: MotionSequenceV1) {
  return JSON.stringify({
    actions: [...sequence.actions]
      .sort((left, right) => left.order - right.order)
      .map(normalizeSerializableAction),
    version: 1
  });
}

export function withMotionSequence(props: MotionDocProps, sequence: MotionSequenceV1 | null) {
  const nextProps = { ...props };
  if (!sequence || sequence.actions.length === 0) delete nextProps[MOTION_SEQUENCE_PROP];
  else {
    nextProps[MOTION_SEQUENCE_PROP] = serializeMotionSequence(sequence);
    delete nextProps.enter;
    delete nextProps.delay;
    delete nextProps.duration;
  }
  return nextProps;
}

export function tweenStateFromProps(props: MotionDocPropInput): MotionTweenState {
  return {
    h: finite(props.h, 18),
    opacity: clamp(finite(props.opacity, 1), 0, 1),
    rotation: finite(props.rotation, 0),
    w: finite(props.w, 42),
    x: finite(props.x, 8),
    y: finite(props.y, 12)
  };
}

export function applyTweenState(props: MotionDocProps, state: MotionTweenState) {
  return {
    ...props,
    h: state.h,
    opacity: state.opacity,
    rotation: state.rotation,
    w: state.w,
    x: state.x,
    y: state.y
  };
}

export function interpolateMotionState(
  from: MotionTweenState,
  to: MotionTweenState,
  progress: number,
  easing: MotionEasing = "easeInOut",
  path?: MotionPath
): MotionTweenState {
  const amount = easedProgress(progress, easing);
  const w = mix(from.w, to.w, amount);
  const h = mix(from.h, to.h, amount);
  const point = path
    ? quadraticPoint(
        { x: from.x + from.w / 2, y: from.y + from.h / 2 },
        path,
        { x: to.x + to.w / 2, y: to.y + to.h / 2 },
        amount
      )
    : { x: mix(from.x, to.x, amount), y: mix(from.y, to.y, amount) };
  return {
    h,
    opacity: mix(from.opacity, to.opacity, amount),
    rotation: mix(from.rotation, to.rotation, amount),
    w,
    x: path ? point.x - w / 2 : point.x,
    y: path ? point.y - h / 2 : point.y
  };
}

export function interpolateMotionNumber(
  range: MotionNumberRange,
  progress: number,
  easing: MotionEasing = "easeInOut"
) {
  if (progress <= 0) return range.from;
  if (progress >= 1) return range.to;
  const amount = easedProgress(progress, easing);
  const raw = mix(range.from, range.to, amount);
  const direction = range.to >= range.from ? 1 : -1;
  const snapped = range.from + direction * Math.floor(Math.abs(raw - range.from) / range.step) * range.step;
  return clampToRange(roundNumber(snapped, numberRangePrecision(range)), range.from, range.to);
}

export function formatMotionNumber(value: number, range: MotionNumberRange) {
  const precision = numberRangePrecision(range);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision
  }).format(roundNumber(value, precision));
}

export type ScheduledMotionAction = MotionAction & {
  endTime: number;
  startTime: number;
  trigger: number;
};

export function scheduleMotionActions(actions: readonly MotionAction[]) {
  const ordered = [...actions].sort((left, right) => left.order - right.order);
  let trigger = -1;
  let previousStart = 0;
  let previousEnd = 0;

  return ordered.map<ScheduledMotionAction>((action, index) => {
    if (action.start === "onClick") {
      trigger += 1;
      previousStart = 0;
      previousEnd = 0;
    }
    if (index === 0 && action.start === "afterPrevious") {
      trigger = 0;
      previousStart = 0;
      previousEnd = 0;
    }
    const startTime = roundTime(action.start === "withPrevious" ? previousStart : previousEnd);
    const endTime = roundTime(startTime + action.duration);
    previousStart = startTime;
    previousEnd = Math.max(previousEnd, endTime);
    return { ...action, endTime, startTime, trigger: Math.max(0, trigger) };
  });
}

export function motionTriggerCount(actions: readonly MotionAction[]) {
  const scheduled = scheduleMotionActions(actions);
  return scheduled.length === 0 ? 0 : Math.max(...scheduled.map((action) => action.trigger)) + 1;
}

export function migrateLegacyEnterMotion(props: MotionDocProps): MotionDocProps {
  if (props[MOTION_SEQUENCE_PROP] !== undefined || !isMotionDocEnterAnimation(props.enter) || props.enter === "none") {
    return props;
  }
  const sequence: MotionSequenceV1 = {
    actions: [{
      duration: clamp(finite(props.duration, 0.6), 0.1, 30),
      easing: "easeInOut",
      id: createMotionActionId(),
      order: 0,
      preset: props.enter,
      start: "afterPrevious",
      type: "enter"
    }],
    version: 1
  };
  const nextProps = withMotionSequence(props, sequence);
  delete nextProps.enter;
  delete nextProps.delay;
  delete nextProps.duration;
  return nextProps;
}

function normalizeAction(candidate: unknown, index: number, issues: string[]): MotionAction | null {
  if (!isRecord(candidate)) {
    issues.push(`motion actions[${index}] must be an object.`);
    return null;
  }
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const order = Number(candidate.order);
  const duration = Number(candidate.duration);
  const start = candidate.start;
  const easing = candidate.easing;
  if (!id) issues.push(`motion actions[${index}].id is required.`);
  if (!Number.isInteger(order) || order < 0) issues.push(`motion actions[${index}].order must be a nonnegative integer.`);
  if (!Number.isFinite(duration) || duration < 0.1 || duration > 30) issues.push(`motion actions[${index}].duration must be between 0.1 and 30 seconds.`);
  if (typeof start !== "string" || !actionStartSet.has(start)) issues.push(`motion actions[${index}].start is invalid.`);
  if (typeof easing !== "string" || !easingSet.has(easing)) issues.push(`motion actions[${index}].easing is invalid.`);
  if (!id || !Number.isInteger(order) || order < 0 || !Number.isFinite(duration) || duration < 0.1 || duration > 30 || typeof start !== "string" || !actionStartSet.has(start) || typeof easing !== "string" || !easingSet.has(easing)) return null;

  const base = { duration, easing: easing as MotionEasing, id, order, start: start as MotionActionStart };
  if (candidate.type === "enter") {
    if (!isMotionDocEnterAnimation(candidate.preset) || candidate.preset === "none") {
      issues.push(`motion actions[${index}].preset must be a supported entrance animation.`);
      return null;
    }
    return { ...base, preset: candidate.preset, type: "enter" };
  }
  if (candidate.type === "tween") {
    const from = normalizeState(candidate.from, `motion actions[${index}].from`, issues);
    const to = normalizeState(candidate.to, `motion actions[${index}].to`, issues);
    const path = candidate.path === undefined ? undefined : normalizePath(candidate.path, `motion actions[${index}].path`, issues);
    const preset = candidate.preset;
    if (preset !== undefined && (typeof preset !== "string" || !tweenPresetSet.has(preset))) {
      issues.push(`motion actions[${index}].preset must be a supported action effect.`);
      return null;
    }
    const numberRange = candidate.numberRange === undefined
      ? undefined
      : normalizeNumberRange(candidate.numberRange, `motion actions[${index}].numberRange`, issues);
    if (preset === "numberRange" && !numberRange) {
      if (candidate.numberRange === undefined) issues.push(`motion actions[${index}].numberRange is required for numberRange.`);
      return null;
    }
    if (preset === "numberRange" && candidate.path !== undefined) {
      issues.push(`motion actions[${index}].path is not valid for numberRange.`);
      return null;
    }
    if (preset === "numberRange" && from && to && Object.keys(from).some((key) => Math.abs(from[key as keyof MotionTweenState] - to[key as keyof MotionTweenState]) > 0.000001)) {
      issues.push(`motion actions[${index}] must keep matching from and to geometry for numberRange.`);
      return null;
    }
    if (preset !== "numberRange" && candidate.numberRange !== undefined) {
      issues.push(`motion actions[${index}].numberRange is only valid for numberRange.`);
      return null;
    }
    return from && to && (candidate.path === undefined || path)
      ? { ...base, from, ...(numberRange ? { numberRange } : {}), ...(path ? { path } : {}), ...(preset ? { preset: preset as MotionTweenPreset } : {}), to, type: "tween" }
      : null;
  }
  if (candidate.type === "exit") {
    if (typeof candidate.preset !== "string" || !exitPresetSet.has(candidate.preset)) {
      issues.push(`motion actions[${index}].preset must be a supported exit animation.`);
      return null;
    }
    return { ...base, preset: candidate.preset as MotionExitPreset, type: "exit" };
  }
  issues.push(`motion actions[${index}].type must be enter, tween, or exit.`);
  return null;
}

function normalizeState(candidate: unknown, path: string, issues: string[]) {
  if (!isRecord(candidate)) {
    issues.push(`${path} is required.`);
    return null;
  }
  const state = {
    h: Number(candidate.h), opacity: Number(candidate.opacity), rotation: Number(candidate.rotation),
    w: Number(candidate.w), x: Number(candidate.x), y: Number(candidate.y)
  };
  if (Object.values(state).some((value) => !Number.isFinite(value)) || state.w <= 0 || state.h <= 0 || state.opacity < 0 || state.opacity > 1) {
    issues.push(`${path} must contain finite x, y, w, h, rotation, and opacity values.`);
    return null;
  }
  return state;
}

function normalizePath(candidate: unknown, path: string, issues: string[]) {
  if (!isRecord(candidate) || !Number.isFinite(Number(candidate.controlX)) || !Number.isFinite(Number(candidate.controlY))) {
    issues.push(`${path} must contain finite controlX and controlY values.`);
    return null;
  }
  return { controlX: Number(candidate.controlX), controlY: Number(candidate.controlY) };
}

function normalizeNumberRange(candidate: unknown, path: string, issues: string[]): MotionNumberRange | null {
  if (!isRecord(candidate)) {
    issues.push(`${path} must contain finite from, to, and step values.`);
    return null;
  }
  const range = { from: Number(candidate.from), step: Number(candidate.step), to: Number(candidate.to) };
  if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || !Number.isFinite(range.step) || range.step <= 0 || range.step > 1_000_000_000) {
    issues.push(`${path} must contain finite from and to values and a positive step.`);
    return null;
  }
  return range;
}

function normalizeSerializableAction(action: MotionAction) {
  return action.type === "enter" || action.type === "exit"
    ? { duration: action.duration, easing: action.easing, id: action.id, order: action.order, preset: action.preset, start: action.start, type: action.type }
    : { duration: action.duration, easing: action.easing, from: action.from, id: action.id, ...(action.numberRange ? { numberRange: action.numberRange } : {}), order: action.order, ...(action.path ? { path: action.path } : {}), ...(action.preset ? { preset: action.preset } : {}), start: action.start, to: action.to, type: action.type };
}

function easedProgress(value: number, easing: MotionEasing) {
  const progress = clamp(value, 0, 1);
  if (easing === "linear") return progress;
  if (easing === "easeIn") return progress * progress * progress;
  if (easing === "easeOut") return 1 - Math.pow(1 - progress, 3);
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function quadraticPoint(from: { x: number; y: number }, control: MotionPath, to: { x: number; y: number }, progress: number) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * from.x + 2 * inverse * progress * control.controlX + progress * progress * to.x,
    y: inverse * inverse * from.y + 2 * inverse * progress * control.controlY + progress * progress * to.y
  };
}

function mix(from: number, to: number, amount: number) { return from + (to - from) * amount; }
function clampToRange(value: number, from: number, to: number) { return Math.min(Math.max(value, Math.min(from, to)), Math.max(from, to)); }
function numberRangePrecision(range: MotionNumberRange) {
  return Math.min(6, Math.max(decimalPlaces(range.from), decimalPlaces(range.to), decimalPlaces(range.step)));
}
function decimalPlaces(value: number) {
  const text = String(value).toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1]) || 0;
  return text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
}
function roundNumber(value: number, precision: number) { const factor = 10 ** precision; return Math.round(value * factor) / factor; }
function roundTime(value: number) { return Math.round(value * 10000) / 10000; }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)); }
function finite(value: unknown, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
