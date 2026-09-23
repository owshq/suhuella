/**
 * Validate Ed25519 SPKI public key env format for desktop build + Worker verify allowlist.
 *
 * Both LICENSE_SIGNING_PUBLIC_KEYS (Worker) and SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS (desktop build)
 * use the same value shape: comma-separated Ed25519 SPKI DER, base64url (no PEM headers).
 */
import { createPublicKey } from 'node:crypto'

const KEY_ENV_NAMES = [
  'SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS',
  'LICENSE_SIGNING_PUBLIC_KEYS',
  'SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY',
]

export function parseLicenseVerifyPublicKeyList(raw = '') {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function validateEd25519SpkiBase64Url(key, label) {
  if (!key) return { ok: false, error: `${label}: empty key` }
  if (/-----BEGIN/.test(key)) {
    return {
      ok: false,
      error: `${label}: PEM is not supported — export SPKI DER as base64url (see LICENSE-ED25519-PRODUCTION-DEPLOY-001.md)`,
    }
  }
  if (!/^[A-Za-z0-9_-]+$/.test(key)) {
    return {
      ok: false,
      error: `${label}: must be base64url (A-Za-z0-9_-) without whitespace or PEM headers`,
    }
  }
  try {
    const keyObject = createPublicKey({
      key: Buffer.from(key, 'base64url'),
      format: 'der',
      type: 'spki',
    })
    const type = keyObject.asymmetricKeyType
    if (type !== 'ed25519') {
      return { ok: false, error: `${label}: SPKI key is ${type ?? 'unknown'}, expected ed25519` }
    }
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `${label}: invalid Ed25519 SPKI DER base64url — ${message}` }
  }
}

export function validateLicenseVerifyPublicKeysEnv(options = {}) {
  const { requireDesktop = false, requireWorker = false } = options
  const errors = []
  const desktopRaw = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? ''
  const workerRaw = process.env.LICENSE_SIGNING_PUBLIC_KEYS?.trim() ?? ''
  const legacySingle = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY?.trim() ?? ''

  if (requireDesktop && !desktopRaw && !legacySingle) {
    errors.push('SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS is required for publishable desktop builds')
  }
  if (requireWorker && !workerRaw) {
    errors.push('LICENSE_SIGNING_PUBLIC_KEYS is required for Worker-side Ed25519 verify')
  }

  for (const key of parseLicenseVerifyPublicKeyList(desktopRaw || legacySingle)) {
    const result = validateEd25519SpkiBase64Url(key, 'SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS')
    if (!result.ok) errors.push(result.error)
  }
  for (const key of parseLicenseVerifyPublicKeyList(workerRaw)) {
    const result = validateEd25519SpkiBase64Url(key, 'LICENSE_SIGNING_PUBLIC_KEYS')
    if (!result.ok) errors.push(result.error)
  }

  if (desktopRaw && workerRaw) {
    const desktopSet = new Set(parseLicenseVerifyPublicKeyList(desktopRaw))
    const workerSet = new Set(parseLicenseVerifyPublicKeyList(workerRaw))
    const overlap = [...desktopSet].filter((key) => workerSet.has(key))
    if (overlap.length === 0) {
      errors.push(
        'LICENSE_SIGNING_PUBLIC_KEYS and SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS share no SPKI entries — desktop offline verify will reject Worker-issued tokens',
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

export function assertLicenseVerifyPublicKeysEnv(options = {}) {
  const result = validateLicenseVerifyPublicKeysEnv(options)
  if (result.ok) return
  for (const error of result.errors) {
    console.error(`[license-keys] ${error}`)
  }
  process.exit(1)
}
