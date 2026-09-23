/**
 * Browser limitations that may need a branded explanation.
 *
 * Three independent controls — never conflate them in copy:
 *   Platform: can Browser or Desktop execute this action?
 *   Permissions: has the user authorized that folder?
 *   License: does their plan include this capability?
 *
 * Desktop download is offered to anyone when the platform can do more.
 * Copy must not promise that installing unlocks paid features.
 * After install, Free stays Free; Personal or a beta grant adds only its rights.
 */
import { productName } from "./product-copy.ts";
import {
  COPY_MISMATCH_REASON,
  COPY_UNVERIFIED_REASON,
  CROSS_SOURCE_REASON,
  PARTIAL_DELETE_REASON,
  PERMISSION_REASON,
  UNCERTAIN_NOTE,
} from "../host/browser/organise-integrity.ts";
export type BrowserLimitation =
  | "protected_folder"
  | "no_write_support"
  | "no_write_handle"
  | "cross_source"
  | "permission_denied"
  | "picker_cancelled"
  | "unimplemented"
  | "partial_or_uncertain"
  | "plan_conflict"
  | "browser_unsupported";

export type BrowserCapabilityDialogCopy = {
  id: BrowserLimitation;
  title: string;
  body: string;
  primary: string | null;
  secondary: string;
  offerDesktop: boolean;
};

export type BrowserLimitationPresentation =
  | { kind: "silent" }
  | { kind: "inline"; message: string }
  | { kind: "desktop_dialog"; notice: BrowserCapabilityDialogCopy };

function brandName(): string {
  return productName();
}

export function browserCapabilityDialogCopy(
  limitation:
    | "protected_folder"
    | "no_write_support"
    | "no_write_handle"
    | "cross_source"
    | "permission_denied"
    | "browser_unsupported",
  locale: "es" | "en",
  name = brandName(),
): BrowserCapabilityDialogCopy {
  if (limitation === "permission_denied") {
    return locale === "es"
      ? {
          id: limitation,
          title: "Permiso necesario para ver esta carpeta",
          body: "El navegador no concedió acceso. Elige la carpeta otra vez y acepta el permiso cuando te lo pida. También puedes usar la aplicación de escritorio para ver y organizar archivos locales, con los permisos de tu sistema.",
          primary: "Elegir carpeta otra vez",
          secondary: "Ahora no",
          offerDesktop: true,
        }
      : {
          id: limitation,
          title: "Permission needed to see this folder",
          body: "The browser did not grant access. Choose the folder again and allow permission when asked. You can also use the desktop app to see and organise local files, with your system permissions.",
          primary: "Choose folder again",
          secondary: "Not now",
          offerDesktop: true,
        };
  }

  if (limitation === "browser_unsupported") {
    return locale === "es"
      ? {
          id: limitation,
          title: "Esta carpeta no está disponible en este navegador",
          body: "Este navegador no puede abrir carpetas locales. Usa Chrome o Edge, o descarga la aplicación de escritorio para ver y organizar archivos en tu dispositivo.",
          primary: null,
          secondary: "Ahora no",
          offerDesktop: true,
        }
      : {
          id: limitation,
          title: "This folder is not available in this browser",
          body: "This browser cannot open local folders. Use Chrome or Edge, or download the desktop app to see and organise files on your device.",
          primary: null,
          secondary: "Not now",
          offerDesktop: true,
        };
  }

  if (limitation === "protected_folder") {
    return locale === "es"
      ? {
          id: limitation,
          title: `Accede a esta carpeta desde ${name} Desktop`,
          body: "El navegador limita el acceso a esta carpeta. Puedes elegir una subcarpeta o usar la aplicación de escritorio, con los permisos de tu sistema.",
          primary: "Elegir subcarpeta",
          secondary: "Ahora no",
          offerDesktop: true,
        }
      : {
          id: limitation,
          title: `Open this folder from ${name} Desktop`,
          body: "The browser limits access to this folder. You can choose a subfolder or use the desktop app, with your system permissions.",
          primary: "Choose subfolder",
          secondary: "Not now",
          offerDesktop: true,
        };
  }

  if (limitation === "no_write_support" || limitation === "no_write_handle") {
    return locale === "es"
      ? {
          id: limitation,
          title: `Aplica este plan desde ${name} Desktop`,
          body: "Este navegador puede preparar el plan. No puede renombrar ni mover estos archivos. La aplicación de escritorio sí puede hacerlo, con los permisos de tu sistema. Tampoco cambia archivos en la nube.",
          primary: "Seguir preparando el plan",
          secondary: "Ahora no",
          offerDesktop: true,
        }
      : {
          id: limitation,
          title: `Apply this plan from ${name} Desktop`,
          body: "This browser can prepare the plan. It cannot rename or move these files. The desktop app can, with your system permissions. It does not change cloud files either.",
          primary: "Keep preparing the plan",
          secondary: "Not now",
          offerDesktop: true,
        };
  }

  return locale === "es"
    ? {
        id: "cross_source",
        title: `Mover entre fuentes desde ${name} Desktop`,
        body: "Este navegador solo mueve un archivo dentro de la misma fuente. La aplicación de escritorio puede mover entre carpetas que ya tiene indexadas, en el mismo disco, y solo después de confirmar. No cambia archivos en la nube.",
        primary: "Seguir preparando el plan",
        secondary: "Ahora no",
        offerDesktop: true,
      }
    : {
        id: "cross_source",
        title: `Move between sources from ${name} Desktop`,
        body: "This browser only moves a file inside the same source. The desktop app can move between folders it has already indexed, on the same disk, and only after you confirm. It does not change cloud files.",
        primary: "Keep preparing the plan",
        secondary: "Not now",
        offerDesktop: true,
      };
}

