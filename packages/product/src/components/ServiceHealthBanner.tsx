import { productCopy } from '../lib/product-copy'
import type { DesktopDownloadOffer } from '../lib/desktop-download-cta'
import { serviceHealthCopy, type PublicServiceHealth } from '../lib/service-health'

export function ServiceHealthBanner({
  health,
  host,
  downloadOffer,
  onRetry,
}: {
  health: PublicServiceHealth
  host: 'browser' | 'electron'
  downloadOffer: DesktopDownloadOffer | null
  onRetry: () => void
}) {
  if (health.serviceState === 'NORMAL') return null
  const copy = serviceHealthCopy(health, host)
  const downloadHref = downloadOffer?.href ?? '/download'
  const downloadExternal = downloadOffer?.external ?? false

  return (
    <div className="feature-promo-card mb-6">
      <h2 className="feature-promo-title">{copy.title}</h2>
      <div className="feature-promo-body">{copy.body}</div>
      {copy.hint ? <p className="feature-promo-hint">{copy.hint}</p> : null}
      <div className="feature-promo-actions">
        {host === 'browser' && downloadOffer ? (
          <a
            href={downloadHref}
            target={downloadExternal ? '_blank' : undefined}
            rel={downloadExternal ? 'noopener noreferrer' : undefined}
            className="feature-promo-btn feature-promo-btn-secondary no-underline"
          >
            {productCopy('Download SuHuella')}
          </a>
        ) : null}
        <button type="button" className="feature-promo-btn feature-promo-btn-secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}
