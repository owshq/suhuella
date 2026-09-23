/** Client-safe presentation brand types and helpers (no D1 / Node imports). */

export type PresentationBrandKind = "platform" | "partner" | "status" | "unknown";

export type PresentationDomainStatus =
  | "pending"
  | "active"
  | "suspended"
  | "revoked"
  | "unknown"
  | "platform";

export type PublicPresentationBrand = {
  kind: PresentationBrandKind;
  servesApp: boolean;
  hostname: string | null;
  domainStatus: PresentationDomainStatus;
  brandId: string | null;
  displayName: string;
  logoUrl: string | null;
  accent: string | null;
  onAccent: string | null;
};

/** True when business overrides may paint logo, wordmark, and accent in the product shell. */
export function presentationBrandSupportsAppShell(
  brand: Pick<PublicPresentationBrand, "kind" | "servesApp">,
): boolean {
  return brand.servesApp && (brand.kind === "platform" || brand.kind === "partner");
}
