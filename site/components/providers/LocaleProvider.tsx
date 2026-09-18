"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { detectDeviceLocale } from "@/lib/i18n/detect-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Dictionary, Locale } from "@/lib/i18n/types";

const LOCALE_KEY = "suhuella-locale";
const LOCALE_USER_KEY = "suhuella-locale-user";
const LOCALE_EVENT = "suhuella-locale-change";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readLocale(): Locale {
  if (typeof window === "undefined") return "es";

  const userSet = localStorage.getItem(LOCALE_USER_KEY) === "true";
  if (userSet) {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "es" || stored === "en") return stored;
  }

  return detectDeviceLocale();
}

function subscribeLocale(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener(LOCALE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(LOCALE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function getServerSnapshot(): Locale {
  return "es";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    readLocale,
    getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(LOCALE_KEY, next);
    localStorage.setItem(LOCALE_USER_KEY, "true");
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: getDictionary(locale),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
