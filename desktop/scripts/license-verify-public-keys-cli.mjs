#!/usr/bin/env node
import { validateLicenseVerifyPublicKeysEnv as validateKeys } from './license-verify-public-keys.mjs'

const result = validateKeys({
  requireDesktop: process.argv.includes('--require-desktop'),
  requireWorker: process.argv.includes('--require-worker'),
})
if (!result.ok) {
  for (const error of result.errors) console.error(`[license-keys] ${error}`)
  process.exit(1)
}
console.log('[license-keys] format OK')
