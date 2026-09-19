import { useEffectiveBrandIdentity } from './AppBrandingContext'
import { BrandMark } from './BrandMark'

type EffectiveBrandMarkProps = {
  className?: string
  alt?: string
  size?: number
}

export { resolveEffectiveBranding } from '../lib/effective-branding'

/** @deprecated Prefer useEffectiveBrandIdentity() + BrandMark — ADR-003 */
export function EffectiveBrandMark({ className = '', alt, size = 20 }: EffectiveBrandMarkProps) {
  const identity = useEffectiveBrandIdentity()
  return <BrandMark identity={identity} className={className} alt={alt} size={size} />
}
