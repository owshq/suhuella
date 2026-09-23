import { organisationPlanCapability } from '../lib/generation-capabilities.ts'
import { assertSignedExecutorRights } from '../lib/signed-license-contract.ts'
import type { LicenseContext } from '../types.ts'

export function assertHostExecutorGenerationRights(
  context: LicenseContext | null | undefined,
  capability: string = organisationPlanCapability(),
):
  | { ok: true }
  | { ok: false; error: { code: 'generation_required' | 'license_expired' | 'invalid_request'; message: string } } {
  const verdict = assertSignedExecutorRights(context, capability)
  if (verdict.ok) return { ok: true }
  const code =
    verdict.error.code === 'license_expired' || verdict.error.code === 'offline_expired'
      ? 'license_expired'
      : verdict.error.code === 'invalid_request'
        ? 'invalid_request'
        : 'generation_required'
  return { ok: false, error: { code, message: verdict.error.message } }
}

/** @deprecated Browser executor uses signed capabilities — not a local registry. */
export function setCommercialGenerationRegistryForTests(_registry: unknown): void {
  /* no-op: registry is not executor authority in 006+ */
}
