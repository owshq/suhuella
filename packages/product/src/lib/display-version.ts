/**
 * Customer-facing version. release.json, Git tags, published asset names, and
 * update checks keep the internal release version.
 *
 * Strips only a trailing `-pre-rc` or `-rcN` suffix. Other prerelease tags stay.
 * If a release object already has `displayVersion`, that value wins. Do not add
 * `displayVersion` to release.json until the integration gate opens — until then
 * this derivation is the display version.
 *
 * `customerInstallerFilename` is a short display name (brand, display
 * version, extension, no "Setup"). The website must not save the installer
 * under that name: the browser downloads the published asset unchanged.
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

/** Short display name. Not the filename the browser saves. */
export function customerInstallerFilename(
  productName: string,
  version: string,
  extension: string,
): string {
  const name = productName.trim()
  const display = deriveDisplayVersion(version)
  const ext = extension.trim().replace(/^\./, "").toLowerCase()
  return `${name}-${display}.${ext}`
}
