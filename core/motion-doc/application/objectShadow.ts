import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export type MotionDocObjectShadow = {
  blur: number;
  color: string;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export function objectShadowFromProps(props: MotionDocProps): MotionDocObjectShadow | null {
  if (props.shadow === "none" || props.shadowEnabled === "false" || props.shadowEnabled === 0) return null;
  const opacity = finite(props.shadowOpacity, 0);
  if (opacity <= 0) return null;

  return {
    blur: Math.max(finite(props.shadowBlur, 12), 0),
    color: colorValue(props.shadowColor, "#000000"),
    offsetX: finite(props.shadowOffsetX, 0),
    offsetY: finite(props.shadowOffsetY, 6),
    opacity: Math.min(opacity, 1)
  };
}

export function objectShadowCss(props: MotionDocProps): Record<string, string> {
  const shadow = objectShadowFromProps(props);
  if (!shadow) return {};
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${colorWithAlpha(shadow.color, shadow.opacity)})`
  };
}

function finite(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function colorValue(value: string | number | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function colorWithAlpha(color: string, opacity: number) {
  const hex = color.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
