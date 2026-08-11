import { isSlideXIconName, type SlideXIconName } from "@/core/motion-doc/domain/lucideIconRegistry";

const storageKey = "slidex:recent-icons";
const recentIconLimit = 12;

export function loadRecentIcons(): SlideXIconName[] {
  if (typeof window === "undefined") return [];

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is SlideXIconName => typeof item === "string" && isSlideXIconName(item)).slice(0, recentIconLimit) : [];
  } catch {
    return [];
  }
}

export function rememberRecentIcon(name: SlideXIconName) {
  if (typeof window === "undefined") return;

  const next = [name, ...loadRecentIcons().filter((item) => item !== name)].slice(0, recentIconLimit);
  window.localStorage.setItem(storageKey, JSON.stringify(next));
}
