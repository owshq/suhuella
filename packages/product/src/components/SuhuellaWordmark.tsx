import { brand } from '@suhuella/brand'
import { useEffectiveBrandIdentity } from './AppBrandingContext'
import { BrandMark } from './BrandMark'
import { BrandWordmark } from './BrandWordmark'

type SuhuellaWordmarkProps = {
  className?: string
  glyphClassName?: string
  glyphSize?: number
  textClassName?: string
  variant?: 'horizontal' | 'compact'
  tagline?: string
  taglineClassName?: string
}

export function SuhuellaWordmark({
  className = '',
  glyphClassName = '',
  glyphSize = 24,
  textClassName = 'text-sm font-semibold tracking-[-0.02em] text-slate-900',
  variant = 'horizontal',
  tagline,
  taglineClassName = 'text-xs text-slate-500',
}: SuhuellaWordmarkProps) {
  const identity = useEffectiveBrandIdentity()

  if (variant === 'compact') {
    return (
      <BrandMark
        identity={identity}
        size={glyphSize}
        className={glyphClassName}
        alt={brand.displayName}
      />
    )
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`.trim()}>
      <BrandMark
        identity={identity}
        size={glyphSize}
        className={glyphClassName}
        alt={brand.displayName}
      />
      <BrandWordmark
        identity={identity}
        className={textClassName}
        tagline={tagline}
        taglineClassName={taglineClassName}
      />
    </span>
  )
}
