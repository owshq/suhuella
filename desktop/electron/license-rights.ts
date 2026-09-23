import { assertSignedExecutorRights } from '@suhuella/product/lib/signed-license-contract.ts'
import { organisationPlanCapability } from '@suhuella/product/lib/generation-capabilities.ts'
import type { LicenseContext } from '@suhuella/product/types.ts'
import { loadLicenseContext } from './license-store.ts'

let testLicenseContext: LicenseContext | null = null

export function setLicenseContextForTests(context: LicenseContext | null): void {
  testLicenseContext = context
}

export function assertExecutorGenerationRights(
  context: LicenseContext = testLicenseContext ?? loadLicenseContext(),
  capability: string = organisationPlanCapability(),
):
  | { ok: true }
  | { ok: false; error: { code: 'generation_required' | 'license_expired' | 'license_revoked'; message: string } } {
  const verdict = assertSignedExecutorRights(context, capability)
  if (verdict.ok) return { ok: true }
  const code =
    verdict.error.code === 'license_expired' || verdict.error.code === 'offline_expired'
      ? 'license_expired'
      : verdict.error.code === 'license_revoked'
        ? 'license_revoked'
        : 'generation_required'
  return { ok: false, error: { code, message: verdict.error.message } }
}
