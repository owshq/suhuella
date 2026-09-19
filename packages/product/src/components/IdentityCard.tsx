import { useAppLocale } from '../lib/app-locale'
import { hasBusinessBrandLogo } from '../lib/effective-brand-identity'
import { useEffectiveBrandIdentity } from './AppBrandingContext'
import { BrandMark } from './BrandMark'

type IdentityCardProps = {
  deviceName: string
  licenseLine: string
  needsAttention?: boolean
  free: boolean
  compact?: boolean
  onActivateLicense: () => void
}

function logoShellClass(needsAttention: boolean | undefined, hasBusinessLogo: boolean): string {
  if (needsAttention) return 'bg-amber-500/20'
  if (hasBusinessLogo) return 'bg-transparent'
  return 'bg-[color-mix(in_srgb,var(--brand-accent)_12%,transparent)]'
}

function IdentityFooterContent({
  deviceName,
  subtitle,
  needsAttention,
  hasBusinessLogo,
}: {
  deviceName: string
  subtitle: string
  needsAttention?: boolean
  hasBusinessLogo: boolean
}) {
  const identity = useEffectiveBrandIdentity()

  return (
    <>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${logoShellClass(
          needsAttention,
          hasBusinessLogo,
        )}`}
      >
        <BrandMark identity={identity} size={24} />
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--app-fg)]">
          {deviceName}
        </span>
        <span
          className={`block truncate text-[11px] ${
            needsAttention ? 'text-amber-500' : 'text-[var(--app-fg)] opacity-50'
          }`}
        >
          {subtitle}
        </span>
      </span>
    </>
  )
}

export function IdentityCard({
  deviceName,
  licenseLine,
  needsAttention,
  free,
  compact = false,
  onActivateLicense,
}: IdentityCardProps) {
  const { t } = useAppLocale()
  const identity = useEffectiveBrandIdentity()
  const hasBusinessLogo = hasBusinessBrandLogo(identity)
  const subtitle = licenseLine || (free ? t.freeActivate : t.license)
  const shellClassName = needsAttention
    ? 'w-full rounded-xl border border-transparent bg-amber-500/10 text-left transition hover:border-amber-300/60 active:scale-[0.99]'
    : 'w-full rounded-xl border border-transparent bg-transparent text-left transition hover:border-[var(--sidebar-line)] hover:bg-[var(--overlay-row)] active:scale-[0.99]'

  if (compact) {
    return (
      <button
        type="button"
        onClick={onActivateLicense}
        aria-label={`${t.openSettings} · ${deviceName}`}
        title={deviceName}
        className={`flex items-center justify-center ${shellClassName} px-0 py-2`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${logoShellClass(
            needsAttention,
            hasBusinessLogo,
          )}`}
        >
          <BrandMark identity={identity} size={24} />
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onActivateLicense}
      aria-label={t.openSettings}
      className={`flex items-center gap-2.5 px-3 py-2.5 ${shellClassName}`}
    >
      <IdentityFooterContent
        deviceName={deviceName}
        subtitle={subtitle}
        needsAttention={needsAttention}
        hasBusinessLogo={hasBusinessLogo}
      />
    </button>
  )
}
