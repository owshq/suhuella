export function resolveEffectiveBranding(logoUrl?: string | null): string | null {
  if (!logoUrl) return null
  if (
    logoUrl.startsWith('data:image/png') ||
    logoUrl.startsWith('data:image/jpeg') ||
    logoUrl.startsWith('data:image/webp')
  ) {
    return logoUrl
  }
  return null
}
