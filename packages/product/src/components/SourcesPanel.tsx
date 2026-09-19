import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { LayoutGrid, List, Plus, RotateCcw, Search, XCircle } from 'lucide-react'
import { Children, type ReactNode, useEffect, useRef, useState } from 'react'
import { thisComputerLabel } from '../lib/folders-ui'
import {
  browserCapabilityCatalog,
  browserChooseSubfolderLabel,
  browserCloudComingLaterCopy,
  browserConnectFolderHint,
  browserConnectFolderLabel,
  browserIntegrationsActionLabel,
  browserLocalFoldersLabel,
  sourcesWhatCanSeeCopy,
  formatDocumentCount,
  lastUpdatedCopy,
  SOURCES_PRIVACY_LINES,
  sourceAnotherFolderLabel,
  sourceGrantActionLabel,
  sourcePickActionLabel,
  sourceSightGroup,
  sourceSightLabel,
  sourceSightState,
  sourcesEmptyBody,
  sourcesLimitedSupportCopy,
  sourcesUnsupportedBody,
  sourceUnavailableActionLabel,
  type SourceSightState,
} from '../lib/sources-ui'
import type { DesktopDownloadOffer } from '../lib/desktop-download-cta'
import {
  defaultSourceAppearance,
  normalizeSourceKey,
  resolveSourceAppearance,
  sourceAppearanceDotColor,
} from '../lib/source-appearance'
import { FeaturePromoCard } from './FeaturePromoCard'
import {
  SourceAppearanceMenu,
  SourceIconBadge,
  useGridAppearanceEditor,
  useSourceAppearanceMenu,
} from './SourceIconBadge'
import type { SourceIconId } from '../types'
import { sameSourceName } from '../lib/well-known-sources'
import type {
  AppHost,
  AppSettings,
  IndexedLocationSummary,
  IndexScanProgress,
  PlatformCapabilities,
  SuggestedLocation,
} from '../types'

function samePath(left: string, right: string): boolean {
  return left.replace(/\\/g, '/').toLowerCase() === right.replace(/\\/g, '/').toLowerCase()
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return 'A moment longer…'
  if (seconds < 60) return `About ${seconds}s left`
  return `About ${Math.ceil(seconds / 60)} min left`
}

function scanProgressPercent(scan: IndexScanProgress): number {
  if (scan.status !== 'scanning') return scan.status === 'ready' ? 100 : 0
  return Math.min(92, Math.round((1 - Math.exp(-scan.foldersScanned / 180)) * 100))
}

type SourceLayout = 'list' | 'grid'

const HEADER_GLASS_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--overlay-bg)]/35 text-[var(--app-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-white/10 backdrop-blur-2xl transition hover:bg-[var(--overlay-bg)]/50 active:scale-[0.96]'

function matchesSourceQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return text.toLowerCase().includes(needle)
}

function filterLocations(items: IndexedLocationSummary[], query: string): IndexedLocationSummary[] {
  if (!query.trim()) return items
  return items.filter(
    (item) => matchesSourceQuery(item.name, query) || matchesSourceQuery(item.path, query),
  )
}

function filterSuggested(items: SuggestedLocation[], query: string): SuggestedLocation[] {
  if (!query.trim()) return items
  return items.filter(
    (item) => matchesSourceQuery(item.label, query) || matchesSourceQuery(item.path, query),
  )
}

function HeaderGlassButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={HEADER_GLASS_BUTTON}>
      {children}
    </button>
  )
}

