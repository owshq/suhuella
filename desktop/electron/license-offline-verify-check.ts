/**
 * Verifies Ed25519 offline path: public keys in env + verifyLicenseSignature accepts a signed token.
 * Run after production build with the same SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS used at build time.
 */
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import { formatSignedLicenseToken, textToBase64Url } from '@suhuella/product/lib/license-token-crypto.ts'
import { SIGNED_LICENSE_CONTRACT_VERSION } from '@suhuella/product/lib/signed-license-contract.ts'
import type { LicenseContext } from '@suhuella/product/types.ts'
import { verifyLicenseSignature } from './license-signature-verify.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function signEd25519Body(body: string, privateKeyPkcs8Base64: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  })
  const signature = sign(null, Buffer.from(body, 'utf8'), key).toString('base64url')
  return formatSignedLicenseToken('ed25519', body, signature)
}

function samplePaidContext(licenseToken: string): LicenseContext {
  const now = new Date().toISOString()
  const offlineUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  return {
    licenseId: 'lic_offline_verify_check',
    customerId: 'cust_offline_verify_check',
    email: 'offline-verify-check@test.local',
    edition: 'personal_lifetime',
    status: 'active',
    capabilities: ['apply_bulk_organisation', 'recommend_folder'],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil,
    channel: 'stable',
    licenseToken,
    signedContractVersion: SIGNED_LICENSE_CONTRACT_VERSION,
    generationEnforcementActive: false,
  }
}

function run(): void {
  const embeddedKeys = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? ''
  assert(embeddedKeys.length > 0, 'SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS must be set for this check')

  const testPrivate = process.env.TEST_LICENSE_SIGNING_PRIVATE_KEY?.trim() ?? ''
  let privatePkcs8: string
  if (testPrivate) {
    privatePkcs8 = testPrivate
  } else {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const generatedPublic = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')
    privatePkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url')
    process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = generatedPublic
  }

  const unsigned = {
    licenseId: 'lic_offline_verify_check',
    customerId: 'cust_offline_verify_check',
    email: 'offline-verify-check@test.local',
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
  const body = textToBase64Url(JSON.stringify(unsigned))
  const token = signEd25519Body(body, privatePkcs8)
  const context = samplePaidContext(token)

  assert(verifyLicenseSignature(context), 'verifyLicenseSignature must accept Ed25519 token with embedded public key')

  if (testPrivate) {
    console.log('license-offline-verify-check: verified with TEST_LICENSE_SIGNING_PRIVATE_KEY + embedded public key(s)')
  } else {
    console.log('license-offline-verify-check: verified with ephemeral keypair (set TEST_LICENSE_SIGNING_PRIVATE_KEY to match a release build key)')
  }

  console.log('license-offline-verify-check passed')
}

run()
