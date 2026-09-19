import type { BrandConfig } from "./types.ts";

/** Template tokens in current SuHuella copy. Projection is identity for brand suhuella. */
const TEMPLATE = {
  displayName: "SuHuella",
  primaryDomain: "suhuella.com",
  supportEmail: "support@suhuella.com",
  salesEmail: "sales@suhuella.com",
} as const;

export function applyBrandPresentation(text: string, config: BrandConfig): string {
  let next = text;
  if (config.supportEmail) next = next.replaceAll(TEMPLATE.supportEmail, config.supportEmail);
  if (config.salesEmail) next = next.replaceAll(TEMPLATE.salesEmail, config.salesEmail);
  return next
    .replaceAll(TEMPLATE.primaryDomain, config.primaryDomain)
    .replaceAll(TEMPLATE.displayName, config.displayName);
}

export function applyBrandPresentationDeep<T>(value: T, config: BrandConfig): T {
  if (typeof value === "string") {
    return applyBrandPresentation(value, config) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyBrandPresentationDeep(item, config)) as T;
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = applyBrandPresentationDeep(item, config);
    }
    return next as T;
  }
  return value;
}
