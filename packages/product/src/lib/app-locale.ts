import { applyBrandPresentation } from "@suhuella/brand";
import { useCallback, useSyncExternalStore } from "react";

export type AppLocale = "es" | "en";

export const APP_LOCALE_KEY = "suhuella-locale";
export const APP_LOCALE_USER_KEY = "suhuella-locale-user";
export const APP_LOCALE_EVENT = "suhuella-locale-change";

function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "es" || value === "en";
}

function detectDeviceLocale(): AppLocale {
  if (typeof navigator === "undefined") return "es";
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of languages) {
    const lower = language.toLowerCase();
    if (lower.startsWith("es")) return "es";
    if (lower.startsWith("en")) return "en";
  }
  return "es";
}

export function readAppLocale(): AppLocale {
  if (typeof window === "undefined") return "es";
  const userSet = localStorage.getItem(APP_LOCALE_USER_KEY) === "true";
  if (userSet) {
    const stored = localStorage.getItem(APP_LOCALE_KEY);
    if (isAppLocale(stored)) return stored;
  }
  return detectDeviceLocale();
}

export function writeAppLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_LOCALE_KEY, locale);
  localStorage.setItem(APP_LOCALE_USER_KEY, "true");
  document.documentElement.lang = locale;
  document.cookie = `${APP_LOCALE_KEY}=${locale};path=/;max-age=31536000;samesite=lax`;
  window.dispatchEvent(new Event(APP_LOCALE_EVENT));
}

export function subscribeAppLocale(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange();
  window.addEventListener(APP_LOCALE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(APP_LOCALE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export type AppChromeCopy = {
  search: string;
  home: string;
  organise: string;
  sources: string;
  activity: string;
  settings: string;
  settingsIntro: string;
  general: string;
  permissions: string;
  ai: string;
  license: string;
  support: string;
  privacy: string;
  notifications: string;
  diagnostics: string;
  about: string;
  computer: string;
  name: string;
  operatingSystem: string;
  language: string;
  languageHint: string;
  openSettings: string;
  freeActivate: string;
  licenseNeedsAttention: string;
  revokeTitle: string;
  revokeBody: string;
  revokeAction: string;
  revokeDone: string;
};

const chrome: Record<AppLocale, AppChromeCopy> = {
  es: {
    search: "Buscar",
    home: "Inicio",
    organise: "Modo Plan",
    sources: "Fuentes",
    activity: "Actividad",
    settings: "Ajustes",
    settingsIntro: "Cómo está configurada SuHuella.",
    general: "General",
    permissions: "Permisos",
    ai: "IA",
    license: "Licencia",
    support: "Soporte",
    privacy: "Privacidad",
    notifications: "Notificaciones",
    diagnostics: "Diagnóstico",
    about: "Acerca de",
    computer: "Ordenador",
    name: "Nombre",
    operatingSystem: "Sistema operativo",
    language: "Idioma",
    languageHint: "Aplica a SuHuella en este navegador y en el escritorio de este dispositivo.",
    openSettings: "Abrir Ajustes",
    freeActivate: "Gratis · Activar licencia",
    licenseNeedsAttention: "La licencia necesita atención",
    revokeTitle: "Revocar en este dispositivo",
    revokeBody:
      "Este dispositivo vuelve a Gratis. Tu compra no se cancela: puedes activar otro dispositivo más adelante.",
    revokeAction: "Revocar en este dispositivo",
    revokeDone: "Este dispositivo usa ahora la edición Gratis",
  },
  en: {
    search: "Search",
    home: "Home",
    organise: "Plan Mode",
    sources: "Sources",
    activity: "Activity",
    settings: "Settings",
    settingsIntro: "How SuHuella is configured.",
    general: "General",
    permissions: "Permissions",
    ai: "AI",
    license: "License",
    support: "Support",
    privacy: "Privacy",
    notifications: "Notifications",
    diagnostics: "Diagnostics",
    about: "About",
    computer: "Computer",
    name: "Name",
    operatingSystem: "Operating system",
    language: "Language",
    languageHint: "Applies to SuHuella in this browser and on the desktop app on this device.",
    openSettings: "Open Settings",
    freeActivate: "Free · Activate license",
    licenseNeedsAttention: "License needs attention",
    revokeTitle: "Revoke on this computer",
    revokeBody:
      "This computer goes back to Free. Your purchase stays yours — you can activate another device later.",
    revokeAction: "Revoke on this computer",
    revokeDone: "This computer is now using Free edition",
  },
};

export function appChromeCopy(locale: AppLocale): AppChromeCopy {
  const raw = chrome[locale];
  return {
    ...raw,
    settingsIntro: applyBrandPresentation(raw.settingsIntro),
    languageHint: applyBrandPresentation(raw.languageHint),
  };
}

export function useAppLocale(): {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: AppChromeCopy;
} {
  const locale = useSyncExternalStore(subscribeAppLocale, readAppLocale, () => "es" as AppLocale);
  const setLocale = useCallback((next: AppLocale) => {
    writeAppLocale(next);
  }, []);
  return { locale, setLocale, t: appChromeCopy(locale) };
}
