import { brand } from '@suhuella/brand'
import { resolveEffectiveBranding } from './effective-branding.ts'

export const EFFECTIVE_BRAND_IDENTITY_VERSION = 1 as const

/** Who owns the commercial relationship — not for shell rendering. */
export type CommercialIdentity = {
  issuerOperatorId: string
  organisationId: string | null
  organisationName: string | null
  seatHolderLabel: string | null
  edition: string
}

/** Partial runtime overlay — explicit null on a field means “do not override this field”. */
export type BusinessBrandOverrides = {
  identityVersion?: typeof EFFECTIVE_BRAND_IDENTITY_VERSION
  logo?: string | null
  wordmark?: string | null
  accentColor?: string | null
  onAccentColor?: string | null
  supportEmail?: string | null
  helpUrl?: string | null
}

export type EffectiveBrandIdentity = {
  identityVersion: typeof EFFECTIVE_BRAND_IDENTITY_VERSION
  logo: string | null
  wordmark: string
  accentColor: string
  onAccentColor: string
  supportEmail: string | null
  helpUrl: string | null
  privacyUrl: string | null
  termsUrl: string | null
}

/** Product / About surface — same shape, derived view (ADR-003). */
export type ProductBrandIdentity = EffectiveBrandIdentity

/** Workspace shell — full merge including business overrides. */
export type WorkspaceBrandIdentity = EffectiveBrandIdentity

function productBrandIdentity(): ProductBrandIdentity {
  const domain = brand.primaryDomain
  return {
    identityVersion: EFFECTIVE_BRAND_IDENTITY_VERSION,
    logo: null,
    wordmark: brand.displayName,
    accentColor: brand.theme.accent,
    onAccentColor: brand.theme.onAccent,
    supportEmail: brand.supportEmail,
    helpUrl: domain ? `https://${domain}/help` : null,
    privacyUrl: domain ? `https://${domain}/privacy` : null,
    termsUrl: domain ? `https://${domain}/terms` : null,
  }
}

function pickField<T>(
  business: T | null | undefined,
  partner: T | null | undefined,
  product: T,
): T {
  if (business !== undefined && business !== null) return business
  if (partner !== undefined && partner !== null) return partner
  return product
}

/** Partner build layer — today equals product defaults from BrandConfig. */
function partnerBrandLayer(): BusinessBrandOverrides {
  return {
    identityVersion: EFFECTIVE_BRAND_IDENTITY_VERSION,
    wordmark: brand.displayName,
    accentColor: brand.theme.accent,
    onAccentColor: brand.theme.onAccent,
    supportEmail: brand.supportEmail,
    helpUrl: brand.primaryDomain ? `https://${brand.primaryDomain}/help` : null,
  }
}

/**
 * ADR-003 per-field resolver. Business may override any subset; null skips to next layer.
 */
export function resolveEffectiveBrandIdentity(
  business: BusinessBrandOverrides = {},
): EffectiveBrandIdentity {
  const product = productBrandIdentity()
  const partner = partnerBrandLayer()

  const businessLogo = resolveEffectiveBranding(business.logo ?? undefined)

  return {
    identityVersion: EFFECTIVE_BRAND_IDENTITY_VERSION,
    logo: pickField(businessLogo, null, product.logo),
    wordmark: pickField(business.wordmark, partner.wordmark, product.wordmark),
    accentColor: pickField(business.accentColor, partner.accentColor, product.accentColor),
    onAccentColor: pickField(
      business.onAccentColor,
      partner.onAccentColor,
      product.onAccentColor,
    ),
    supportEmail: pickField(business.supportEmail, partner.supportEmail, product.supportEmail),
    helpUrl: pickField(business.helpUrl, partner.helpUrl, product.helpUrl),
    privacyUrl: product.privacyUrl,
    termsUrl: product.termsUrl,
  }
}

/**
 * ProductBrandView — derived from the single base resolver with no business input.
 * Not a parallel precedence system (ADR-003).
 */
export function deriveProductBrandView(): ProductBrandIdentity {
  return resolveEffectiveBrandIdentity({})
}

/** @deprecated Prefer deriveProductBrandView — ADR-003 naming */
export function resolveProductBrandIdentity(): ProductBrandIdentity {
  return deriveProductBrandView()
}

export function hasBusinessBrandLogo(identity: EffectiveBrandIdentity): boolean {
  return Boolean(resolveEffectiveBranding(identity.logo))
}
