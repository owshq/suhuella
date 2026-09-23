import { createPublicKey, verify } from 'node:crypto'
import { parseLicenseToken } from '@suhuella/product/lib/license-token-crypto.ts'
import { validateSignedLicensePayload } from '@suhuella/product/lib/signed-license-contract.ts'
import type { LicenseContext } from '@suhuella/product/types.ts'

export type LicenseSignatureVerifyMode =
  | 'free-local'
  | 'ed25519-crypto'
  | 'legacy-hmac-online-attested'

export type LicenseSignatureVerifyResult =
  | { ok: true; mode: LicenseSignatureVerifyMode }
  | { ok: false; mode: null }

function verifyPublicKeys(): string[] {
  return (process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim()
    || process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY?.trim()
    || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function verifyEd25519Token(parsed: NonNullable<ReturnType<typeof parseLicenseToken>>): boolean {
  const publicKeys = verifyPublicKeys()
  if (publicKeys.length === 0) return false
  const message = Buffer.from(parsed.body, 'utf8')
  const signature = Buffer.from(parsed.signature, 'base64url')
  for (const publicKeySpki of publicKeys) {
    try {
      const key = createPublicKey({
        key: Buffer.from(publicKeySpki, 'base64url'),
        format: 'der',
        type: 'spki',
      })
      if (verify(null, message, key, signature)) return true
    } catch {
      // try next embedded key
    }
  }
  return false
}

/**
 * Legacy HMAC tokens cannot be verified offline without embedding the symmetric secret in the
 * client (forgery-capable — rejected by design). Within offlineUntil, trust server-attested cache.
 */
function legacyHmacOnlineAttestedGrace(context: LicenseContext): boolean {
  const offlineMs = Date.parse(context.offlineUntil)
  if (!Number.isFinite(offlineMs) || offlineMs < Date.now()) return false
  return validateSignedLicensePayload(context).ok
}

export function verifyLicenseSignatureDetailed(context: LicenseContext): LicenseSignatureVerifyResult {
  if (context.edition === 'free' && context.licenseToken === 'local') {
    return { ok: true, mode: 'free-local' }
  }

  const parsed = parseLicenseToken(context.licenseToken)
  if (!parsed) return { ok: false, mode: null }

  if (parsed.algorithm === 'ed25519') {
    return verifyEd25519Token(parsed)
      ? { ok: true, mode: 'ed25519-crypto' }
      : { ok: false, mode: null }
  }

  if (parsed.algorithm === 'legacy-hmac-sha256') {
    return legacyHmacOnlineAttestedGrace(context)
      ? { ok: true, mode: 'legacy-hmac-online-attested' }
      : { ok: false, mode: null }
  }

  return { ok: false, mode: null }
}

/** Dual-verify: Ed25519 crypto offline; HMAC legacy online-attested grace only (no embedded secret). */
export function verifyLicenseSignature(context: LicenseContext): boolean {
  return verifyLicenseSignatureDetailed(context).ok
}
