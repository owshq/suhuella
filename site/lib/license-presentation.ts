import { BRAND_IDS, type BrandId } from "@suhuella/brand";

function isKnownBrandId(value: string): value is BrandId {
  return (BRAND_IDS as readonly string[]).includes(value);
}

/** Platform license authority. Not BrandConfig.operatorId ("self"). */
export const PLATFORM_OPERATOR = "platform";

/** Legacy grants without an entitlement list work on SuHuella only. */
export const LEGACY_ACCEPTED_BRANDS = ["suhuella"] as const satisfies readonly BrandId[];

export type PresentationGrant = {
  issuedByOperator?: string | null;
  acceptedBrands?: string[] | null;
  origin?: string | null;
};

/**
 * Missing fields are legacy Platform grants for SuHuella.
 * An explicit list is never widened. Unknown ids are dropped.
 * LicenseOrigin "partner" does not grant a brand.
 */
export function effectiveAcceptedBrands(grant: PresentationGrant): readonly BrandId[] {
  if (!grant.acceptedBrands || grant.acceptedBrands.length === 0) {
    return LEGACY_ACCEPTED_BRANDS;
  }
  return grant.acceptedBrands.filter(isKnownBrandId);
}

export function effectiveIssuedByOperator(grant: PresentationGrant): string {
  const operator = grant.issuedByOperator?.trim() ?? "";
  return operator || PLATFORM_OPERATOR;
}

export function grantAllowsPresentationBrand(grant: PresentationGrant, brandId: string): boolean {
  if (!isKnownBrandId(brandId)) return false;
  return effectiveAcceptedBrands(grant).includes(brandId);
}
