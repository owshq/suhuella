import type { RequestBrandKind } from "./request-brand.ts";

/**
 * Public visitor copy for hostnames that do not serve the app.
 * No DNS instructions or partner-admin steps — configuration lives in the private
 * partner setup flow and Operations only.
 */
export type UnconfiguredHostnameCopy = {
  title: string;
  body: string;
  secondary?: string;
};

export function unconfiguredHostnameCopy(input: {
  kind: RequestBrandKind;
  domainStatus?: string | null;
  locale: "en" | "es";
}): UnconfiguredHostnameCopy {
  const { kind, domainStatus, locale } = input;

  if (kind === "status") {
    if (domainStatus === "pending") {
      return locale === "es"
        ? {
            title: "Sitio todavía no disponible",
            body: "Este sitio todavía no está disponible. Vuelve a intentarlo más tarde.",
          }
        : {
            title: "Site not yet available",
            body: "This site is not yet available. Please try again later.",
          };
    }
    if (domainStatus === "failed") {
      return locale === "es"
        ? {
            title: "Sitio no disponible",
            body: "Este sitio no está disponible en este momento.",
          }
        : {
            title: "Site not available",
            body: "This site is not available at the moment.",
          };
    }
    if (domainStatus === "suspended") {
      return locale === "es"
        ? {
            title: "Sitio temporalmente no disponible",
            body: "Este sitio no está disponible temporalmente.",
          }
        : {
            title: "Site temporarily unavailable",
            body: "This site is temporarily unavailable.",
          };
    }
    if (domainStatus === "revoked") {
      return locale === "es"
        ? {
            title: "Sitio no disponible",
            body: "Este sitio ya no está disponible.",
          }
        : {
            title: "Site not available",
            body: "This site is no longer available.",
          };
    }
    return locale === "es"
      ? {
          title: "Sitio no disponible",
          body: "Este sitio no está disponible en este momento.",
        }
      : {
          title: "Site not available",
          body: "This site is not available at the moment.",
        };
  }

  return locale === "es"
    ? {
        title: "Sitio no disponible",
        body: "Este sitio no está disponible.",
      }
    : {
        title: "Site not available",
        body: "This site is not available.",
      };
}

export function presentationPageTitle(input: {
  kind: RequestBrandKind;
  locale: "en" | "es";
  partnerDisplayName?: string | null;
  platformDisplayName?: string | null;
}): string {
  if (input.kind === "partner" && input.partnerDisplayName) {
    return input.partnerDisplayName;
  }
  if (input.kind === "platform" && input.platformDisplayName) {
    return input.platformDisplayName;
  }
  if (input.kind === "status") {
    return input.locale === "es" ? "Sitio no disponible" : "Site not available";
  }
  return input.locale === "es" ? "Sitio no disponible" : "Site not available";
}
