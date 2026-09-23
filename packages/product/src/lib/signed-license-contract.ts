import { editionCapabilities } from './generation-capabilities.ts'
import type { CommercialGenerationRecord } from './generation-rights.ts'
import type { GenerationAccessMode, LicenseEdition, LicenseStatus } from '../types.ts'

/** Bump only with an ADR. Old clients ignore unknown contract versions. */
export const SIGNED_LICENSE_CONTRACT_VERSION = 1

export type SignedLicensePayload = {
  licenseId: string
  customerId: string
  email: string
  edition: LicenseEdition
  status: LicenseStatus
  capabilities: string[]
  enabledKnowledgeSources: string[]
  deviceLimit: number
  activatedDevices: number
  validUntil: string | null
  lastCheckedAt: string
  offlineUntil: string
  channel: 'stable' | 'beta'
  commercialGenerationId?: string | null
  acquiredCommercialGenerationIds?: string[]
  generationAccessMode?: GenerationAccessMode
  /** Present on v1+ tokens. Absent on legacy tokens → treated as false. */
  generationEnforcementActive?: boolean
  /** Registry revision at sign time. Audit only — executor uses signed capabilities. */
  policyRevision?: string | null
  signedContractVersion?: number
}

export type SignedLicenseValidationReason =
  | 'unsupported_contract'
  | 'corrupt_dates'
  | 'capabilities_exceed_edition'
  | 'incoherent_generations'

export type SignedLicenseValidation =
  | { ok: true; legacyToken: boolean }
  | { ok: false; reason: SignedLicenseValidationReason }

export type SignedExecutorDenialCode =
  | 'license_revoked'
  | 'license_expired'
  | 'offline_expired'
  | 'grant_configuration_invalid'
  | 'capability_not_in_edition'
  | 'capability_not_granted'
  | 'invalid_request'

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`
}

function parseBoundary(value: string | null | undefined): 'absent' | { ms: number } | 'invalid' {
  if (!value?.trim()) return 'absent'
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? { ms } : 'invalid'
}

function isPaidEdition(edition: LicenseEdition): boolean {
  return edition !== 'free'
}

/** Stable hash of the commercial generation registry at sign time. Not executor authority. */
export function commercialGenerationPolicyRevision(
  registry: CommercialGenerationRecord[],
): string | null {
  if (registry.length === 0) return null
  const rows = [...registry]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((row) => ({
      id: row.id,
      effectiveFrom: row.effectiveFrom,
      requiredCapabilities: [...row.requiredCapabilities].sort(),
    }))
  let hash = 2166136261
  const text = canonicalize(rows)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `gen_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function generationEnforcementActiveFromSignedPayload(
  payload: Pick<SignedLicensePayload, 'generationEnforcementActive'>,
): boolean {
  return payload.generationEnforcementActive === true
}

export function validateSignedLicensePayload(payload: SignedLicensePayload): SignedLicenseValidation {
  const contractVersion = payload.signedContractVersion
  if (
    contractVersion !== undefined &&
    contractVersion !== SIGNED_LICENSE_CONTRACT_VERSION
  ) {
    return { ok: false, reason: 'unsupported_contract' }
  }

  const legacyToken = contractVersion === undefined && payload.generationEnforcementActive === undefined

  for (const field of [payload.lastCheckedAt, payload.offlineUntil] as const) {
    if (parseBoundary(field) === 'invalid') {
      return { ok: false, reason: 'corrupt_dates' }
    }
  }
  if (payload.validUntil !== null && parseBoundary(payload.validUntil) === 'invalid') {
    return { ok: false, reason: 'corrupt_dates' }
  }

  const editionCaps = new Set(editionCapabilities(payload.edition))
  for (const capability of payload.capabilities) {
    if (!editionCaps.has(capability)) {
      return { ok: false, reason: 'capabilities_exceed_edition' }
    }
  }

  if (
    payload.generationEnforcementActive === true &&
    isPaidEdition(payload.edition) &&
    !payload.generationAccessMode
  ) {
    return { ok: false, reason: 'incoherent_generations' }
  }

  const acquired = new Set(
    (payload.acquiredCommercialGenerationIds ?? []).map((id) => id.trim()).filter(Boolean),
  )
  const original = payload.commercialGenerationId?.trim()
  if (original && acquired.size > 0 && !acquired.has(original)) {
    return { ok: false, reason: 'incoherent_generations' }
  }

  return { ok: true, legacyToken }
}

