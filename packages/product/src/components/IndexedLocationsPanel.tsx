import { productCopy } from '../lib/product-copy'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  HelpCircle,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  FUTURE_SOURCES,
  WHY_FOLDER_STEPS,
  formatDayLabel,
  formatLastUpdated,
  isHealthyStatus,
  learningStatusLabel,
  qualityLabel,
  statusLabel,
  usefulnessLabel,
} from '../lib/folders-ui'
import { getSuhuellaApi } from '../lib/api'
import type {
  AppSettings,
  FoldersKnowledgeSummary,
  IndexedLocationStatus,
  IndexedLocationSummary,
  IndexScanProgress,
} from '../types'

type IndexedLocationsPanelProps = {
  settings: AppSettings | null
  scan: IndexScanProgress
  locations?: IndexedLocationSummary[]
  summary?: FoldersKnowledgeSummary | null
  busy?: boolean
  onAdd: () => void
  onRemove: (location: string) => void
  onRescan: () => void
  onCancelScan: () => void
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return 'A moment longer…'
  if (seconds < 60) return `About ${seconds}s left`
  const minutes = Math.ceil(seconds / 60)
  return `About ${minutes} min left`
}

function scanProgressPercent(scan: IndexScanProgress): number {
  if (scan.status !== 'scanning') return scan.status === 'ready' ? 100 : 0
  return Math.min(92, Math.round((1 - Math.exp(-scan.foldersScanned / 180)) * 100))
}

function summariesFromSettings(
  settings: AppSettings | null,
  scan: IndexScanProgress,
): IndexedLocationSummary[] {
  return (settings?.indexedLocations ?? []).map((location) => {
    const parts = location.split(/[/\\]+/).filter(Boolean)
    return {
      path: location,
      name: parts.at(-1) ?? location,
      lastIndexed: settings?.lastIndexed ?? null,
      folderCount: 0,
      fileCount: 0,
      status: scan.status === 'scanning' ? 'indexing' : 'not_indexed',
      usefulness: 'unknown',
      exists: true,
    }
  })
}

function StatusBadge({ status }: { status: IndexedLocationStatus }) {
  const label = statusLabel(status)
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </span>
    )
  }
  if (status === 'indexing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-accent)]">
        <RefreshCw className="h-3 w-3 animate-spin" />
        {label}
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--overlay-row)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-fg)] opacity-70">
        <PauseCircle className="h-3 w-3" />
        {label}
      </span>
    )
  }
  if (status === 'needs_refresh') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
        <AlertTriangle className="h-3 w-3" />
        {label}
      </span>
    )
  }
  if (
    status === 'unavailable' ||
    status === 'permission_denied' ||
    status === 'external_drive_disconnected'
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-500">
        <AlertTriangle className="h-3 w-3" />
        {label}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[var(--overlay-row)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-fg)] opacity-70">
      {label}
    </span>
  )
}

function locationIssueCopy(
  status: IndexedLocationStatus,
  healthyOthers: number,
): {
  title: string
  happened: string
  next: string
  stillWorks: string
} | null {
  const stillLearning =
    healthyOthers > 0
      ? `Still learning from ${healthyOthers} other folder${healthyOthers === 1 ? '' : 's'}.`
      : productCopy('SuHuella can keep working with folders that are available.')

  switch (status) {
    case 'unavailable':
      return {
        title: 'Folder unavailable',
        happened: productCopy('SuHuella cannot see this folder right now.'),
        next: 'Check that the folder is still on this computer, or remove it.',
        stillWorks: stillLearning,
      }
    case 'permission_denied':
      return {
        title: 'Permission needed',
        happened: productCopy('SuHuella does not have permission to look at this folder.'),
        next: productCopy('Give SuHuella access in system settings, or choose a different folder.'),
        stillWorks: stillLearning,
      }
    case 'external_drive_disconnected':
      return {
        title: 'Drive disconnected',
        happened: 'This folder is on a drive that is not connected.',
        next: 'Connect the drive and learn again, or remove the folder.',
        stillWorks: stillLearning,
      }
    default:
      return null
  }
}

const WHY_STEP_ICONS = [FolderPlus, Sparkles, FileText, HardDrive, CheckCircle2] as const

