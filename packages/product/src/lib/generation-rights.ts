import { editionCapabilities } from './generation-capabilities.ts'
import type { GenerationAccessMode, LicenseEdition, LicenseOrigin, LicenseStatus } from '../types.ts'

export type CommercialGenerationRecord = {
  id: string
  label: string
  requiredCapabilities: string[]
  effectiveFrom: string | null
}

/**
 * Pre-model grants (`legacy_unassigned`) are not version-restricted until Ops publishes
 * an explicit legacy version policy. Registry order or content must never imply legacy rights.
 */
export type LegacyGenerationPolicy = 'grandfather_edition' | 'deny_gated'

export type GenerationDenialReason =
  | 'license_revoked'
  | 'license_expired'
  | 'capability_not_in_edition'
  | 'generation_required'
  | 'offline_expired'
  | 'grant_configuration_invalid'

export type GenerationRightsInput = {
  edition: LicenseEdition
  status: LicenseStatus
  validUntil: string | null
  offlineUntil?: string | null
  now?: Date
  commercialGenerationId?: string | null
  /** Cumulative license versions (initial + upgrades). Preferred over id alone when present. */
  acquiredCommercialGenerationIds?: string[]
  generationAccessMode?: GenerationAccessMode
  origin?: LicenseOrigin | string
  requestedCapability: string
  registry: CommercialGenerationRecord[]
  enforcementActive: boolean
  legacyPolicy?: LegacyGenerationPolicy
}

export type GenerationRightsVerdict =
  | {
      outcome: 'allowed'
      effectiveCapabilities: string[]
    }
  | {
      outcome: 'denied'
      reasonCode: GenerationDenialReason
      message: string
      actionable: string
      effectiveCapabilities: string[]
    }

type ParsedBoundary = 'absent' | { ms: number } | 'invalid'

/** Worker env only. Desktop must follow signed license context — never client flags. */
export function isGenerationEnforcementActive(): boolean {
  if (typeof process !== 'undefined' && process.env?.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED === 'true') {
    return true
  }
  return false
}

/** Installing or downloading a newer binary never changes license rights. */
export function appVersionAffectsGenerationRights(): false {
  return false
}

function generationGatedCapabilities(registry: CommercialGenerationRecord[]): Set<string> {
  const gated = new Set<string>()
  for (const row of registry) {
    for (const capability of row.requiredCapabilities) {
      if (capability.trim()) gated.add(capability.trim())
    }
  }
  return gated
}

function effectiveRegistryGenerations(
  registry: CommercialGenerationRecord[],
  now: Date,
): CommercialGenerationRecord[] {
  return registry.filter((row) => {
    if (!row.effectiveFrom) return false
    const effectiveFrom = Date.parse(row.effectiveFrom)
    return Number.isFinite(effectiveFrom) && effectiveFrom <= now.getTime()
  })
}

function purchasedVersionIds(input: {
  commercialGenerationId?: string | null
  acquiredCommercialGenerationIds?: string[]
}): string[] {
  const ids = new Set<string>()
  if (input.commercialGenerationId?.trim()) ids.add(input.commercialGenerationId.trim())
  for (const id of input.acquiredCommercialGenerationIds ?? []) {
    if (id?.trim()) ids.add(id.trim())
  }
  return [...ids]
}

function accessibleGenerationIds(input: {
  generationAccessMode?: GenerationAccessMode
  commercialGenerationId?: string | null
  acquiredCommercialGenerationIds?: string[]
  registry: CommercialGenerationRecord[]
  now: Date
}): string[] {
  if (input.generationAccessMode === 'purchased_generation') {
    return purchasedVersionIds(input)
  }
  if (input.generationAccessMode === 'active_subscription') {
    return effectiveRegistryGenerations(input.registry, input.now).map((row) => row.id)
  }
  return []
}

function isRecognizedLegacyGrant(
  input: Pick<GenerationRightsInput, 'generationAccessMode'>,
): boolean {
  return !input.generationAccessMode || input.generationAccessMode === 'legacy_unassigned'
}

