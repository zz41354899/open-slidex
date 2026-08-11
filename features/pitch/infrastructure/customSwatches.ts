import { isString, normalizeSwatches } from "@/features/pitch/application/colorPalettes";

const CUSTOM_SWATCHES_KEY = "slidex.customSwatches.v1";
export const CUSTOM_SWATCHES_EVENT = "slidex:custom-swatches";

export function loadCustomSwatches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_SWATCHES_KEY) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeSwatches(parsed.filter(isString));
  } catch {
    return [];
  }
}

export function saveCustomSwatches(swatches: readonly string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CUSTOM_SWATCHES_KEY, JSON.stringify(normalizeSwatches(swatches)));
  window.dispatchEvent(new Event(CUSTOM_SWATCHES_EVENT));
}

export function subscribeCustomSwatches(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(CUSTOM_SWATCHES_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(CUSTOM_SWATCHES_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
