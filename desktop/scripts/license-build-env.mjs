/**
 * Desktop license verify public keys — separate from commercial code signing.
 * Publishable builds embed SPKI public keys only (never private keys or HMAC secrets).
 */
import { assertLicenseVerifyPublicKeysEnv as assertKeyFormat } from './license-verify-public-keys.mjs'

export function licenseVerifyPublicKeys() {
  return process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? ''
}

export function isDesktopCompileOnly() {
  return process.env.SUHUELLA_DESKTOP_COMPILE_ONLY === '1'
}

function missingLicenseKeysMessage(stage) {
  console.error(
    `[${stage}] SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS must be set (comma-separated Ed25519 SPKI public keys).`,
  )
  console.error(
    `[${stage}] This is license verification, not Apple/Microsoft code signing. See desktop/README.md.`,
  )
}

/** Required for package:* and publish — never bypassed by CI flags. */
export function assertLicenseVerifyKeysForPackage(stage = 'desktop') {
  if (!licenseVerifyPublicKeys()) {
    missingLicenseKeysMessage(stage)
    process.exit(1)
  }
  assertKeyFormat({ requireDesktop: true })
}

/** `npm run build` compile smoke only — not publishable. */
export function assertLicenseVerifyKeysForBuild(stage = 'build') {
  if (licenseVerifyPublicKeys()) {
    assertKeyFormat({ requireDesktop: true })
    return
  }
  if (isDesktopCompileOnly()) {
    console.warn(
      `[${stage}] SUHUELLA_DESKTOP_COMPILE_ONLY: no SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS — compile smoke only, not publishable.`,
    )
    return
  }
  missingLicenseKeysMessage(stage)
  process.exit(1)
}
