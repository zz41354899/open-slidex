import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { normalizeEnterAnimation, type EnterAnimation } from "@/features/pitch/application/motionPresets";

export type { EnterAnimation };
export type SlideLayout = "default" | "split-left" | "split-right";
export type AlignX = "left" | "center" | "right" | "stretch";
export type AlignY = "top" | "center" | "bottom";
export type TextAlign = "left" | "center" | "right";

export function numberProp(value: string | number | undefined) {
  return typeof value === "number" ? value : undefined;
}

export function stringProp(value: string | number | undefined) {
  return typeof value === "string" ? value : undefined;
}

export function spacingProp(value: string | number | undefined) {
  return value;
}

export function opacityProp(value: string | number | undefined, fallback?: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 0), 1);
}

export function enterProp(value: string | number | undefined): EnterAnimation | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeEnterAnimation(value);
}

export function layoutProp(value: string | number | undefined): SlideLayout {
  if (value === "split-left" || value === "split-right") {
    return value;
  }

  return "default";
}

export function fitProp(value: string | number | undefined) {
  if (value === "cover" || value === "contain" || value === "fill" || value === "scale-down") {
    return value;
  }

  return "cover";
}

export function booleanProp(value: string | number | undefined) {
  return value === "true" || value === 1;
}

export function alignXProp(value: string | number | undefined): AlignX {
  if (value === "center" || value === "right" || value === "stretch") {
    return value;
  }

  return "left";
}

export function alignYProp(value: string | number | undefined): AlignY {
  if (value === "top" || value === "bottom") {
    return value;
  }

  return "center";
}

export function textAlignProp(value: string | number | undefined): TextAlign {
  if (value === "center" || value === "right") {
    return value;
  }

  return "left";
}

export function optionalTextAlignProp(value: string | number | undefined): TextAlign | undefined {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }

  return undefined;
}

export function cardLayoutProp(value: string | number | undefined) {
  return value === "horizontal" ? "horizontal" : "vertical";
}

export function cardWidthProp(value: string | number | undefined) {
  return blockWidthProp(value, "md");
}

export function blockWidthProp(value: string | number | undefined, fallback: "sm" | "md" | "lg" | "full") {
  if (value === "sm" || value === "md" || value === "lg" || value === "full") {
    return value;
  }

  return fallback;
}

export function sizeNumberProp(value: string | number | undefined, fallback: number): number;
export function sizeNumberProp(value: string | number | undefined, fallback: undefined): number | undefined;
export function sizeNumberProp(value: string | number | undefined, fallback: number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isPositionedBlock(block: MotionDocBlock) {
  return "props" in block && (Number.isFinite(Number(block.props.x)) || Number.isFinite(Number(block.props.y)));
}

export function percentProp(value: string | number | undefined, fallback?: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 0), 100);
}
