/** Allowed asymmetric algorithms for license tokens. Clients must reject unknown prefixes. */
export const ALLOWED_LICENSE_TOKEN_SIGNATURE_ALGORITHMS = ['ed25519'] as const

export type LicenseTokenSignatureAlgorithm =
  (typeof ALLOWED_LICENSE_TOKEN_SIGNATURE_ALGORITHMS)[number]

export const LICENSE_TOKEN_ALGORITHM_PREFIX: Record<LicenseTokenSignatureAlgorithm, string> = {
  ed25519: 'ed25519',
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(`${padded}${pad}`)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export type ParsedLicenseToken =
  | {
      algorithm: LicenseTokenSignatureAlgorithm
      body: string
      signature: string
    }
  | {
      algorithm: 'legacy-hmac-sha256'
      body: string
      signature: string
    }

/** Known signature algorithm for a token string, or null when format is invalid. */
export function licenseTokenSignatureAlgorithm(
  licenseToken: string,
): ParsedLicenseToken['algorithm'] | null {
  const parsed = parseLicenseToken(licenseToken)
  return parsed?.algorithm ?? null
}

export function parseLicenseToken(licenseToken: string): ParsedLicenseToken | null {
  const trimmed = licenseToken.trim()
  if (!trimmed.includes('.')) return null

  for (const algorithm of ALLOWED_LICENSE_TOKEN_SIGNATURE_ALGORITHMS) {
    const prefix = `${LICENSE_TOKEN_ALGORITHM_PREFIX[algorithm]}.`
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length)
      const separator = rest.lastIndexOf('.')
      if (separator <= 0) return null
      const body = rest.slice(0, separator)
      const signature = rest.slice(separator + 1)
      if (!body || !signature) return null
      return { algorithm, body, signature }
    }
  }

  const separator = trimmed.lastIndexOf('.')
  if (separator <= 0) return null
  const body = trimmed.slice(0, separator)
  const signature = trimmed.slice(separator + 1)
  if (!body || !signature) return null
  return { algorithm: 'legacy-hmac-sha256', body, signature }
}

export function formatSignedLicenseToken(
  algorithm: LicenseTokenSignatureAlgorithm,
  body: string,
  signature: string,
): string {
  return `${LICENSE_TOKEN_ALGORITHM_PREFIX[algorithm]}.${body}.${signature}`
}

export async function verifyEd25519LicenseTokenSignature(input: {
  body: string
  signature: string
  publicKeySpkiBase64: string
}): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      asBufferSource(base64UrlToBytes(input.publicKeySpkiBase64)),
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      'Ed25519',
      key,
      asBufferSource(base64UrlToBytes(input.signature)),
      new TextEncoder().encode(input.body),
    )
  } catch {
    return false
  }
}

export async function verifyLicenseTokenWithPublicKeys(input: {
  licenseToken: string
  publicKeysSpkiBase64: string[]
}): Promise<{ ok: true; body: string } | { ok: false }> {
  const parsed = parseLicenseToken(input.licenseToken)
  if (!parsed || parsed.algorithm !== 'ed25519') return { ok: false }
  for (const publicKeySpkiBase64 of input.publicKeysSpkiBase64) {
    const verified = await verifyEd25519LicenseTokenSignature({
      body: parsed.body,
      signature: parsed.signature,
      publicKeySpkiBase64,
    })
    if (verified) return { ok: true, body: parsed.body }
  }
  return { ok: false }
}

export function base64UrlToText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

export function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value))
}
