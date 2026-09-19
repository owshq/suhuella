import { productCopy } from '../lib/product-copy'
import { ChevronRight } from 'lucide-react'
import type { LicenseHealthItem, LicenseStatusView } from '../types'

type HomeIdentityCardProps = {
  license: LicenseStatusView | null
  onOpenLicense?: () => void
}

function healthIcon(status: LicenseHealthItem['status']): string {
  if (status === 'ok') return '✓'
  if (status === 'attention') return '!'
  return '·'
}

function healthClass(status: LicenseHealthItem['status']): string {
  if (status === 'ok') return 'text-emerald-700'
  if (status === 'attention') return 'text-amber-800'
  return 'text-slate-400'
}

export function HomeIdentityCard({ license, onOpenLicense }: HomeIdentityCardProps) {
  if (!license) {
    return (
      <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{productCopy('SuHuella')}</p>
        <p className="mt-2 text-sm font-semibold text-slate-900">Checking your setup…</p>
      </div>
    )
  }

  const attention = license.needsAttention
  const offline = license.workingOffline
  const subtitle =
    attention && license.offlineUntilLabel
      ? `Offline until ${license.offlineUntilLabel}`
      : offline
        ? `Ready offline · Last checked ${license.lastCheckedLabel.toLowerCase()}`
        : license.productState === 'activation_required'
          ? 'Activate when you are ready'
          : `Last checked ${license.lastCheckedLabel.toLowerCase()}`

  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{productCopy('SuHuella')}</p>
      <p
        className={`mt-2 text-sm font-semibold leading-snug ${
          attention ? 'text-amber-900' : 'text-slate-900'
        }`}
      >
        {license.identityTitle}
      </p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      {!attention ? (
        <ul className="mt-4 space-y-1.5 border-t border-white/70 pt-4">
          {license.health.map((item) => (
            <li key={item.id} className={`flex items-center gap-2 text-sm ${healthClass(item.status)}`}>
              <span className="w-3 text-center font-semibold">{healthIcon(item.status)}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-white/70 pt-4 text-sm leading-relaxed text-amber-900/90">
          {productCopy('Refresh your license or contact support to keep SuHuella ready on this computer.')}
        </p>
      )}
    </>
  )

  if (!onOpenLicense) {
    return (
      <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpenLicense}
      className="flex w-full items-start justify-between rounded-[1.6rem] border border-white/60 bg-white/55 p-5 text-left shadow-xl shadow-blue-900/5 backdrop-blur-xl transition hover:bg-white/70"
    >
      <div className="min-w-0 flex-1">{content}</div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
    </button>
  )
}
