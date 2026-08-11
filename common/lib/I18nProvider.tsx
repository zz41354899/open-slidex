"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  defaultLocale,
  dictionaries,
  isLocale,
  localeStorageKey,
  type Dictionary,
  type Locale
} from "@/common/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  localePath: (path: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const storedLocale = readStoredLocale();
    if (storedLocale) setLocaleState(storedLocale);
  }, []);

  // Persist to localStorage and update html lang
  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    persistLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const localePath = useCallback((path: string) => path, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
      localePath,
    }),
    [locale, setLocale, localePath]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function readStoredLocale(): Locale | null {
  try {
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    return isLocale(storedLocale) ? storedLocale : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale) {
  document.documentElement.lang = locale;

  try {
    window.localStorage.setItem(localeStorageKey, locale);
    document.cookie = `${localeStorageKey}=${locale};path=/;max-age=31536000;samesite=lax`;
  } catch {
    // Ignore storage failures and keep the in-memory locale active.
  }
}

export function useI18n() {
  const context = useOptionalI18n();

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}

export function useOptionalI18n() {
  return useContext(I18nContext);
}
