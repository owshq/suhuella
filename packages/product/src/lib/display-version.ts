/**
 * Customer-facing version. release.json, Git tags, filenames, and update checks
 * keep the internal release version.
 *
 * Strips only a trailing `-pre-rc` or `-rcN` suffix. Other prerelease tags stay.
 * If a release object already has `displayVersion`, that value wins. Do not add
 * `displayVersion` to release.json until the integration gate opens — until then
 * this derivation is the display version.
 */
const CUSTOMER_HIDDEN_SUFFIX = /(?:-pre-rc|-rc\d+)$/

export function deriveDisplayVersion(version: string): string {
  return version.trim().replace(CUSTOMER_HIDDEN_SUFFIX, "")
}

export function displayVersionFromRelease(
  release: {
    version?: string | null
    displayVersion?: string | null
  } | null | undefined,
): string {
  const explicit = release?.displayVersion?.trim() ?? ""
  if (explicit) return explicit
  return deriveDisplayVersion(release?.version ?? "")
}
