import { DEV_DEMO_HINT, isBrowserDevHost } from '../host/browser/dev-host'
import type { IndexedLocationSummary } from '../types'

type DeveloperSourcesPanelProps = {
  locations: IndexedLocationSummary[]
  busy?: boolean
  embedded?: boolean
  onLoadDemo: () => void
  onReconnect: (path: string) => void
}

export function DeveloperSourcesPanel({
  locations,
  busy,
  embedded = false,
  onLoadDemo,
  onReconnect,
}: DeveloperSourcesPanelProps) {
  if (!isBrowserDevHost()) return null

  const reconnectable = locations.filter(
    (location) =>
      location.status === 'permission_denied' || location.status === 'unavailable',
  )
  const demoLoaded = locations.some((location) => location.catalogKey === DEV_DEMO_HINT)

  return (
    <section
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/8 px-4 py-3${embedded ? ' mt-5' : ''}`}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Developer Sources
        </p>
        <p className="text-[12px] text-[var(--app-fg)] opacity-60">
          Localhost only. Production never shows this panel.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onLoadDemo}
          className="rounded-full bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {demoLoaded ? 'Reload demo data' : 'Load demo data'}
        </button>
        {reconnectable.map((location) => (
          <button
            key={location.path}
            type="button"
            disabled={busy}
            onClick={() => onReconnect(location.path)}
            className="rounded-full border border-amber-600/40 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800 dark:text-amber-300 disabled:opacity-50"
          >
            Reconnect {location.name}
          </button>
        ))}
      </div>
    </section>
  )
}
