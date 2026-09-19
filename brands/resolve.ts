import { dbasenetBrand } from "./dbasenet/brand.ts";
import { suhuellaBrand } from "./suhuella/brand.ts";
import { BRAND_IDS, type BrandConfig, type BrandId } from "./types.ts";

const CATALOG: Record<BrandId, BrandConfig> = {
  suhuella: suhuellaBrand,
  dbasenet: dbasenetBrand,
};

export function knownBrandIds(): readonly BrandId[] {
  return BRAND_IDS;
}

export function isBrandId(value: string): value is BrandId {
  return (BRAND_IDS as readonly string[]).includes(value);
}

/**
 * Build-time Brand selection.
 * Missing BRAND defaults to suhuella (documented compatibility).
 * Unknown BRAND always fails closed — never silently falls back.
 */
function brandEnv(): string | undefined {
  const env = (globalThis as { process?: { env?: { BRAND?: string } } }).process?.env;
  return env?.BRAND;
}

export function resolveBrandId(raw: string | undefined = brandEnv()): BrandId {
  const requested = raw?.trim() ?? "";
  if (!requested) return "suhuella";
  if (isBrandId(requested)) return requested;
  throw new Error(
    `Unknown brand "${requested}". Set BRAND to one of: ${BRAND_IDS.join(", ")}.`,
  );
}

export function resolveBrand(raw?: string): BrandConfig {
  return CATALOG[resolveBrandId(raw)];
}

/** Selected Brand for this build. Import this — do not switch on hostname. */
export const brand: BrandConfig = resolveBrand();

export function siteOrigin(config: BrandConfig = brand): string {
  return `https://${config.primaryDomain}`;
}

export function siteUrl(pathname: string, config: BrandConfig = brand): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteOrigin(config)}${path}`;
}

export function supportMailto(config: BrandConfig = brand): string {
  if (!config.supportEmail) return "";
  return `mailto:${config.supportEmail}`;
}

export function salesMailto(subject: string, config: BrandConfig = brand): string {
  if (!config.salesEmail) return "";
  return `mailto:${config.salesEmail}?subject=${encodeURIComponent(subject)}`;
}

/** Reply-To for license OTP / recovery (user replies land in support). */
export function licenseOtpReplyTo(config: BrandConfig = brand): string | null {
  return config.emails?.support ?? config.supportEmail;
}

export function licenseOtpFromDisplay(config: BrandConfig = brand): string {
  const address = config.emails?.licenses ?? (config.supportEmail ? `licenses@${config.primaryDomain}` : "");
  return address ? `${config.displayName} <${address}>` : config.displayName;
}

export function desktopProtocolUrl(path: string, config: BrandConfig = brand): string {
  const suffix = path.replace(/^\/+/, "");
  return `${config.desktopProtocol}://${suffix}`;
}

export function hasForbiddenSecretFields(config: BrandConfig): string[] {
  const record = config as unknown as Record<string, unknown>;
  const hits: string[] = [];
  for (const key of Object.keys(record)) {
    if (/secret|apiKey|webhook|credential|d1Binding|privateKey/i.test(key)) {
      hits.push(key);
    }
  }
  return hits;
}
