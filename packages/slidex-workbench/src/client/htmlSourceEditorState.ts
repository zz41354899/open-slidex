export const MAX_HTML_SOURCE_BYTES = 50 * 1024 * 1024;
export const HTML_SOURCE_AUTOSAVE_DELAY_MS = 900;

/** Debounces disk writes so typing stays local and the shared iframe refreshes only after a pause. */
export function scheduleHtmlSourceAutosave(
  callback: () => void,
  delay = HTML_SOURCE_AUTOSAVE_DELAY_MS
) {
  const timeout = window.setTimeout(callback, delay);
  return () => window.clearTimeout(timeout);
}

export function htmlSourceEditorMetrics(source: string) {
  return {
    byteCount: new TextEncoder().encode(source).byteLength,
    lineCount: source.split("\n").length
  };
}

export function htmlSourceSaveEnabled(input: {
  byteCount: number;
  dirty: boolean;
  isSaving: boolean;
}) {
  return input.dirty
    && !input.isSaving
    && input.byteCount > 0
    && input.byteCount <= MAX_HTML_SOURCE_BYTES;
}
