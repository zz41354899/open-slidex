import type { CSSProperties } from "react";

export function colorSwatchStyle(value: string): CSSProperties {
  return value.trim()
    ? { background: value }
    : {
        background:
          "linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)",
        backgroundColor: "#18181b",
        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
        backgroundSize: "12px 12px"
      };
}
