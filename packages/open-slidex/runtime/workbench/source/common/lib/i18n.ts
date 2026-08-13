import { enDictionary } from "@/common/lib/i18n/en";
import { zhTwDictionary } from "@/common/lib/i18n/zh-TW";

export type Locale = "zh-TW" | "en";

export const locales: Locale[] = ["en", "zh-TW"];
export const defaultLocale: Locale = "zh-TW";
export const localeStorageKey = "slidex-locale";

export const dictionaries = {
  "zh-TW": zhTwDictionary,
  en: enDictionary
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "zh-TW" || value === "en";
}

export function localizeTemplates<T extends { id: string }>(
  templates: readonly T[],
  metadata: Partial<Record<string, Partial<T>>>
) {
  return templates.map((template) => ({
    ...template,
    ...(metadata[template.id] ?? {})
  }));
}
