const storageKey = "slidex:recent-fonts";
export const recentFontLimit = 8;

export function loadRecentFonts(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, recentFontLimit)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentFont(font: string) {
  if (typeof window === "undefined" || !font.trim()) return;

  const normalized = font.trim();
  const next = [normalized, ...loadRecentFonts().filter((item) => item !== normalized)].slice(0, recentFontLimit);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}
