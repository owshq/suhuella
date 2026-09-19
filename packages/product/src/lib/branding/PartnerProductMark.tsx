import { brand } from '@suhuella/brand'
import { brandIconSrc, brandLogoSrc } from '../brand-logo'

type PartnerProductMarkProps = {
  className?: string
  size?: number
  'aria-label'?: string
}

/**
 * ADR-003 · INTERNAL ONLY — build-time Partner → Product mark.
 * Never import from UI components. Used only by BrandMark when identity.logo is unset.
 */
export function PartnerProductMark({
  className = '',
  size = 20,
  'aria-label': ariaLabel,
}: PartnerProductMarkProps) {
  if (brand.id === 'suhuella') {
    return (
      <img
        src={brandIconSrc()}
        alt=""
        width={size}
        height={size}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        className={`block shrink-0 rounded-[22%] object-contain ${className}`.trim()}
      />
    )
  }

  return (
    <img
      src={brandLogoSrc()}
      alt=""
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={`block shrink-0 object-contain ${className}`.trim()}
    />
  )
}
