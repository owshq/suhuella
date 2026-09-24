/**
 * License key provenance — distinguish production Worker-matched keys from CI ephemeral keys.
 *
 * Ephemeral keys prove build/embed mechanics only. They cannot verify tokens from production.
 */
import { createHash } from 'node:crypto'
import { parseLicenseVerifyPublicKeyList } from './license-verify-public-keys.mjs'

export function isEphemeralLicenseKeysEnv() {
  return process.env.SUHUELLA_LICENSE_KEYS_EPHEMERAL === '1'
}

export function spkiFingerprint(spki) {
  return createHash('sha256').update(spki, 'utf8').digest('hex').slice(0, 16)
}

export function describeLicenseKeyProvenance() {
  const desktopKeys = parseLicenseVerifyPublicKeyList(
    process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? '',
  )
  const workerKeys = parseLicenseVerifyPublicKeyList(
    process.env.LICENSE_SIGNING_PUBLIC_KEYS?.trim() ?? '',
  )
  const ephemeral = isEphemeralLicenseKeysEnv()
  const fingerprints = desktopKeys.map((key) => spkiFingerprint(key))
  const workerFingerprints = workerKeys.map((key) => spkiFingerprint(key))
  const overlap = desktopKeys.filter((key) => workerKeys.includes(key))
  const workerOverlap = workerKeys.length === 0 ? null : overlap.length > 0

  let productionCompatible = !ephemeral && desktopKeys.length > 0
  if (productionCompatible && workerKeys.length > 0) {
    productionCompatible = overlap.length > 0
  }

  return {
    ephemeral,
    desktopKeyCount: desktopKeys.length,
    workerKeyCount: workerKeys.length,
    fingerprints,
    workerFingerprints,
    workerOverlap,
    productionCompatible,
  }
}

export function formatLicenseKeyProvenanceSummary(provenance = describeLicenseKeyProvenance()) {
  const lines = []
  if (provenance.ephemeral) {
    lines.push('License keys: EPHEMERAL (CI/test — not production Worker keys)')
  } else if (provenance.productionCompatible) {
    lines.push('License keys: production-compatible (desktop SPKI matches Worker allowlist or Worker unset locally)')
  } else if (provenance.desktopKeyCount === 0) {
    lines.push('License keys: MISSING')
  } else if (provenance.workerOverlap === false) {
    lines.push('License keys: MISMATCH (desktop SPKI does not overlap LICENSE_SIGNING_PUBLIC_KEYS)')
  } else {
    lines.push('License keys: present (production compatibility not confirmed)')
  }
  if (provenance.fingerprints.length) {
    lines.push(`Desktop SPKI fingerprints: ${provenance.fingerprints.join(', ')}`)
  }
  return lines.join('\n')
}

export function assertProductionLicenseKeysForPublish(stage = 'publish') {
  const provenance = describeLicenseKeyProvenance()
  const errors = []

  if (provenance.ephemeral) {
    errors.push(
      `${stage}: SUHUELLA_LICENSE_KEYS_EPHEMERAL=1 — candidate uses CI-generated test keys, not production Worker keys`,
    )
  }
  if (provenance.desktopKeyCount === 0) {
    errors.push(`${stage}: SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS is required for publishable desktop builds`)
  }
  if (provenance.workerKeyCount > 0 && provenance.workerOverlap === false) {
    errors.push(
      `${stage}: desktop SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS must overlap LICENSE_SIGNING_PUBLIC_KEYS — offline verify would reject Worker tokens`,
    )
  }

  if (errors.length === 0) return provenance

  console.error('Production license key gate FAIL\n')
  for (const error of errors) {
    console.error(`  • ${error}`)
  }
  console.error('')
  console.error(formatLicenseKeyProvenanceSummary(provenance))
  console.error('')
  console.error(
    'Deploy LICENSE_SIGNING_PRIVATE_KEY + LICENSE_SIGNING_PUBLIC_KEYS to the Worker, then rebuild desktop with the same SPKI before publish.',
  )
  console.error(
    'This gate is license verification only — pre-rc publish does not require Developer ID, notarization, or Authenticode.',
  )
  console.error('See LICENSE-ED25519-PRODUCTION-DEPLOY-001.md')
  process.exit(1)
}
