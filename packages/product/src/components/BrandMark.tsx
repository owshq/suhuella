import { useState } from 'react'
import { resolveEffectiveBranding } from '../lib/effective-branding'
import type { EffectiveBrandIdentity } from '../lib/effective-brand-identity'
import { PartnerProductMark } from '../lib/branding/PartnerProductMark'

type BrandMarkProps = {
  identity: EffectiveBrandIdentity
  className?: string
  size?: number
  alt?: string
}

/**
 * Paints EffectiveBrandIdentity.logo (ADR-003). Never resolves — caller passes identity.
 */
export function BrandMark({ identity, className = '', size = 20, alt }: BrandMarkProps) {
  const resolved = resolveEffectiveBranding(identity.logo)
  const [imgFailed, setImgFailed] = useState(false)
  const label = alt ?? identity.wordmark

  if (resolved && !imgFailed) {
    return (
      <img
        src={resolved}
        alt={label}
        width={size}
        height={size}
        className={`block shrink-0 rounded object-contain ${className}`.trim()}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return <PartnerProductMark className={className} size={size} aria-label={label} />
}