function WhyTheseFolders({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <HelpCircle className="h-4 w-4 text-[var(--brand-accent)]" />
          Why these folders?
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {expanded ? (
        <div className="border-t border-white/70 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-start gap-2">
            {WHY_FOLDER_STEPS.map((step, index) => {
              const Icon = WHY_STEP_ICONS[index]
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div className="flex w-[7.4rem] flex-col items-center text-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] text-[var(--brand-accent)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-snug text-slate-700">{step.label}</p>
                  </div>
                  {index < WHY_FOLDER_STEPS.length - 1 ? (
                    <ChevronRight className="mt-2 hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
                  ) : null}
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            {productCopy('SuHuella does not learn from every file on your computer. It only learns from the folders you choose.')}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function IndexedLocationsPanel({
  settings,
  scan,
  locations,
  summary,
  busy = false,
  onAdd,
  onRemove,
  onRescan,
  onCancelScan,
}: IndexedLocationsPanelProps) {
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [whyExpanded, setWhyExpanded] = useState(false)
  const summaries = locations && locations.length > 0 ? locations : summariesFromSettings(settings, scan)
  const isScanning = scan.status === 'scanning'
  const progressPercent = scanProgressPercent(scan)
  const isEmpty = summaries.length === 0

  const rootFolderCount = settings?.indexedLocations.length ?? 0
  const indexedFolderCount = isScanning
    ? scan.foldersScanned
    : (settings?.indexedFolderCount ?? 0)
  const indexedFileCount = isScanning
    ? scan.filesSeen
    : (settings?.indexedFileCount ?? 0)
  const lastUpdated = formatLastUpdated(settings?.lastIndexed ?? null)
  const lastLearnedDay = formatDayLabel(settings?.lastIndexed ?? null)
  const newFiles = summary?.lastLearnedNewFiles ?? settings?.lastLearnedNewFiles ?? null
  const updatedFolders = summary?.lastLearnedUpdatedFolders ?? settings?.lastLearnedUpdatedFolders ?? null
  const quality = summary?.quality ?? (isEmpty ? 'needs_more' : 'learning')
  const learningStatus = learningStatusLabel(quality, isScanning)

  const healthyOthersByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const location of summaries) {
      const count = summaries.filter(
        (item) => item.path !== location.path && isHealthyStatus(item.status),
      ).length
      map.set(location.path, count)
    }
    return map
  }, [summaries])

  async function openFolder(location: string) {
    setOpenError(null)
    setOpeningPath(location)
    try {
      const result = await getSuhuellaApi().openFolder(location)
      if (!result.ok) setOpenError(location)
    } catch {
      setOpenError(location)
    } finally {
      setOpeningPath(null)
    }
  }

  return (
    <div className="space-y-4">
      {isEmpty ? (
        <>
          <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-8 text-center">
            <FolderPlus className="mx-auto mb-3 h-7 w-7 text-[var(--app-fg)] opacity-50" />
            <p className="text-base font-semibold text-[var(--app-fg)]">Add the folders you already use</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--app-fg)] opacity-70">
              {productCopy('SuHuella looks at folder names and file names to understand where documents usually belong. File contents stay private.')}
            </p>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy || isScanning}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--app-fg)] px-4 py-2.5 text-sm font-semibold text-[var(--app-bg)] transition hover:opacity-90 disabled:opacity-60"
            >
              <FolderPlus className="h-4 w-4" />
              Add folder
            </button>
          </div>
          <WhyTheseFolders expanded={whyExpanded} onToggle={() => setWhyExpanded((value) => !value)} />
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-medium text-[var(--app-fg)] opacity-60">{productCopy('SuHuella is learning from')}</p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  {rootFolderCount.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--app-fg)] opacity-60">folders you chose</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  {indexedFileCount.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--app-fg)] opacity-60">files seen</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-[var(--app-fg)] opacity-60">Last updated</span>{' '}
                <span className="font-semibold text-[var(--app-fg)]">{lastUpdated}</span>
              </span>
              <span>
                <span className="text-[var(--app-fg)] opacity-60">Learning status</span>{' '}
                <span className="font-semibold text-[var(--app-fg)]">{learningStatus}</span>
              </span>
            </div>
            {newFiles !== null && newFiles > 0 ? (
              <p className="mt-2 text-sm">
                <span className="text-[var(--app-fg)] opacity-60">Last updated</span>{' '}
                <span className="font-semibold text-[var(--app-fg)]">
                  {lastLearnedDay} · {newFiles.toLocaleString()} new file
                  {newFiles === 1 ? '' : 's'}
                  {updatedFolders !== null && updatedFolders > 0
                    ? ` · ${updatedFolders.toLocaleString()} updated folder${updatedFolders === 1 ? '' : 's'}`
                    : ''}
                </span>
              </p>
            ) : null}
            <p className="mt-3 border-t border-[var(--sidebar-line)] pt-3 text-sm text-[var(--app-fg)] opacity-70">
              Everything stays on your computer.
            </p>
          </div>

          <WhyTheseFolders expanded={whyExpanded} onToggle={() => setWhyExpanded((value) => !value)} />

          <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-fg)] opacity-50">Sources</p>

            <div className="mt-3 rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] text-[var(--brand-accent)]">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--app-fg)]">This computer</p>
                      {isScanning ? (
                        <StatusBadge status="indexing" />
                      ) : scan.status === 'cancelled' ? (
                        <StatusBadge status="cancelled" />
                      ) : (
                        <StatusBadge status={rootFolderCount > 0 ? 'ready' : 'not_indexed'} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {rootFolderCount.toLocaleString()} folders · {indexedFileCount.toLocaleString()} files
                    </p>
                    {newFiles !== null && newFiles > 0 ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        {newFiles.toLocaleString()} new {lastLearnedDay.toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRescan}
                  disabled={busy || isScanning || rootFolderCount === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--app-fg)] px-3 py-1.5 text-xs font-semibold text-[var(--app-bg)] hover:opacity-90 disabled:opacity-60 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Learn again
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming later"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--sidebar-line)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--app-fg)] opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Check for changes
                  <span className="rounded-full bg-[var(--overlay-row)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
                    Later
                  </span>
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--app-fg)] opacity-50">
                Learn again reads everything from scratch. Checking only what changed is coming later.
              </p>
            </div>

            <div className="mt-4 border-t border-[var(--sidebar-line)] pt-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-fg)] opacity-50">
                Coming soon
              </p>
              <ul className="mt-2 space-y-1.5">
                {FUTURE_SOURCES.map((source) => (
                  <li key={source.id} className="text-sm text-[var(--app-fg)] opacity-80">
                    {source.label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-[var(--app-fg)] opacity-50">
                More sources will recommend folders the same way.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--app-fg)]">Your folders</p>
              <button
                type="button"
                onClick={onAdd}
                disabled={busy || isScanning}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-on-accent)] shadow-[0_10px_20px_-10px_color-mix(in_srgb,var(--brand-accent)_70%,transparent)] transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-60"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add folder
              </button>
            </div>

            {summaries.map((location) => {
              const status =
                isScanning && (location.status === 'ready' || location.status === 'needs_refresh')
                  ? 'indexing'
                  : location.status
              const issue = locationIssueCopy(status, healthyOthersByPath.get(location.path) ?? 0)

              return (
                <article
                  key={location.path}
                  className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3.5 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] text-[var(--brand-accent)]">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--app-fg)]">{location.name}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--app-fg)] opacity-50">{location.path}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--app-fg)] opacity-60">
                        <span>
                          <span className="font-semibold text-[var(--app-fg)] opacity-100">
                            {location.fileCount.toLocaleString()}
                          </span>{' '}
                          files
                        </span>
                        <span>{formatDayLabel(location.lastIndexed)}</span>
                        <span className="rounded-full bg-[var(--overlay-row)] px-2 py-0.5 font-medium text-[var(--app-fg)] opacity-80">
                          {usefulnessLabel(location.usefulness)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void openFolder(location.path)}
                      disabled={busy || openingPath === location.path}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-2.5 py-1 text-xs font-semibold text-[var(--app-fg)] transition hover:bg-black/5 disabled:opacity-60"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {openingPath === location.path ? 'Opening…' : 'Open folder'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(location.path)}
                      disabled={busy || isScanning}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200/50 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/20 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  {issue ? (
                    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-900">
                      <p className="font-semibold">{issue.title}</p>
                      <p className="mt-1 leading-relaxed">{issue.happened}</p>
                      <p className="mt-1 leading-relaxed">{issue.next}</p>
                      <p className="mt-1 leading-relaxed text-rose-800/90">{issue.stillWorks}</p>
                    </div>
                  ) : null}
                  {openError === location.path ? (
                    <p className="mt-3 text-sm leading-relaxed text-rose-800">
                      {productCopy('SuHuella could not open this folder. Check that it is still available.')}{' '}
                      {(healthyOthersByPath.get(location.path) ?? 0) > 0
                        ? `Still learning from ${healthyOthersByPath.get(location.path)} other folder${healthyOthersByPath.get(location.path) === 1 ? '' : 's'}.`
                        : null}
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        </>
      )}

      {(isScanning || !isEmpty) && (
        <div className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">
              {isScanning ? 'Indexing folders…' : 'Learning status'}
            </p>
            {isScanning ? (
              <button
                type="button"
                onClick={onCancelScan}
                className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </button>
            ) : null}
          </div>

          {isScanning ? (
            <div className="mt-3 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-[var(--app-fg)] opacity-50">
                <span>{formatEta(scan.estimatedRemainingSeconds)}</span>
                <span>{progressPercent}%</span>
              </div>
              {scan.currentPath ? (
                <p className="truncate text-xs text-[var(--app-fg)] opacity-50">{scan.currentPath}</p>
              ) : null}
            </div>
          ) : null}

          {!isEmpty ? (
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--app-fg)] opacity-50">Last updated</dt>
                <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">{lastUpdated}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--app-fg)] opacity-50">Folders indexed</dt>
                <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                  {indexedFolderCount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--app-fg)] opacity-50">Files indexed</dt>
                <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                  {indexedFileCount.toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : null}

          {scan.status === 'error' ? (
            <div className="mt-3 rounded-xl border border-rose-200/50 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-500">
              <p className="font-semibold">Could not finish</p>
              <p className="mt-1 leading-relaxed opacity-80">
                {productCopy('SuHuella could not finish learning from your folders.')}
              </p>
              <p className="mt-1 leading-relaxed opacity-80">
                Try Learn again. If it happens again, remove a folder that looks unavailable.
              </p>
              <p className="mt-1 leading-relaxed opacity-70">
                Still learning from {summaries.filter((item) => isHealthyStatus(item.status)).length}{' '}
                folder
                {summaries.filter((item) => isHealthyStatus(item.status)).length === 1 ? '' : 's'}.
              </p>
            </div>
          ) : null}
          {scan.status === 'cancelled' && (settings?.indexedFolderCount ?? 0) === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--app-fg)] opacity-50">
              Learning was cancelled. You can start again whenever you like.
            </p>
          ) : null}
        </div>
      )}

      {!isEmpty && summary ? (
        <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--app-fg)]">{productCopy('What SuHuella learned')}</p>
            <div className="text-right">
              <p className="text-[11px] text-[var(--app-fg)] opacity-50">Knowledge quality</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--app-fg)] opacity-80">
                {qualityLabel(summary.quality)}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--app-fg)] opacity-50">Folders</dt>
              <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                {indexedFolderCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--app-fg)] opacity-50">Files</dt>
              <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                {indexedFileCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--app-fg)] opacity-50">Unique names</dt>
              <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                {summary.uniqueNames.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--app-fg)] opacity-50">Languages</dt>
              <dd className="mt-0.5 font-semibold text-[var(--app-fg)] opacity-80">
                {summary.languages.length > 0 ? summary.languages.length : '—'}
              </dd>
            </div>
          </dl>
          {summary.recognised.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-[var(--app-fg)] opacity-50">Recognises</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.recognised.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-accent)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--app-fg)] opacity-50">From folder names and file names. Not from contents.</p>
            </div>
          ) : null}
          {summary.languages.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-[var(--app-fg)] opacity-50">Languages seen in names</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-fg)] opacity-80">{summary.languages.join(' · ')}</p>
            </div>
          ) : null}
          {summary.topFolders.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-[var(--app-fg)] opacity-50">Most common folders</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-fg)] opacity-80">
                {summary.topFolders.join(' · ')}
              </p>
            </div>
          ) : null}
          {summary.documentTypes.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-[var(--app-fg)] opacity-50">Document types</p>
              <p className="mt-1 text-sm font-medium text-[var(--app-fg)] opacity-80">
                {summary.documentTypes.join(' · ')}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-4">
        <p className="text-sm font-semibold text-[var(--app-fg)]">Privacy</p>
        <p className="mt-2 text-sm text-[var(--app-fg)] opacity-70">{productCopy('SuHuella learns from')}</p>
        <ul className="mt-2 space-y-1 text-sm text-[var(--app-fg)] opacity-70">
          <li>· folder names</li>
          <li>· file names</li>
          <li>· locations</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-[var(--app-fg)] opacity-60">
          It never uploads your files. Your files never leave your computer.
        </p>
      </div>
    </div>
  )
}
