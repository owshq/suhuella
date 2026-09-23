/**
 * Partner domain onboarding copy (PARTNER-DOMAIN-ONBOARDING-COPY-003).
 * Examples only — never used as default form values or registered hostnames.
 */

/** Reserved example hostnames for UI and documentation. */
export const PARTNER_DOMAIN_EXAMPLE_HOSTNAMES = {
  enSubdomain: "documents.example.com",
  esSubdomain: "documentos.example.com",
  enAlt: "files.example.org",
  esAlt: "archivos.example.org",
} as const;

/** Hostname input placeholder (example only, not a default value). */
export const PARTNER_DOMAIN_HOSTNAME_PLACEHOLDER =
  PARTNER_DOMAIN_EXAMPLE_HOSTNAMES.enSubdomain;

export function partnerDomainExamplesBilingual(): string {
  const { enSubdomain, esSubdomain, enAlt, esAlt } = PARTNER_DOMAIN_EXAMPLE_HOSTNAMES;
  return `${enSubdomain} · ${esSubdomain} · ${enAlt} · ${esAlt}`;
}

export const PARTNER_DOMAIN_ONBOARDING_COPY = {
  hostnameInputLabel: {
    en: "Public hostname",
    es: "Hostname público",
  },
  hostnameInputHint: {
    en: "Hostname only — no https://, paths, or ports. You choose the subdomain label (app, documents, portal, etc.). Saving registers the hostname as pending; DNS validation and TLS must complete before it becomes active. Platform hostnames (suhuella.com, ops.suhuella.com, workers.dev, localhost) cannot be registered.",
    es: "Solo el hostname — sin https://, rutas ni puertos. Tú eliges el prefijo del subdominio (app, documentos, portal, etc.). Guardar registra el hostname como pendiente; la validación DNS y TLS deben completarse antes de activarse. No se pueden registrar hostnames reservados de la plataforma (suhuella.com, ops.suhuella.com, workers.dev, localhost).",
  },
  subdomainChoice: {
    en: "Choose any free subdomain on a domain you control. The prefix is not fixed — use whatever label is available at your DNS provider.",
    es: "Elige un subdominio libre de un dominio que controles. El prefijo no es fijo — usa la etiqueta que tengas libre en tu DNS.",
  },
  apexLimitation: {
    en: "The root domain (apex) is only supported when your DNS provider offers ALIAS/ANAME or a compatible mode. Prefer a subdomain when possible.",
    es: "El dominio raíz (apex) solo se admite si tu proveedor DNS ofrece ALIAS/ANAME u otro modo compatible. Prefiere un subdominio cuando sea posible.",
  },
  saveNotActive: {
    en: "Saving a hostname does not verify or activate it. Add the CNAME and TXT records shown below, then press Refresh after DNS propagates.",
    es: "Guardar un hostname no lo verifica ni lo activa. Añade los registros CNAME y TXT indicados y pulsa Refresh cuando el DNS se haya propagado.",
  },
  opsAddDomainPrompt: {
    en: "Hostname only (no https://). Partner chooses the subdomain label. Saving is pending until DNS validates.",
    es: "Solo hostname (sin https://). El partner elige el prefijo del subdominio. Queda pendiente hasta validar DNS.",
  },
  opsPrimaryDomainPlaceholder: {
    en: "leave blank · partner chooses hostname",
    es: "en blanco · el partner elige hostname",
  },
  pendingStatusBody: {
    en: "This hostname is registered but not active yet. Add the CNAME and TXT records from partner setup or Operations, then Refresh. Keep your nameservers — SuHuella does not move them.",
    es: "Este hostname está registrado pero aún no activo. Añade los registros CNAME y TXT del onboarding u Operations y pulsa Refresh. Mantén tus nameservers — SuHuella no los mueve.",
  },
  apiNextActionPending: {
    en: "Hostname saved as pending. Add the CNAME and TXT records at your DNS provider, then press Refresh. Activation is not immediate.",
    es: "Hostname guardado como pendiente. Añade CNAME y TXT en tu DNS y pulsa Refresh. La activación no es inmediata.",
  },
  apiNextActionActive: {
    en: "Your hostname is active. Open it in the browser — the URL stays on your domain.",
    es: "Tu hostname está activo. Ábrelo en el navegador — la URL permanece en tu dominio.",
  },
} as const;