function SourceCard({
  path,
  title,
  kind,
  platform,
  sourceAppearance,
  onAppearanceChange,
  sight,
  scanning,
  files,
  updated,
  actionLabel,
  busy,
  needsAttention,
  layout = 'list',
  onAction,
  onOpenSource,
  onRescan,
  onRemove,
}: {
  path: string
  title: string
  kind?: SuggestedLocation['kind']
  platform?: 'darwin' | 'win32' | 'linux'
  sourceAppearance?: AppSettings['sourceAppearance']
  onAppearanceChange?: (path: string, update: { color?: string | null; iconId?: SourceIconId | null }) => void
  sight: SourceSightState
  scanning?: boolean
  files?: number
  updated?: string | null
  actionLabel?: string | null
  busy?: boolean
  needsAttention?: boolean
  layout?: SourceLayout
  onAction?: () => void
  onOpenSource?: () => void
  onRescan?: () => void
  onRemove?: () => void
}) {
  const appearance = resolveSourceAppearance(path, title, kind, sourceAppearance, platform)
  const cardRef = useRef<HTMLElement>(null)
  const appearanceMenu = useSourceAppearanceMenu()
  const gridEditor = useGridAppearanceEditor()
  const canCustomize = appearance.customizable && Boolean(onAppearanceChange)
  const indexed = sight === 'indexed'
  const titleDotColor = sourceAppearanceDotColor(appearance)
  const appearanceOverride = sourceAppearance?.[normalizeSourceKey(path)]
  const hasAppearanceOverride = Boolean(appearanceOverride?.color || appearanceOverride?.iconId)
  const isGrid = layout === 'grid'

  function pickColor(color: string | null) {
    onAppearanceChange?.(path, { color })
  }

  function pickIcon(iconId: SourceIconId | null) {
    onAppearanceChange?.(path, { iconId })
  }

  function openListAppearanceMenu() {
    if (!canCustomize || !cardRef.current) return
    appearanceMenu.open(cardRef.current)
  }

  function toggleGridAppearance() {
    if (!canCustomize) return
    gridEditor.toggle()
  }

  function openSource() {
    onOpenSource?.()
  }
  const statusLine =
    scanning && (sight === 'indexed' || sight === 'available')
      ? 'Updating…'
      : sourceSightLabel(sight)
  const details = indexed
    ? [files != null ? formatDocumentCount(files) : null, lastUpdatedCopy(updated ?? null)].filter(Boolean)
    : sight === 'unavailable'
      ? [actionLabel === 'Restore permission' ? 'Permission required' : 'This folder is no longer available']
      : []
  const actionButtons = (
    <>
      {actionLabel ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onAction}
            className="rounded-full bg-[var(--app-fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--app-bg)] hover:opacity-90 disabled:opacity-50 transition"
          >
            {actionLabel}
          </button>
          {needsAttention && onRemove ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove()
              }}
              className="rounded-full border border-[var(--sidebar-line)] bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[var(--app-fg)] opacity-80 hover:opacity-100 hover:bg-black/5 transition"
            >
              Remove
            </button>
          ) : null}
        </>
      ) : indexed || needsAttention ? (
        <div className="flex gap-1">
          {onRescan ? (
            <button
              type="button"
              onClick={onRescan}
              className="rounded-full bg-[var(--overlay-row)] p-1.5 text-[var(--app-fg)] opacity-50 hover:opacity-100 transition"
              aria-label="Refresh"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onRemove()
              }}
              className="rounded-full border border-[var(--sidebar-line)] bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[var(--app-fg)] opacity-80 hover:opacity-100 hover:bg-black/5 transition"
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  )

  const appearanceMenuNode =
    !isGrid && appearanceMenu.anchorEl && onAppearanceChange ? (
      <SourceAppearanceMenu
        anchorEl={appearanceMenu.anchorEl}
        appearance={appearance}
        hasOverride={hasAppearanceOverride}
        onPickColor={pickColor}
        onPickIcon={(iconId) => {
          const defaults = defaultSourceAppearance(title, path, kind, platform)
          pickIcon(iconId === defaults.iconId ? null : iconId)
        }}
        onClose={appearanceMenu.close}
      />
    ) : null

  if (isGrid) {
    return (
      <>
        <article
          ref={cardRef}
          className={`group flex flex-col overflow-visible ${sight === 'coming_later' ? 'pointer-events-none opacity-60' : ''} ${onOpenSource || onAction ? 'cursor-pointer' : ''}`}
          onClick={onOpenSource ? openSource : onAction}
        >
          <div ref={gridEditor.badgeRef} className="w-full">
            <SourceIconBadge
              appearance={appearance}
              size="grid"
              variant="source"
              className={`w-full ${onOpenSource ? 'cursor-pointer' : ''}`}
              editing={gridEditor.open}
              hasOverride={hasAppearanceOverride}
              onPickColor={pickColor}
              onPickIcon={(iconId) => {
                const defaults = defaultSourceAppearance(title, path, kind, platform)
                pickIcon(iconId === defaults.iconId ? null : iconId)
              }}
              onPress={onOpenSource ? undefined : canCustomize ? toggleGridAppearance : undefined}
            />
          </div>
          <h3 className="relative mt-4 min-w-0 text-[19px] font-semibold tracking-tight text-[var(--app-fg)]">
            <span
              className="pointer-events-none absolute left-0 top-1/2 z-10 h-2.5 w-2.5 -translate-x-[calc(100%+0.375rem)] -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ backgroundColor: titleDotColor }}
              aria-hidden
            />
            <span className="block truncate">{title}</span>
          </h3>
          <p className="mt-1 text-[14px] text-[var(--app-fg)] opacity-50">{statusLine}</p>
          {details.length > 0 ? (
            <p className="mt-1 text-[13px] text-[var(--app-fg)] opacity-60">{details.join(' · ')}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {actionButtons}
          </div>
        </article>
        {appearanceMenuNode}
      </>
    )
  }

  return (
    <>
      <article
        ref={cardRef}
        className={`group flex items-center justify-between gap-4 border-b border-[var(--overlay-row)] px-3 py-3 last:border-0 hover:bg-[var(--overlay-row)] rounded-xl transition ${sight === 'coming_later' ? 'pointer-events-none opacity-60' : ''} ${onOpenSource || onAction ? 'cursor-pointer' : ''}`}
        onClick={onOpenSource ? openSource : onAction}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <SourceIconBadge
            appearance={appearance}
            size="lg"
            variant="source"
            className={onOpenSource ? 'cursor-pointer' : ''}
            onPress={onOpenSource ? undefined : canCustomize ? openListAppearanceMenu : undefined}
          />
          <div className="min-w-0 flex flex-col justify-center">
            <h3 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-[var(--app-fg)]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: titleDotColor }}
                aria-hidden
              />
              <span className="truncate">{title}</span>
            </h3>
          <p className="mt-0.5 text-[13px] text-[var(--app-fg)] opacity-50 flex items-center gap-2">
            <span>{statusLine}</span>
            {details.length > 0 && <span className="opacity-40">•</span>}
            {details.map((line, i) => (
              <span key={line} className="flex items-center gap-2">
                <span>{line}</span>
                {i < details.length - 1 && <span className="opacity-40">•</span>}
              </span>
            ))}
          </p>
        </div>
      </div>

        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actionButtons}
        </div>
      </article>
      {appearanceMenuNode}
    </>
  )
}

