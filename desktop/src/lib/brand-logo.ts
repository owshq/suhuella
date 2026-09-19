import { brand } from '@suhuella/brand'

function publicAssetSrc(relativePath: string): string {
  const path = relativePath.replace(/^\//, '')
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  return `${base}${path}`
}

/** Glyph-only logo SVG — wordmarks and legal, not app icon surfaces. */
export function brandLogoSrc(): string {
  return publicAssetSrc(brand.logo.publicSvg)
}

/** App icon (blue tile + mark) — sidebar, About, install surfaces. */
export function brandIconSrc(): string {
  return publicAssetSrc(brand.icon.public256)
}
