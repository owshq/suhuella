/**
 * Phase 2B — dual-verify: Ed25519 crypto offline; HMAC legacy online-attested grace only.
 */
import { createHmac, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import { formatSignedLicenseToken, textToBase64Url } from '@suhuella/product/lib/license-token-crypto.ts'
import { SIGNED_LICENSE_CONTRACT_VERSION } from '@suhuella/product/lib/signed-license-contract.ts'
import type { LicenseContext } from '@suhuella/product/types.ts'
import { verifyLicenseSignature, verifyLicenseSignatureDetailed } from './license-signature-verify.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function paidContext(partial: Partial<LicenseContext> & Pick<LicenseContext, 'licenseToken'>): LicenseContext {
  const now = new Date()
  return {
    licenseId: 'lic_dual_verify',
    customerId: 'cust_dual_verify',
    email: 'dual-verify@test.local',
    edition: 'personal_lifetime',
    status: 'active',
    capabilities: ['apply_bulk_organisation', 'recommend_folder'],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now.toISOString(),
    offlineUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    channel: 'stable',
    signedContractVersion: SIGNED_LICENSE_CONTRACT_VERSION,
    generationEnforcementActive: false,
    ...partial,
  }
}

function signEd25519(body: string, privatePkcs8: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privatePkcs8, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  })
  const signature = sign(null, Buffer.from(body, 'utf8'), key).toString('base64url')
  return formatSignedLicenseToken('ed25519', body, signature)
}

function legacyHmacToken(context: Omit<LicenseContext, 'licenseToken'>, secret: string): string {
  const body = textToBase64Url(JSON.stringify(context))
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

function run(): void {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicSpki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')
  const privatePkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url')
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = publicSpki

  const unsigned = {
    licenseId: 'lic_dual_verify',
    customerId: 'cust_dual_verify',
    email: 'dual-verify@test.local',
    edition: 'personal_lifetime' as const,
    status: 'active' as const,
    capabilities: ['apply_bulk_organisation', 'recommend_folder'],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: new Date().toISOString(),
    offlineUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    channel: 'stable' as const,
    signedContractVersion: SIGNED_LICENSE_CONTRACT_VERSION,
    generationEnforcementActive: false,
  }
  const ed25519Body = textToBase64Url(JSON.stringify(unsigned))
  const ed25519Token = signEd25519(ed25519Body, privatePkcs8)
  const ed25519Context = paidContext({ licenseToken: ed25519Token })

  const ed25519Verdict = verifyLicenseSignatureDetailed(ed25519Context)
  assert(ed25519Verdict.ok && ed25519Verdict.mode === 'ed25519-crypto', 'Ed25519 token verifies cryptographically')

  const badEd25519 = paidContext({
    licenseToken: formatSignedLicenseToken('ed25519', ed25519Body, 'bad-signature'),
  })
  assert(!verifyLicenseSignature(badEd25519), 'Ed25519 with invalid signature is rejected')

  delete process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS
  assert(!verifyLicenseSignature(ed25519Context), 'Ed25519 without embedded public keys fails closed')
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = publicSpki

  const legacyUnsigned = { ...unsigned }
  const legacyToken = legacyHmacToken(legacyUnsigned, 'server-only-secret')
  const legacyContext = paidContext({ licenseToken: legacyToken })
  const legacyVerdict = verifyLicenseSignatureDetailed(legacyContext)
  assert(
    legacyVerdict.ok && legacyVerdict.mode === 'legacy-hmac-online-attested',
    'HMAC legacy within offlineUntil uses online-attested grace (no client secret)',
  )

  const legacyWrongSig = paidContext({
    licenseToken: `${ed25519Body}.not-the-real-hmac`,
  })
  assert(
    verifyLicenseSignature(legacyWrongSig),
    'HMAC grace does not verify signature locally — structural + offlineUntil only',
  )

  const legacyExpired = paidContext({
    licenseToken: legacyToken,
    offlineUntil: new Date(Date.now() - 60_000).toISOString(),
  })
  assert(!verifyLicenseSignature(legacyExpired), 'HMAC legacy after offlineUntil fails closed')

  assert(!verifyLicenseSignature(paidContext({ licenseToken: 'no-dot-token' })), 'token without dot fails closed')
  assert(
    !verifyLicenseSignature(paidContext({ licenseToken: 'ed25519.only-one-part' })),
    'malformed ed25519 prefix fails closed',
  )

  console.log('license-dual-verify-check passed')
}

run()