function entitlementActive(
  payload: Pick<
    SignedLicensePayload,
    'edition' | 'status' | 'validUntil' | 'offlineUntil' | 'generationAccessMode'
  >,
  now: Date,
): { active: boolean; code?: SignedExecutorDenialCode } {
  if (payload.edition !== 'free') {
    if (payload.status === 'revoked') return { active: false, code: 'license_revoked' }
    if (payload.status === 'expired') return { active: false, code: 'license_expired' }
    if (payload.generationAccessMode === 'version_binding_required') {
      return { active: false, code: 'grant_configuration_invalid' }
    }
  }

  const validUntil = parseBoundary(payload.validUntil)
  if (validUntil === 'invalid') return { active: false, code: 'grant_configuration_invalid' }
  if (validUntil !== 'absent' && validUntil.ms < now.getTime()) {
    return { active: false, code: 'license_expired' }
  }

  const offlineUntil = parseBoundary(payload.offlineUntil)
  if (offlineUntil === 'invalid') return { active: false, code: 'grant_configuration_invalid' }
  if (offlineUntil !== 'absent' && offlineUntil.ms < now.getTime()) {
    return { active: false, code: 'offline_expired' }
  }

  return { active: true }
}

function denialMessage(code: SignedExecutorDenialCode, capability: string): string {
  if (code === 'license_revoked') return 'This license is no longer active.'
  if (code === 'license_expired') return 'This subscription is no longer active.'
  if (code === 'offline_expired') {
    return 'Reconnect to verify your license before using paid features.'
  }
  if (code === 'grant_configuration_invalid') {
    return 'This license record is incomplete or inconsistent. Reconnect or contact support.'
  }
  if (code === 'capability_not_in_edition') {
    return `Your plan does not include ${capability}.`
  }
  if (code === 'capability_not_granted') {
    return `${capability} is not included in your current license.`
  }
  return 'A valid license is required.'
}

/**
 * Host executor gate — trusts server-signed capabilities, not Worker env or local registry.
 */
export function assertSignedExecutorRights(
  payload: SignedLicensePayload | null | undefined,
  capability: string,
  now: Date = new Date(),
):
  | { ok: true }
  | { ok: false; error: { code: SignedExecutorDenialCode; message: string } } {
  if (!payload || !capability.trim()) {
    return {
      ok: false,
      error: { code: 'invalid_request', message: 'A valid license is required.' },
    }
  }

  if (payload.edition === 'free') {
    return {
      ok: false,
      error: {
        code: 'capability_not_granted',
        message: 'Plan Mode requires a Personal or Business license.',
      },
    }
  }

  const validation = validateSignedLicensePayload(payload)
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: 'grant_configuration_invalid',
        message: denialMessage('grant_configuration_invalid', capability),
      },
    }
  }

  const entitlement = entitlementActive(payload, now)
  if (!entitlement.active) {
    const code = entitlement.code ?? 'grant_configuration_invalid'
    return { ok: false, error: { code, message: denialMessage(code, capability) } }
  }

  const editionCaps = editionCapabilities(payload.edition)
  if (!editionCaps.includes(capability)) {
    return {
      ok: false,
      error: {
        code: 'capability_not_in_edition',
        message: denialMessage('capability_not_in_edition', capability),
      },
    }
  }

  if (!payload.capabilities.includes(capability)) {
    return {
      ok: false,
      error: {
        code: 'capability_not_granted',
        message: denialMessage('capability_not_granted', capability),
      },
    }
  }

  return { ok: true }
}