function AddSourceCard({
  label,
  hint,
  disabled,
  layout,
  onAdd,
}: {
  label: string
  hint: string
  disabled?: boolean
  layout: SourceLayout
  onAdd: () => void
}) {
  if (layout === 'grid') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        aria-label={label}
        className="flex w-full flex-col text-left disabled:opacity-50"
      >
        <div className="flex aspect-square items-center justify-center rounded-[2rem] border border-dashed border-[var(--sidebar-line)] bg-[var(--overlay-row)] text-[var(--app-fg)] opacity-40 transition hover:opacity-60">
          <Plus className="h-10 w-10" />
        </div>
        <p className="mt-4 text-[19px] font-semibold tracking-tight text-[var(--app-fg)]">{label}</p>
        <p className="mt-1 text-[14px] text-[var(--app-fg)] opacity-50">{hint}</p>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      aria-label={label}
      className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[var(--sidebar-line)] px-3 py-3 text-left transition hover:bg-[var(--overlay-row)] disabled:opacity-50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-dashed border-[var(--sidebar-line)] bg-[var(--overlay-row)] text-[var(--app-fg)] opacity-40">
        <Plus className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--app-fg)]">{label}</p>
        <p className="mt-0.5 text-[13px] text-[var(--app-fg)] opacity-50">{hint}</p>
      </div>
    </button>
  )
}

