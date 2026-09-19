import { productCopy } from '../lib/product-copy'
import type { AppSettings, IndexScanProgress, KnowledgeIndexHealth } from '../types'

type KnowledgeIndexPanelProps = {
  settings: AppSettings | null
  scan: IndexScanProgress
  health: KnowledgeIndexHealth | null
  compact?: boolean
  busy?: boolean
  onAddLocation?: () => void
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function statusLabel(
  health: KnowledgeIndexHealth | null,
  scan: IndexScanProgress,
  folderCount: number,
): string {
  if (scan.status === 'scanning') return 'Indexing…'
  if (health?.status === 'not-indexed' || folderCount === 0) return 'Not ready yet'
  if (scan.status === 'error') return 'Could not finish'
  if (scan.status === 'cancelled') return 'Cancelled'
  return 'Ready'
}

function statusClass(status: string): string {
  if (status === 'Ready') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Indexing…') return 'bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] text-[var(--brand-accent)]'
  if (status === 'Could not finish') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

export function KnowledgeIndexPanel({
  settings,
  scan,
  health,
  compact = false,
  busy = false,
  onAddLocation,
}: KnowledgeIndexPanelProps) {
  const folderCount = settings?.indexedFolderCount ?? health?.folderCount ?? 0
  const fileCount = settings?.indexedFileCount ?? health?.fileCount ?? 0
  const sourceCount = health?.sourceCount ?? settings?.indexedLocations.length ?? 0
  const locationCount = settings?.indexedLocations.length ?? health?.locationCount ?? 0
  const status = statusLabel(health, scan, folderCount)
  const isEmpty = locationCount === 0 && folderCount === 0 && scan.status !== 'scanning'

  return (
    <div
      className={`rounded-2xl border border-white/70 bg-white/45 ${compact ? 'px-4 py-3' : 'px-4 py-4'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          {productCopy('What SuHuella learned')}
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
          {status}
        </span>
      </div>

      {isEmpty ? (
        <div className={compact ? 'mt-3' : 'mt-4'}>
          <p className="text-sm leading-relaxed text-slate-600">
            {productCopy('Nothing indexed yet. Add the folders you already use so SuHuella can suggest the right place when you save.')}
          </p>
          {onAddLocation ? (
            <button
              type="button"
              onClick={onAddLocation}
              disabled={busy}
              className="mt-3 inline-flex items-center rounded-full bg-[var(--brand-accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-60"
            >
              Add folders
            </button>
          ) : null}
        </div>
      ) : (
        <dl className={`grid grid-cols-2 gap-3 text-sm ${compact ? 'mt-3' : 'mt-4'}`}>
          <div>
            <dt className="text-xs text-slate-500">Folders</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">{sourceCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Indexed folders</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">{folderCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Indexed files</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">{fileCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last indexed</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">
              {formatRelativeTime(settings?.lastIndexed ?? health?.lastIndexed ?? null)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