function parseLicenseBoundary(value: string | null | undefined): ParsedBoundary {
  if (!value?.trim()) return 'absent'
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? { ms } : 'invalid'
}

export function validateGrantConfiguration(
  input: Pick<
    GenerationRightsInput,
    'edition' | 'generationAccessMode' | 'commercialGenerationId' | 'validUntil' | 'offlineUntil'
  >,
): GenerationDenialReason | null {
  if (parseLicenseBoundary(input.validUntil) === 'invalid') {
    return 'grant_configuration_invalid'
  }
  if (parseLicenseBoundary(input.offlineUntil) === 'invalid') {
    return 'grant_configuration_invalid'
  }

  const mode = input.generationAccessMode
  if (!mode || mode === 'legacy_unassigned') {
    return null
  }

  if (mode === 'version_binding_required') {
    return 'grant_configuration_invalid'
  }

  if (mode === 'purchased_generation') {
    if (input.edition !== 'personal_lifetime') {
      return 'grant_configuration_invalid'
    }
    if (!input.commercialGenerationId?.trim()) {
      return 'grant_configuration_invalid'
    }
    return null
  }

  if (mode === 'active_subscription') {
    if (
      input.edition !== 'personal_monthly' &&
      input.edition !== 'business' &&
      input.edition !== 'enterprise'
    ) {
      return 'grant_configuration_invalid'
    }
    return null
  }

  return 'grant_configuration_invalid'
}

function entitlementActive(input: Pick<GenerationRightsInput, 'status' | 'validUntil' | 'offlineUntil' | 'now' | 'edition' | 'generationAccessMode' | 'commercialGenerationId'>): {
  active: boolean
  reason?: GenerationDenialReason
} {
  const configIssue = validateGrantConfiguration(input)
  if (configIssue) return { active: false, reason: configIssue }

  if (input.status === 'revoked') return { active: false, reason: 'license_revoked' }
  if (input.status === 'expired') return { active: false, reason: 'license_expired' }
  const now = input.now ?? new Date()
  const validUntil = parseLicenseBoundary(input.validUntil)
  if (validUntil === 'invalid') {
    return { active: false, reason: 'grant_configuration_invalid' }
  }
  if (validUntil !== 'absent' && validUntil.ms < now.getTime()) {
    return { active: false, reason: 'license_expired' }
  }
  const offlineUntil = parseLicenseBoundary(input.offlineUntil)
  if (offlineUntil === 'invalid') {
    return { active: false, reason: 'grant_configuration_invalid' }
  }
  if (offlineUntil !== 'absent' && offlineUntil.ms < now.getTime()) {
    return { active: false, reason: 'offline_expired' }
  }
  return { active: true }
}

export function effectiveCapabilitiesForLicense(
  input: Omit<GenerationRightsInput, 'requestedCapability'>,
): string[] {
  const now = input.now ?? new Date()
  const editionCaps = [...editionCapabilities(input.edition)]
  const entitlement = entitlementActive(input)

  if (!entitlement.active) return input.edition === 'free' ? editionCaps : []

  if (!input.enforcementActive) {
    return editionCaps
  }

  if (input.registry.length === 0 && input.edition !== 'free') {
    return []
  }

  const recognizedLegacy = isRecognizedLegacyGrant(input)
  if (recognizedLegacy) {
    // Explicit legacy policy required before restricting pre-model grants.
    return editionCaps
  }

  const gated = generationGatedCapabilities(input.registry)
  const accessible = accessibleGenerationIds({
    generationAccessMode: input.generationAccessMode,
    commercialGenerationId: input.commercialGenerationId,
    acquiredCommercialGenerationIds: input.acquiredCommercialGenerationIds,
    registry: input.registry,
    now,
  })
  const capabilitiesFromGenerations = new Set<string>()
  for (const generationId of accessible) {
    const row = input.registry.find((item) => item.id === generationId)
    if (!row) continue
    for (const capability of row.requiredCapabilities) {
      capabilitiesFromGenerations.add(capability)
    }
  }

  return editionCaps.filter((capability) => {
    if (!gated.has(capability)) return true
    return capabilitiesFromGenerations.has(capability)
  })
}

