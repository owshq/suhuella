import type { EffectiveBrandIdentity } from '../lib/effective-brand-identity'

type BrandWordmarkProps = {
  identity: EffectiveBrandIdentity
  className?: string
  tagline?: string
  taglineClassName?: string
}

/** Paints EffectiveBrandIdentity.wordmark (ADR-003). Never resolves — caller passes identity. */
export function BrandWordmark({
  identity,
  className = 'text-sm font-semibold tracking-[-0.02em] text-[var(--app-fg)]',
  tagline,
  taglineClassName = 'text-xs text-[var(--app-fg)] opacity-60',
}: BrandWordmarkProps) {
  return (
    <span className="min-w-0">
      <span className={`block truncate ${className}`.trim()}>{identity.wordmark}</span>
      {tagline ? (
        <span className={`mt-0.5 block truncate ${taglineClassName}`.trim()}>{tagline}</span>
      ) : null}
    </span>
  )
}
