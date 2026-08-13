import type { HsvColor } from "@/features/pitch/application/colorPalettes";

export function colorPlanePosition({ s, v }: Pick<HsvColor, "s" | "v">) {
  return {
    x: clampUnit(s),
    y: 1 - clampUnit(v)
  };
}

export function colorPlaneValueAtPoint({
  height,
  width,
  x,
  y
}: {
  height: number;
  width: number;
  x: number;
  y: number;
}) {
  return {
    s: clampUnit(width > 0 ? x / width : 0),
    v: 1 - clampUnit(height > 0 ? y / height : 0)
  };
}

function clampUnit(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