export function evaluateGenerationRights(input: GenerationRightsInput): GenerationRightsVerdict {
  const editionCaps = [...editionCapabilities(input.edition)]
  const effectiveCapabilities = effectiveCapabilitiesForLicense(input)
  const entitlement = entitlementActive(input)

  if (!entitlement.active && input.edition !== 'free') {
    const reasonCode = entitlement.reason ?? 'license_expired'
    return {
      outcome: 'denied',
      reasonCode,
      message: denialMessage(reasonCode, input.requestedCapability),
      actionable: denialActionable(reasonCode),
      effectiveCapabilities,
    }
  }

  if (!editionCaps.includes(input.requestedCapability)) {
    return {
      outcome: 'denied',
      reasonCode: 'capability_not_in_edition',
      message: denialMessage('capability_not_in_edition', input.requestedCapability),
      actionable: denialActionable('capability_not_in_edition'),
      effectiveCapabilities,
    }
  }

  if (effectiveCapabilities.includes(input.requestedCapability)) {
    return { outcome: 'allowed', effectiveCapabilities }
  }

  return {
    outcome: 'denied',
    reasonCode: 'generation_required',
    message: denialMessage('generation_required', input.requestedCapability),
    actionable: denialActionable('generation_required'),
    effectiveCapabilities,
  }
}

export function hasEffectiveCapability(
  input: Omit<GenerationRightsInput, 'requestedCapability'>,
  capability: string,
): boolean {
  return effectiveCapabilitiesForLicense(input).includes(capability)
}

function denialMessage(reason: GenerationDenialReason, capability: string): string {
  if (reason === 'license_revoked') return 'This license is no longer active.'
  if (reason === 'license_expired') return 'This subscription is no longer active.'
  if (reason === 'offline_expired') return 'Reconnect to verify your license before using paid features.'
  if (reason === 'grant_configuration_invalid') {
    return 'This license record is incomplete or inconsistent. Reconnect or contact support.'
  }
  if (reason === 'capability_not_in_edition') {
    return `Your plan does not include ${humanCapability(capability)}.`
  }
  return `${humanCapability(capability)} requires a newer license version than your license includes.`
}

function denialActionable(reason: GenerationDenialReason): string {
  if (reason === 'grant_configuration_invalid') {
    return 'Check your license in Settings or contact support to repair the grant.'
  }
  if (reason === 'license_expired' || reason === 'license_revoked') {
    return 'Review your license in Settings or contact support.'
  }
  if (reason === 'offline_expired') return 'Connect to the internet and check your license in Settings.'
  if (reason === 'capability_not_in_edition') return 'Choose a plan that includes this feature in Settings → License.'
  return 'Your current license keeps the features you already purchased. Newer license versions are available when your operator enables them.'
}

function humanCapability(capability: string): string {
  if (capability === 'apply_bulk_organisation') return 'Plan Mode'
  if (capability === 'save_attachment') return 'Save attachments'
  if (capability === 'business_branding') return 'Business branding'
  return capability.replaceAll('_', ' ')
}

export function generationLimitationCopy(
  locale: 'en' | 'es',
  capability: string,
): { title: string; body: string; actionable: string } {
  const feature = humanCapability(capability)
  if (locale === 'es') {
    return {
      title: `${feature} no está en tu versión de licencia`,
      body: `${feature} forma parte de una versión comercial distinta. Tu licencia conserva lo que ya adquiriste; instalar o descargar otra versión no amplía esos derechos.`,
      actionable: 'Revisa tu licencia en Ajustes. Las funciones que ya tenías siguen disponibles.',
    }
  }
  return {
    title: `${feature} is not in your license version`,
    body: `${feature} belongs to a different commercial license version. Your license keeps what you already purchased; installing or downloading another version does not expand those rights.`,
    actionable: 'Review your license in Settings. Features you already have stay available.',
  }
}
