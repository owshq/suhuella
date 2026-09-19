import type { BrandConfig } from "./types.ts";

export function siteOriginOf(config: BrandConfig): string {
  return `https://${config.primaryDomain}`;
}

export function siteUrlOf(pathname: string, config: BrandConfig): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteOriginOf(config)}${path}`;
}

export function supportMailtoOf(config: BrandConfig): string {
  if (!config.supportEmail) return "";
  return `mailto:${config.supportEmail}`;
}

export function salesMailtoOf(subject: string, config: BrandConfig): string {
  if (!config.salesEmail) return "";
  return `mailto:${config.salesEmail}?subject=${encodeURIComponent(subject)}`;
}

export function desktopProtocolUrlOf(path: string, config: BrandConfig): string {
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