export function SourcesPanel({
  settings,
  scan,
  locations,
  suggested,
  platform,
  host,
  capabilities,
  busy,
  notice,
  downloadOffer,
  onAdd,
  onAddSuggested,
  onRemove,
  onRescan,
  onRestore,
  onCancelScan,
  onSourceAppearanceChange,
  onOpenSource,
  developerSources,
}: {
  settings: AppSettings | null
  scan: IndexScanProgress
  locations: IndexedLocationSummary[]
  suggested: SuggestedLocation[]
  platform?: 'darwin' | 'win32' | 'linux'
  host?: AppHost
  capabilities: PlatformCapabilities
  busy?: boolean
  notice?: string | null
  downloadOffer?: DesktopDownloadOffer | null
  onAdd: () => void
  onAddSuggested: (path: string) => void
  onRemove: (path: string) => void
  onRescan: () => void
  onRestore?: (path: string) => void
  onCancelScan: () => void
  onSourceAppearanceChange?: (path: string, update: { color?: string | null; iconId?: SourceIconId | null }) => void
  onOpenSource?: (path: string, title: string) => void
  developerSources?: ReactNode
}) {
  const { locale, t } = useAppLocale()
  const [viewMode, setViewMode] = useState<SourceLayout>('grid')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isScanning = scan.status === 'scanning'
  const progressPercent = scanProgressPercent(scan)
  const documentCount = locations.reduce((sum, location) => sum + location.fileCount, 0)
  const browser = host === 'browser'
  const desktop = !browser
  const pickLabel = sourcePickActionLabel(desktop)
  const grantLabel = desktop ? pickLabel : sourceGrantActionLabel()
  const anotherLabel = desktop ? pickLabel : sourceAnotherFolderLabel()
  const folderAccess = capabilities.filesystem
  const canOrganise = capabilities.organise
  const unsupported = browser && !folderAccess
  const limited = browser && folderAccess && !canOrganise
  const connectDisabled = busy || unsupported
  const addLabel = browser ? browserConnectFolderLabel(locale) : anotherLabel
  const addHint = browser ? browserConnectFolderHint(locale) : SOURCES_PRIVACY_LINES[0]
  const catalog = suggested.filter(
    (place) =>
      Boolean(place.path) &&
      (desktop
        ? place.exists && !place.path.startsWith('suhuella:')
        : true) &&
      !locations.some(
        (location) =>
          samePath(location.path, place.path) ||
          sameSourceName(location.name, place.label) ||
          (location.catalogKey && samePath(location.catalogKey, place.path)),
      ),
  )
  const available = desktop ? catalog : []
  const capabilityCards = browser ? browserCapabilityCatalog(platform ?? 'darwin') : []
  const systemCatalog = capabilityCards.filter((card) => card.capability === 'limited')
  const cloudCatalog = capabilityCards.filter((card) => card.capability === 'coming_later')
  const connectedKeys = new Set(
    locations.flatMap((location) =>
      [location.path, location.name, location.catalogKey]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    ),
  )
  const unusedSystemCatalog = systemCatalog.filter(
    (card) =>
      !connectedKeys.has(card.path.toLowerCase()) &&
      !locations.some((location) => sameSourceName(location.name, card.label)),
  )
  const unusedCloudCatalog = cloudCatalog.filter(
    (card) =>
      !connectedKeys.has(card.path.toLowerCase()) &&
      !locations.some((location) => sameSourceName(location.name, card.label)),
  )

  function locationSight(location: IndexedLocationSummary): SourceSightState {
    return sourceSightState({
      included: true,
      exists: location.exists,
      hostCanSee: location.exists && location.status !== 'permission_denied',
      status: location.status,
    })
  }

  function locationCard(location: IndexedLocationSummary, kind?: SuggestedLocation['kind']) {
    const sight = locationSight(location)
    const needsAttention = sight === 'unavailable'
    const permissionLost = location.status === 'permission_denied'
    const restore = permissionLost && onRestore ? () => onRestore(location.path) : () => onRescan()
    return (
      <SourceCard
        path={location.path}
        title={location.name}
        kind={kind}
        platform={platform}
        sourceAppearance={settings?.sourceAppearance}
        onAppearanceChange={onSourceAppearanceChange}
        sight={sight}
        scanning={isScanning}
        files={location.fileCount}
        updated={location.lastIndexed}
        actionLabel={needsAttention ? sourceUnavailableActionLabel(permissionLost) : null}
        busy={needsAttention && connectDisabled}
        needsAttention={needsAttention}
        layout={viewMode}
        onAction={needsAttention ? restore : undefined}
        onOpenSource={onOpenSource ? () => onOpenSource(location.path, location.name) : undefined}
        onRescan={() => onRescan()}
        onRemove={() => onRemove(location.path)}
      />
    )
  }

  const computerLocations = filterLocations(
    locations.filter(
      (location) => sourceSightGroup(undefined, location.name, location.path) === 'computer',
    ),
    searchQuery,
  )
  const externalLocations = filterLocations(
    locations.filter(
      (location) => sourceSightGroup(undefined, location.name, location.path) === 'external',
    ),
    searchQuery,
  )
  const cloudLocations = filterLocations(
    locations.filter(
      (location) => sourceSightGroup(undefined, location.name, location.path) === 'cloud',
    ),
    searchQuery,
  )
  const grantable: SuggestedLocation[] = []
  const computerAvailable = filterSuggested(
    available.filter(
      (place) => sourceSightGroup(place.kind, place.label, place.path) === 'computer',
    ),
    searchQuery,
  )
  const computerGrantable = filterSuggested(
    grantable.filter(
      (place) => sourceSightGroup(place.kind, place.label, place.path) === 'computer',
    ),
    searchQuery,
  )
  const externalAvailable = filterSuggested(
    available.filter(
      (place) => sourceSightGroup(place.kind, place.label, place.path) === 'external',
    ),
    searchQuery,
  )
  const cloudAvailable = filterSuggested(
    available.filter(
      (place) => sourceSightGroup(place.kind, place.label, place.path) === 'cloud',
    ),
    searchQuery,
  )
  const hasSourceCards =
    locations.length > 0 ||
    catalog.length > 0 ||
    computerLocations.length > 0 ||
    computerAvailable.length > 0 ||
    computerGrantable.length > 0 ||
    cloudLocations.length > 0 ||
    cloudAvailable.length > 0 ||
    externalLocations.length > 0 ||
    externalAvailable.length > 0 ||
    unusedSystemCatalog.length > 0 ||
    unusedCloudCatalog.length > 0
  const searching = searchQuery.trim().length > 0
  const filteredSourceCards =
    computerLocations.length > 0 ||
    computerAvailable.length > 0 ||
    computerGrantable.length > 0 ||
    cloudLocations.length > 0 ||
    cloudAvailable.length > 0 ||
    externalLocations.length > 0 ||
    externalAvailable.length > 0 ||
    unusedSystemCatalog.length > 0 ||
    unusedCloudCatalog.length > 0
  const showComputerGroup =
    browser ||
    computerLocations.length > 0 ||
    computerAvailable.length > 0 ||
    computerGrantable.length > 0 ||
    (!searching && locations.length > 0)
  const hasCloudSection =
    cloudLocations.length > 0 || cloudAvailable.length > 0 || unusedCloudCatalog.length > 0

  function scrollToCloudIntegrations() {
    document.getElementById('sources-cloud')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
  }, [searchOpen])

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="space-y-14 pb-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.sources}</h1>
          <p className="mt-2 max-w-md text-[15px] text-[var(--app-fg)] opacity-70">
            {sourcesWhatCanSeeCopy(locale)}
          </p>
          <p className="mt-4 text-[14px] text-[var(--app-fg)] opacity-50">
            {locations.length} {locations.length === 1 ? 'source' : 'sources'}
            {documentCount > 0 ? ` · ${formatDocumentCount(documentCount)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {searchOpen ? (
            <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-[var(--overlay-bg)]/35 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-white/10 backdrop-blur-2xl">
              <Search className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2.25} />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch()
                }}
                placeholder="Search sources"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--app-fg)] outline-none placeholder:text-[var(--app-fg)] placeholder:opacity-40"
              />
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="rounded-full p-0.5 text-[var(--app-fg)] opacity-50 transition hover:opacity-100"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </label>
          ) : hasSourceCards ? (
            <HeaderGlassButton label="Search sources" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4 opacity-90" strokeWidth={2.25} />
            </HeaderGlassButton>
          ) : null}
          {hasSourceCards ? (
            <HeaderGlassButton
              label={viewMode === 'grid' ? 'Show list view' : 'Show grid view'}
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? (
                <List className="h-4 w-4 opacity-90" strokeWidth={2.25} />
              ) : (
                <LayoutGrid className="h-4 w-4 opacity-90" strokeWidth={2.25} />
              )}
            </HeaderGlassButton>
          ) : null}
          {isScanning ? (
            <div className="flex items-center gap-3 rounded-full bg-[var(--overlay-row)] px-3 py-1.5 text-xs border border-[var(--sidebar-line)]">
              <span className="font-semibold text-[var(--brand-accent)]">Updating…</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--app-fg)] opacity-20">
                <div
                  className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500 opacity-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] text-[var(--app-fg)] opacity-60">{formatEta(scan.estimatedRemainingSeconds)}</span>
              <button type="button" onClick={onCancelScan} className="ml-1 text-[var(--app-fg)] opacity-50 hover:opacity-100 transition">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className="rounded-2xl border border-amber-200/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          {notice}
        </div>
      ) : null}

      {locations.length === 0 ? (
        unsupported ? (
          <FeaturePromoCard
            title="Sources"
            description={sourcesUnsupportedBody()}
            hint={SOURCES_PRIVACY_LINES[0]}
            primary={
              downloadOffer
                ? {
                    label: productCopy('Download SuHuella'),
                    href: downloadOffer.href,
                    external: downloadOffer.external,
                  }
                : undefined
            }
          >
            {developerSources}
          </FeaturePromoCard>
        ) : (
          <FeaturePromoCard
            title="Sources"
            description={sourcesEmptyBody(desktop)}
            hint={
              desktop
                ? undefined
                : limited
                  ? `${sourcesLimitedSupportCopy()} ${SOURCES_PRIVACY_LINES[0]}`
                  : SOURCES_PRIVACY_LINES[0]
            }
            primary={{
              label: desktop ? 'Add' : browserConnectFolderLabel(locale),
              disabled: connectDisabled,
              onClick: onAdd,
            }}
            secondary={
              browser && hasCloudSection
                ? {
                    label: browserIntegrationsActionLabel(locale),
                    onClick: scrollToCloudIntegrations,
                  }
                : !desktop && downloadOffer
                  ? {
                      label: 'Download SuHuella',
                      href: downloadOffer.href,
                      external: downloadOffer.external,
                    }
                  : undefined
            }
            extra={
              browser && hasCloudSection && downloadOffer
                ? {
                    label: 'Download SuHuella',
                    href: downloadOffer.href,
                    external: downloadOffer.external,
                  }
                : undefined
            }
          >
            {developerSources}
          </FeaturePromoCard>
        )
      ) : null}

      {searching && !filteredSourceCards ? (
        <p className="px-3 text-[15px] text-[var(--app-fg)] opacity-50">No sources match your search.</p>
      ) : null}

      {showComputerGroup ? (
        <SourceGroup
          title={browser ? browserLocalFoldersLabel(locale) : thisComputerLabel(platform ?? 'darwin')}
          layout={viewMode}
        >
          {!searching && !unsupported ? (
            <li>
              <AddSourceCard
                label={addLabel}
                hint={addHint}
                disabled={connectDisabled}
                layout={viewMode}
                onAdd={onAdd}
              />
            </li>
          ) : null}
          {computerLocations.map((location) => (
            <li key={location.path}>{locationCard(location)}</li>
          ))}
          {computerAvailable.map((place) => (
            <li key={place.id}>
              <SourceCard
                path={place.path}
                title={place.label}
                kind={place.kind}
                platform={platform}
                sourceAppearance={settings?.sourceAppearance}
                onAppearanceChange={onSourceAppearanceChange}
                sight="available"
                actionLabel={pickLabel}
                busy={connectDisabled}
                layout={viewMode}
                onAction={() => onAddSuggested(place.path)}
                onOpenSource={onOpenSource ? () => onOpenSource(place.path, place.label) : undefined}
              />
            </li>
          ))}
          {computerGrantable.map((place) => (
            <li key={place.id}>
              <SourceCard
                path={place.path}
                title={place.label}
                kind={place.kind}
                platform={platform}
                sourceAppearance={settings?.sourceAppearance}
                onAppearanceChange={onSourceAppearanceChange}
                sight="not_connected"
                actionLabel={grantLabel}
                busy={connectDisabled}
                layout={viewMode}
                onAction={() => onAddSuggested(place.path)}
                onOpenSource={onOpenSource ? () => onOpenSource(place.path, place.label) : undefined}
              />
            </li>
          ))}
          {browser
            ? unusedSystemCatalog
                .filter((card) => matchesSourceQuery(card.label, searchQuery))
                .map((card) => (
                  <li key={card.id}>
                    <SourceCard
                      path={card.path}
                      title={card.label}
                      kind={card.kind}
                      platform={platform}
                      sourceAppearance={settings?.sourceAppearance}
                      sight="limited"
                      actionLabel={browserChooseSubfolderLabel(locale)}
                      busy={connectDisabled}
                      layout={viewMode}
                      onAction={onAdd}
                    />
                  </li>
                ))
            : null}
        </SourceGroup>
      ) : null}

      {hasCloudSection ? (
        <SourceGroup
          id="sources-cloud"
          title="Cloud"
          hint={browser ? browserCloudComingLaterCopy(locale) : undefined}
          layout={viewMode}
        >
          {cloudLocations.map((location) => (
            <li key={location.path}>{locationCard(location, 'cloud_folder')}</li>
          ))}
          {cloudAvailable.map((place) => (
            <li key={place.id}>
              <SourceCard
                path={place.path}
                title={place.label}
                kind={place.kind}
                platform={platform}
                sourceAppearance={settings?.sourceAppearance}
                onAppearanceChange={onSourceAppearanceChange}
                sight="available"
                actionLabel={pickLabel}
                busy={connectDisabled}
                layout={viewMode}
                onAction={() => onAddSuggested(place.path)}
                onOpenSource={onOpenSource ? () => onOpenSource(place.path, place.label) : undefined}
              />
            </li>
          ))}
          {unusedCloudCatalog
            .filter((card) => matchesSourceQuery(card.label, searchQuery))
            .map((card) => (
              <li key={card.id}>
                <SourceCard
                  path={card.path}
                  title={card.label}
                  kind={card.kind}
                  platform={platform}
                  sourceAppearance={settings?.sourceAppearance}
                  sight="coming_later"
                  layout={viewMode}
                />
              </li>
            ))}
        </SourceGroup>
      ) : null}

      {externalLocations.length > 0 || externalAvailable.length > 0 ? (
        <SourceGroup title="External" layout={viewMode}>
          {externalLocations.map((location) => (
            <li key={location.path}>{locationCard(location, 'volume')}</li>
          ))}
          {externalAvailable.map((place) => (
            <li key={place.id}>
              <SourceCard
                path={place.path}
                title={place.label}
                kind={place.kind}
                platform={platform}
                sourceAppearance={settings?.sourceAppearance}
                onAppearanceChange={onSourceAppearanceChange}
                sight="available"
                actionLabel={pickLabel}
                busy={connectDisabled}
                layout={viewMode}
                onAction={() => onAddSuggested(place.path)}
                onOpenSource={onOpenSource ? () => onOpenSource(place.path, place.label) : undefined}
              />
            </li>
          ))}
        </SourceGroup>
      ) : null}

      {locations.length > 0 ? developerSources : null}
    </div>
  )
}

function SourceGroup({
  id,
  title,
  hint,
  layout,
  children,
}: {
  id?: string
  title: string
  hint?: string
  layout: SourceLayout
  children: ReactNode
}) {
  const items = Children.toArray(children).filter(Boolean)
  if (items.length === 0) return null
  return (
    <section id={id} className={`space-y-4${id ? ' scroll-mt-8' : ''}`}>
      <div className="px-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--app-fg)]">{title}</h2>
        {hint ? <p className="mt-1 max-w-2xl text-[13px] text-[var(--app-fg)] opacity-50">{hint}</p> : null}
      </div>
      <ul
        className={
          layout === 'grid'
            ? 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : 'flex flex-col'
        }
      >
        {items}
      </ul>
    </section>
  )
}
