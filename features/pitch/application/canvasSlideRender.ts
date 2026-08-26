import type { SlideRow } from "@/features/pitch/application/slideRows";

/**
 * The horizontal Workbench canvas keeps every slide mounted. It avoids a
 * misleading "missing slides" state while an adjacent-only window updates
 * during edits, selection changes, or external document reloads.
 *
 * A future vertical canvas may introduce its own viewport virtualization, but
 * only after it has stable placeholders and source-backed recovery semantics.
 */
export function canvasSlideRowsForRender(slideRows: readonly SlideRow[]) {
  return slideRows;
}

/** HTML source mode owns one persistent iframe, so its slide stage needs only the active frame shell. */
export function singleCanvasSlideRowForRender(slideRows: readonly SlideRow[], activeSlideIndex: number) {
  const active = slideRows.find((slide) => slide.index === activeSlideIndex);
  return active ? [active] : [];
}
