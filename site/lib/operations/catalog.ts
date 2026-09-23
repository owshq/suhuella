import type { LicenseEdition, LicenseOrigin } from "@/lib/license-context";
import {
  LICENSE_EDITIONS,
  LICENSE_ORIGINS,
  ORGANISATION_PLANS,
  type OrganisationPlan,
} from "./types.ts";

export const BUSINESS_MIN_SEATS = 20;
export const REASON_MIN_LENGTH = 8;

export const EDITION_LABELS: Record<LicenseEdition, string> = {
  free: "Free",
  personal_lifetime: "Personal Lifetime",
  personal_monthly: "Personal Monthly",
  business: "Business",
  enterprise: "Enterprise",
};

export const ORIGIN_LABELS: Record<LicenseOrigin, string> = {
  stripe: "Stripe",
  gift: "Gift",
  promo: "Promo",
  manual: "Manual",
  internal: "Internal",
  test: "Test",
  partner: "Partner",
  business: "Business",
  education: "Education",
  enterprise: "Enterprise",
  migration: "Migration",
};

export const PLAN_LABELS: Record<OrganisationPlan, string> = {
  business: "Business",
  enterprise: "Enterprise",
};

export const ADMIN_CREATE_ORIGINS = [
  "gift",
  "promo",
  "manual",
  "internal",
  "test",
] as const;

export function isAdminCreateOrigin(
  value: string,
): value is (typeof ADMIN_CREATE_ORIGINS)[number] {
  return (ADMIN_CREATE_ORIGINS as readonly string[]).includes(value);
}

export const GIFT_SECTION_ORIGINS = [
  "gift",
  "promo",
  "manual",
  "internal",
  "test",
  "partner",
  "education",
] as const;

export function isLicenseEdition(value: string): value is LicenseEdition {
  return (LICENSE_EDITIONS as readonly string[]).includes(value);
}

export function isLicenseOrigin(value: string): value is LicenseOrigin {
  return (LICENSE_ORIGINS as readonly string[]).includes(value);
}

export function isOrganisationPlan(value: string): value is OrganisationPlan {
  return (ORGANISATION_PLANS as readonly string[]).includes(value);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function validateReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN_LENGTH) {
    return `Reason must be at least ${REASON_MIN_LENGTH} characters.`;
  }
  return null;
}

export function minimumSeatsForPlan(plan: OrganisationPlan): number {
  return plan === "business" ? BUSINESS_MIN_SEATS : 1;
}