export function permissionDeniedCopy(locale: "es" | "en"): string {
  return locale === "es"
    ? "No se concedió el permiso. Elige la carpeta otra vez y acepta el acceso cuando el navegador lo pida."
    : "Permission was not granted. Choose the folder again and allow access when the browser asks.";
}

export function unimplementedCopy(locale: "es" | "en"): string {
  return locale === "es" ? "Esta función todavía no está disponible." : "This function is not available yet.";
}

export function presentOrganiseLimitation(input: {
  host?: "browser" | "electron" | string | null;
  locale?: "es" | "en";
  canWrite?: boolean;
  skipReasons?: Array<string | null | undefined>;
  errorMessage?: string | null;
}): BrowserLimitationPresentation {
  if (input.host !== "browser") return { kind: "silent" };
  const locale = input.locale ?? "en";
  const reasons = input.skipReasons ?? [];
  if (reasons.some((reason) => reason === UNCERTAIN_NOTE || reason === PARTIAL_DELETE_REASON || reason === COPY_UNVERIFIED_REASON || reason === COPY_MISMATCH_REASON)) {
    return { kind: "silent" };
  }
  if (reasons.some((reason) => reason === PERMISSION_REASON) || input.errorMessage === PERMISSION_REASON) {
    return {
      kind: "desktop_dialog",
      notice: {
        ...browserCapabilityDialogCopy("permission_denied", locale),
        primary: locale === "es" ? "Seguir preparando el plan" : "Keep preparing the plan",
        body:
          locale === "es"
            ? "Esta carpeta necesita permiso de escritura antes de cambiar archivos. Vuelve a confirmar el plan y acepta el acceso cuando el navegador lo pida. También puedes usar la aplicación de escritorio para aplicar cambios en disco, con los permisos de tu sistema. No cambia archivos en la nube."
            : "This folder needs write permission before files can change. Confirm the plan again and allow access when the browser asks. You can also use the desktop app to apply changes on disk, with your system permissions. It does not change cloud files.",
      },
    };
  }
  if (reasons.some((reason) => reason === CROSS_SOURCE_REASON)) {
    return { kind: "desktop_dialog", notice: browserCapabilityDialogCopy("cross_source", locale) };
  }
  if (input.canWrite === false) {
    return { kind: "desktop_dialog", notice: browserCapabilityDialogCopy("no_write_support", locale) };
  }
  return { kind: "silent" };
}

export function presentUnimplemented(locale: "es" | "en"): BrowserLimitationPresentation {
  return { kind: "inline", message: unimplementedCopy(locale) };
}
