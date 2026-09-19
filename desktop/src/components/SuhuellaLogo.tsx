import { brand } from '@suhuella/brand'
import { useEffectiveBrandIdentity } from './AppBrandingContext'
import { BrandMark } from './BrandMark'

type SuhuellaLogoProps = {
  className?: string
  'aria-label'?: string
}

export function SuhuellaLogo({ className = '', 'aria-label': ariaLabel }: SuhuellaLogoProps) {
  const identity = useEffectiveBrandIdentity()
  return (
    <BrandMark
      identity={identity}
      className={className}
      size={20}
      alt={ariaLabel ?? brand.displayName}
    />
  )
}
