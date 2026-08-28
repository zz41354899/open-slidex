export const MORPH_CANVAS_PREVIEW_EVENT = "slidex:morph-canvas-preview";

export type MorphCanvasPreviewRequest = {
  endSlideIndex?: number;
  /** Kept for callers created before full-sequence preview shipped. */
  sourceSlideIndex?: number;
  startSlideIndex?: number;
};

export type MorphCanvasPreviewRange = {
  endSlideIndex: number;
  startSlideIndex: number;
};

/** Resolves a request to the complete contiguous Morph sequence on disk. */
export function normalizeMorphCanvasPreviewRange(
  scenes: ReadonlyArray<{ props: { slideTransition?: string | number } }>,
  request: MorphCanvasPreviewRequest | undefined
): MorphCanvasPreviewRange | null {
  const requestedStart = Number(request?.startSlideIndex ?? request?.sourceSlideIndex);
  if (!Number.isInteger(requestedStart) || requestedStart < 0 || requestedStart >= scenes.length - 1) return null;
  if (scenes[requestedStart]?.props.slideTransition !== "morph") return null;

  let sequenceEnd = requestedStart + 1;
  while (sequenceEnd < scenes.length - 1 && scenes[sequenceEnd]?.props.slideTransition === "morph") sequenceEnd += 1;

  const requestedEnd = Number(request?.endSlideIndex);
  const endSlideIndex = Number.isInteger(requestedEnd)
    ? Math.min(sequenceEnd, Math.max(requestedStart + 1, requestedEnd))
    : sequenceEnd;
  return { endSlideIndex, startSlideIndex: requestedStart };
}
