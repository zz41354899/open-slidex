export type CanvasViewMode = "slide" | "grid";

/**
 * Both canvas modes render the same source-backed slide records. View mode is
 * deliberately workspace-only state: it must never mutate presentation.mdx.
 */
export function isCanvasViewMode(value: unknown): value is CanvasViewMode {
  return value === "slide" || value === "grid";
}

export type CanvasScrollPosition = { left: number; top: number };

export function initialCanvasScrollPositions(): Record<CanvasViewMode, CanvasScrollPosition> {
  return {
    grid: { left: 0, top: 0 },
    slide: { left: 0, top: 0 }
  };
}
