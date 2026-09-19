import type { ReactNode } from 'react'

export type FeaturePromoAction = {
  label: string
  onClick?: () => void
  href?: string
  external?: boolean
  disabled?: boolean
}

function PromoActionButton({ action, variant }: { action: FeaturePromoAction; variant: 'primary' | 'secondary' }) {
  const className = `feature-promo-btn ${
    variant === 'primary' ? 'feature-promo-btn-primary' : 'feature-promo-btn-secondary'
  }`

  if (action.href) {
    return (
      <a
        href={action.href}
        target={action.external ? '_blank' : undefined}
        rel={action.external ? 'noopener noreferrer' : undefined}
        className={`${className} no-underline`}
      >
        {action.label}
      </a>
    )
  }

  return (
    <button type="button" className={className} disabled={action.disabled} onClick={action.onClick}>
      {action.label}
    </button>
  )
}

export function FeaturePromoCard({
  title,
  description,
  hint,
  primary,
  secondary,
  extra,
  dropActive,
  className = '',
  children,
}: {
  title: string
  description: ReactNode
  hint?: ReactNode
  primary?: FeaturePromoAction
  secondary?: FeaturePromoAction
  extra?: FeaturePromoAction
  dropActive?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`feature-promo-card ${dropActive ? 'feature-promo-card-active' : ''} ${className}`.trim()}
    >
      <h2 className="feature-promo-title">{title}</h2>
      <div className="feature-promo-body">{description}</div>
      {hint ? <p className="feature-promo-hint">{hint}</p> : null}
      {primary || secondary || extra ? (
        <div className="feature-promo-actions">
          {primary ? <PromoActionButton action={primary} variant="primary" /> : null}
          {secondary ? <PromoActionButton action={secondary} variant="secondary" /> : null}
          {extra ? <PromoActionButton action={extra} variant="secondary" /> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
