import { brand } from '@suhuella/brand'
import { ArrowLeft, ArrowRight, Bot, Clock3, HardDrive, Home, PanelLeft, Search } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserDesktopDownloadButton } from '../components/BrowserDesktopDownloadButton'
import { HomePanel } from '../components/HomePanel'
import { AppBrandingProvider } from '../components/AppBrandingContext'
import { IdentityCard } from '../components/IdentityCard'
import {
  SourceAppearanceMenu,
  SourceIconBadge,
  useSourceAppearanceMenu,
} from '../components/SourceIconBadge'
import { ServiceHealthBanner } from '../components/ServiceHealthBanner'
import { capabilitiesFor, capabilitiesOf, folderAccessCopy } from '../host/capabilities'
import { homeOrganiseScope } from '../lib/home-organise'
import { getSuhuellaApi } from '../lib/api'
import {
  sectionFromLocation,
  writeProductLocation,
  type AppSection,
} from '../lib/app-routes'
import { displayComputerName } from '../lib/folders-ui'
import {
  defaultSourceAppearance,
  normalizeSourceKey,
  resolveRecentSourceAppearance,
  type ResolvedSourceAppearance,
} from '../lib/source-appearance'
import { isBrowsePathUnder, normalizeBrowsePath, resolveBrowseRoot } from '../lib/source-browse'
import type { SourceAppearanceOverride, SourceIconId } from '../types'
import { DEV_DEMO_HINT } from '../host/browser/dev-host'
import {
  buildPendingOrganiseContext,
  sourceIdFromBrowsePath,
  writePendingOrganiseContext,
} from '../lib/organise-sources-bridge'
import { isTechnicalSourceId } from '../host/browser/connect-source'
import { hostAccessFor } from '../lib/platform-capabilities'
import { browserCapabilityDialogCopy, type BrowserCapabilityDialogCopy } from '../lib/browser-capability-notice'
import {
  folderConnectErrorMessage,
  isFolderPickAbort,
  presentFolderConnectError,
  sourceDisplayName,
  sourceRemoveFailedCopy,
  sourceRemovedCopy,
} from '../lib/sources-ui'
import { HOST_ACTION_COPY } from '../lib/host-action-copy'
import { sourceOpenBlockedCopy } from '../lib/source-presentation'
import { useAppLocale } from '../lib/app-locale'
import { identityLicenseLine } from '../lib/license-status'
import {
  resolveDesktopDownloadOffer,
  type DesktopDownloadOffer,
} from '../lib/desktop-download-cta'
import { NORMAL_SERVICE_HEALTH, type PublicServiceHealth } from '../lib/service-health'
import type {
  ActivityRun,
  AppInfo,
  AppSettings,
  FoldersKnowledgeSummary,
  IndexedLocationSummary,
  IndexScanProgress,
  DeviceMetrics,
  KnowledgeIndexHealth,
  LicenseStatusView,
  SearchDocumentFilter,
  SearchHit,
  SearchResults,
  SuggestedLocation,
} from '../types'

const ActivityPanel = lazy(() =>
  import('../components/ActivityPanel').then((mod) => ({ default: mod.ActivityPanel })),
)
const SettingsPanel = lazy(() =>
  import('../components/PreferencesPanel').then((mod) => ({ default: mod.SettingsPanel })),
)
const SearchResultsPanel = lazy(() =>
  import('../components/SearchPanel').then((mod) => ({ default: mod.SearchResultsPanel })),
)
const SourceBrowsePanel = lazy(() =>
  import('../components/SourceBrowsePanel').then((mod) => ({ default: mod.SourceBrowsePanel })),
)
const SourcesPanel = lazy(() =>
  import('../components/SourcesPanel').then((mod) => ({ default: mod.SourcesPanel })),
)
const OrganisePanel = lazy(() =>
  import('../components/OrganisePanel').then((mod) => ({ default: mod.OrganisePanel })),
)
const BrowserFolderConnectDialog = lazy(() =>
  import('../components/BrowserFolderConnectDialog').then((mod) => ({
    default: mod.BrowserFolderConnectDialog,
  })),
)
const DeveloperSourcesPanel = lazy(() =>
  import('../components/DeveloperSourcesPanel').then((mod) => ({ default: mod.DeveloperSourcesPanel })),
)

function PanelFallback() {
  return <div className="min-h-[12rem] w-full bg-[var(--app-bg)]" />
}

function detectPlatform(): AppInfo['platform'] {
  if (typeof navigator === 'undefined') return 'darwin'
  if (/Win/.test(navigator.userAgent)) return 'win32'
  if (/Linux/.test(navigator.userAgent)) return 'linux'
  return 'darwin'
}

function browserFolderAccess(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.showDirectoryPicker === 'function') return true
  const input = document.createElement('input')
  input.type = 'file'
  return 'webkitdirectory' in input
}

function initialAppInfo(): AppInfo {
  const platform = detectPlatform()
  const browser = typeof window !== 'undefined' && window.__suhuellaHost === 'browser'
  const folderAccess = browser ? browserFolderAccess() : undefined
  return {
    name: brand.displayName,
    version: '',
    buildVersion: '',
    platform,
    development: false,
    host: browser ? 'browser' : undefined,
    folderAccess,
    capabilities: browser
      ? capabilitiesFor({
          host: 'browser',
          platform,
          folderAccess,
          organise: typeof window.showDirectoryPicker === 'function',
        })
      : undefined,
  }
}

function initialAppSection(): AppSection {
  return sectionFromLocation(window.location)
}

const SIDEBAR_COLLAPSED_KEY = 'suhuella.settings.sidebarCollapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore storage failures
  }
}

const OPENED_SOURCE_KEY = 'suhuella-opened-source'

type OpenedSourceView = { path: string; title: string; browsePath?: string }

function readOpenedSource(): OpenedSourceView | null {
  try {
    const raw = sessionStorage.getItem(OPENED_SOURCE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { path?: unknown; title?: unknown; browsePath?: unknown }
    if (typeof parsed.path === 'string' && typeof parsed.title === 'string') {
      return {
        path: parsed.path,
        title: parsed.title,
        browsePath: typeof parsed.browsePath === 'string' ? parsed.browsePath : undefined,
      }
    }
  } catch {
    // ignore storage failures
  }
  return null
}

function writeOpenedSource(value: OpenedSourceView | null) {
  try {
    if (!value) sessionStorage.removeItem(OPENED_SOURCE_KEY)
    else sessionStorage.setItem(OPENED_SOURCE_KEY, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}

function openedSourceStillPresent(locations: IndexedLocationSummary[], opened: OpenedSourceView): boolean {
  const paths = [opened.path, opened.browsePath].filter((value): value is string => Boolean(value))
  // Cloud OAuth connections live outside the local index location list.
  if (paths.some((path) => path.trim().startsWith('cloud:'))) return true
  return locations.some((location) =>
    paths.some((path) => isBrowsePathUnder(location.path, path)),
  )
}

const SIDEBAR_TOOLBAR_BUTTON =
  'no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--app-fg)] opacity-70 transition hover:bg-[var(--overlay-row)] hover:opacity-100 disabled:pointer-events-none disabled:opacity-25'

/** Matches Electron trafficLightPosition and the sidebar toolbar height. */
const TITLEBAR_HEIGHT = 'h-[52px]'
const MAC_TOOLBAR_PAD = 'pl-[82px]'

function RecentFolderRow({
  folderPath,
  name,
  appearance,
  appearanceOverride,
  platform,
  onAppearanceChange,
  onNavigate,
}: {
  folderPath: string
  name: string
  appearance: ResolvedSourceAppearance
  appearanceOverride?: SourceAppearanceOverride
  platform: AppInfo['platform']
  onAppearanceChange: (
    path: string,
    update: { color?: string | null; iconId?: SourceIconId | null },
  ) => void
  onNavigate: () => void
}) {
  const badgeRef = useRef<HTMLDivElement>(null)
  const appearanceMenu = useSourceAppearanceMenu()
  const canCustomize = appearance.customizable
  const hasAppearanceOverride = Boolean(appearanceOverride?.color || appearanceOverride?.iconId)

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onNavigate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onNavigate()
          }
        }}
        className="group/recent flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 hover:bg-[var(--overlay-row)]"
      >
        <div ref={badgeRef} className="shrink-0">
          <SourceIconBadge
            appearance={appearance}
            size="recent"
            variant="source"
            onPress={
              canCustomize
                ? () => {
                    if (badgeRef.current) appearanceMenu.open(badgeRef.current)
                  }
                : undefined
            }
          />
        </div>
        <span
          className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--app-fg)] opacity-80 group-hover/recent:opacity-100"
          title={folderPath}
        >
          {name}
        </span>
      </div>
      {appearanceMenu.anchorEl && canCustomize ? (
        <SourceAppearanceMenu
          anchorEl={appearanceMenu.anchorEl}
          appearance={appearance}
          hasOverride={hasAppearanceOverride}
          onPickColor={(color) => onAppearanceChange(folderPath, { color })}
          onPickIcon={(iconId) => {
            const identity = defaultSourceAppearance(name, folderPath, undefined, platform)
            onAppearanceChange(folderPath, { iconId: iconId === identity.iconId ? null : iconId })
          }}
          onClose={appearanceMenu.close}
        />
      ) : null}
    </li>
  )
}

export function SettingsWindow() {
  const { locale, t: chrome } = useAppLocale()
  const [section, setSection] = useState<AppSection>(initialAppSection)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [health, setHealth] = useState<KnowledgeIndexHealth | null>(null)
  const [locations, setLocations] = useState<IndexedLocationSummary[]>([])
  const [, setFoldersSummary] = useState<FoldersKnowledgeSummary | null>(null)
  const [scan, setScan] = useState<IndexScanProgress>({
    status: 'idle',
    foldersScanned: 0,
    filesSeen: 0,
    currentPath: '',
    startedAt: null,
    finishedAt: null,
    estimatedRemainingSeconds: null,
  })
  const [appInfo, setAppInfo] = useState<AppInfo>(initialAppInfo)
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<ActivityRun[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [activityUndoRunId, setActivityUndoRunId] = useState<string | null>(null)
  const [activityScope, setActivityScope] = useState<'plans' | 'general'>('general')
  const [license, setLicense] = useState<LicenseStatusView | null>(null)
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<SuggestedLocation[]>([])
  const [deviceMetrics, setDeviceMetrics] = useState<DeviceMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilter, setSearchFilter] = useState<SearchDocumentFilter>('all')
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [focusActivityRunId, setFocusActivityRunId] = useState<string | null>(null)
  const [downloadOffer, setDownloadOffer] = useState<DesktopDownloadOffer | null>(null)
  const [serviceHealth, setServiceHealth] = useState<PublicServiceHealth>(NORMAL_SERVICE_HEALTH)
  const [sourcesNotice, setSourcesNotice] = useState<string | null>(null)
  const [sourcesNoticeKind, setSourcesNoticeKind] = useState<'error' | 'status'>('error')
  const [capabilityNotice, setCapabilityNotice] = useState<BrowserCapabilityDialogCopy | null>(null)
  const [openedSource, setOpenedSourceState] = useState<OpenedSourceView | null>(readOpenedSource)
  const [indexHydrated, setIndexHydrated] = useState(false)

  function setOpenedSource(value: OpenedSourceView | null) {
    setOpenedSourceState(value)
    writeOpenedSource(value)
  }

  useEffect(() => {
    if (!openedSource || !indexHydrated) return
    if (openedSourceStillPresent(locations, openedSource)) return
    setOpenedSource(null)
  }, [locations, openedSource, indexHydrated])

  useEffect(() => {
    document.title = brand.displayName
  }, [])
  const [hostNotice, setHostNotice] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const autoScanStarted = useRef(false)
  const indexWaitGeneration = useRef(0)
  const dismissedSourcePaths = useRef(new Set<string>())
  const navStackRef = useRef<AppSection[]>([initialAppSection()])
  const navIndexRef = useRef(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [navControls, setNavControls] = useState({ canBack: false, canForward: false })
  const searchActive = section === 'search'

  const nextRunNumber = useMemo(
    () => activity.reduce((max, run) => Math.max(max, run.runNumber), 0) + 1,
    [activity],
  )
  function visibleLocations(list: IndexedLocationSummary[] | undefined) {
    return (list ?? []).filter((item) => !dismissedSourcePaths.current.has(item.path))
  }

  function applyIndexSnapshot(status: {
    settings: AppSettings
    scan: IndexScanProgress
    locations?: IndexedLocationSummary[]
    summary?: FoldersKnowledgeSummary | null
  }) {
    setSettings(status.settings)
    setScan(status.scan)
    setLocations(visibleLocations(status.locations))
    setFoldersSummary(status.summary ?? null)
  }

  async function refreshIndexStatus() {
    const api = getSuhuellaApi()
    const status = await api.getIndexStatus()
    applyIndexSnapshot(status)
    setIndexHydrated(true)
    setHealth(await api.getKnowledgeIndexHealth())
    try {
      setSuggested(await api.getSuggestedLocations())
    } catch {
      setSuggested([])
    }
  }

  async function refreshActivity() {
    setActivityLoading(true)
    try {
      setActivity(await getSuhuellaApi().getActivity())
      setActivityError(null)
    } catch {
      setActivityError('Activity could not be read from this computer.')
    } finally {
      setActivityLoading(false)
    }
  }

  async function undoActivity(request: { runId: string; sourcePaths?: string[] }) {
    setUndoBusy(true)
    try {
      const result = await getSuhuellaApi().undoActivity({
        runId: request.runId,
        sourcePaths: request.sourcePaths,
        confirmed: true,
      })
      if (result.ok) {
        setActivity(result.result.runs)
        setActivityError(null)
        return { ok: true as const }
      }
      await refreshActivity()
      return { ok: false as const, message: result.error.message }
    } catch {
      await refreshActivity()
      return { ok: false as const, message: 'This operation cannot be safely undone' }
    } finally {
      setUndoBusy(false)
    }
  }

  function refreshServiceHealth() {
    try {
      const api = getSuhuellaApi()
      if (typeof api.getServiceHealth !== 'function') {
        setServiceHealth(NORMAL_SERVICE_HEALTH)
        return
      }
      void api
        .getServiceHealth()
        .then(setServiceHealth)
        .catch(() => setServiceHealth(NORMAL_SERVICE_HEALTH))
    } catch {
      setServiceHealth(NORMAL_SERVICE_HEALTH)
    }
  }

  useEffect(() => {
    refreshServiceHealth()
    const timer = window.setInterval(refreshServiceHealth, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (appInfo.host !== 'browser') {
      setDownloadOffer(null)
      return
    }
    let cancelled = false
    void resolveDesktopDownloadOffer().then((offer) => {
      if (!cancelled) setDownloadOffer(offer)
    })
    return () => {
      cancelled = true
    }
  }, [appInfo.host])

  useEffect(() => {
    if (appInfo.host === 'browser') return
    if (autoScanStarted.current) return
    if (!settings?.indexedLocations.length) return
    if (scan.status === 'scanning') return
    const pending = locations.some((location) => location.status === 'not_indexed')
    const emptyIndex = !settings.lastIndexed && settings.indexedFileCount === 0
    if (!pending && !emptyIndex) return
    autoScanStarted.current = true
    void getSuhuellaApi()
      .startIndexScan('pending')
      .then(async (next) => {
        setSettings(next)
        await refreshIndexStatus()
      })
      .catch(() => {
        autoScanStarted.current = false
      })
  }, [settings, locations, scan.status, appInfo.host])

  useEffect(() => {
    try {
      const api = getSuhuellaApi()
      void refreshIndexStatus()
      void refreshActivity()
      void api.getAppInfo().then(setAppInfo)
      void api.getDeviceMetrics().then(setDeviceMetrics).catch(() => setDeviceMetrics(null))
      void api
        .getLicense()
        .then(setLicense)
        .catch(() => setLicense(null))
      void api
        .checkLicense()
        .then((result) => {
          if (result.ok) setLicense(result.license)
          else if (result.license) setLicense(result.license)
        })
        .catch(() => undefined)
      return api.onIndexProgress((progress) => {
        setScan(progress)
        void api.getKnowledgeIndexHealth().then(setHealth)
        void api.getIndexStatus().then((status) => {
          applyIndexSnapshot(status)
        })
      })
    } catch {
      return undefined
    }
  }, [])

  function syncNavControls() {
    setNavControls({
      canBack: navIndexRef.current > 0,
      canForward: navIndexRef.current < navStackRef.current.length - 1,
    })
  }

  function recordNavSection(next: AppSection) {
    const stack = navStackRef.current
    const index = navIndexRef.current
    if (stack[index] === next) return
    navStackRef.current = [...stack.slice(0, index + 1), next]
    navIndexRef.current = index + 1
    syncNavControls()
  }

  function alignNavToSection(nextSection: AppSection) {
    const stack = navStackRef.current
    const index = navIndexRef.current
    if (index > 0 && stack[index - 1] === nextSection) {
      navIndexRef.current = index - 1
      syncNavControls()
      return
    }
    if (index < stack.length - 1 && stack[index + 1] === nextSection) {
      navIndexRef.current = index + 1
      syncNavControls()
      return
    }
    if (stack[index] !== nextSection) {
      recordNavSection(nextSection)
    }
  }

  useEffect(() => {
    const syncSection = () => {
      const nextSection = sectionFromLocation(window.location)
      setSection(nextSection)
      alignNavToSection(nextSection)
    }
    window.addEventListener('hashchange', syncSection)
    window.addEventListener('popstate', syncSection)
    return () => {
      window.removeEventListener('hashchange', syncSection)
      window.removeEventListener('popstate', syncSection)
    }
  }, [])

  useEffect(() => {
    if (section === 'activity') {
      void refreshActivity()
    }
  }, [section])

  useEffect(() => {
    if (section === 'search') {
      window.requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [section])

  useEffect(() => {
    if (!searchActive) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    void getSuhuellaApi()
      .searchDocuments({ text: searchQuery, filter: searchFilter })
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results)
          setSearchLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults({ query: searchQuery, filter: searchFilter, hits: [] })
          setSearchLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [searchActive, searchQuery, searchFilter])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      const mod = event.metaKey || event.ctrlKey
      if (event.key === 'Escape') {
        if (searchActive) {
          event.preventDefault()
          if (searchQuery || searchFilter !== 'all') clearSearch()
          else goToSection('home')
        }
        return
      }
      if (!mod) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (key !== 'f' && key !== 'k' && key !== ',') return
      }
      if (key === '1') {
        event.preventDefault()
        goToSection('home')
      } else if (key === '2') {
        event.preventDefault()
        goToSection('organise')
      } else if (key === '3') {
        event.preventDefault()
        goToSection('locations')
      } else if (key === '4') {
        event.preventDefault()
        setActivityScope('general')
        goToSection('activity')
      } else if (key === 'f' || key === 'k') {
        event.preventDefault()
        goToSection('search')
      } else if (key === ',') {
        event.preventDefault()
        openSettings('general')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchActive, searchQuery, searchFilter, sidebarCollapsed])

  async function waitForSourceIndexing() {
    const generation = ++indexWaitGeneration.current
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (generation !== indexWaitGeneration.current) return
      const status = await getSuhuellaApi().getIndexStatus()
      if (generation !== indexWaitGeneration.current) return
      applyIndexSnapshot(status)
      const stillIndexing = status.locations?.some((location) => location.status === 'indexing')
      if (!stillIndexing) return
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }
  }

  async function pickFolder(hint?: string) {
    setSourcesNotice(null)
    setSourcesNoticeKind('error')
    setBusy(true)
    try {
      console.info('[suhuella-connect] click', { hint: hint ?? null })
      const next = await getSuhuellaApi().addIndexedLocation(hint)
      for (const path of next.indexedLocations) dismissedSourcePaths.current.delete(path)
      setSettings({ ...next })
      await refreshIndexStatus()
      void waitForSourceIndexing()
      setCapabilityNotice(null)
    } catch (error) {
      if (isFolderPickAbort(error)) return
      const presentation = presentFolderConnectError(error, appInfo.host ?? 'electron', locale)
      if (presentation.kind === 'desktop_dialog') {
        setCapabilityNotice(presentation.notice)
        return
      }
      if (presentation.kind === 'inline') setSourcesNotice(presentation.message)
      else {
        const message = folderConnectErrorMessage(error)
        if (message) setSourcesNotice(message)
      }
      setCapabilityNotice(null)
    } finally {
      setBusy(false)
    }
  }

  function requestConnectFolder(hint?: string) {
    void pickFolder(hint)
  }

  async function addLocation(hint?: string) {
    requestConnectFolder(hint)
  }

  async function addDroppedFolders(files: File[]) {
    if (files.length === 0 || !caps.filesystem) return
    const current = settings?.indexedLocations ?? []
    const next = [...current]
    for (const file of files) {
      const raw = getSuhuellaApi().droppedFilePath(file)
      if (!raw) continue
      const folderPath = /\.[a-z0-9]{1,8}$/i.test(raw.split(/[/\\]/).pop() ?? '')
        ? raw.replace(/[/\\][^/\\]+$/, '')
        : raw
      if (!folderPath || next.some((item) => item.toLowerCase() === folderPath.toLowerCase())) continue
      next.push(folderPath)
    }
    if (next.length === current.length) return
    setBusy(true)
    try {
      await getSuhuellaApi().setIndexedLocations(next)
      setSettings(await getSuhuellaApi().startIndexScan('pending'))
      await refreshIndexStatus()
      goToSection('locations')
    } finally {
      setBusy(false)
    }
  }

  async function addSuggestedLocation(folderPath: string) {
    if (folderPath.startsWith('suhuella:')) {
      await addLocation(folderPath)
      return
    }
    setSourcesNotice(null)
    setSourcesNoticeKind('error')
    setBusy(true)
    try {
      const current = settings?.indexedLocations ?? []
      if (!current.some((item) => item.toLowerCase() === folderPath.toLowerCase())) {
        await getSuhuellaApi().setIndexedLocations([...current, folderPath])
      }
      await refreshIndexStatus()
      setBusy(false)
      setSettings(await getSuhuellaApi().startIndexScan('pending'))
      await refreshIndexStatus()
    } catch (error) {
      const message = folderConnectErrorMessage(error)
      if (message) setSourcesNotice(message)
    } finally {
      setBusy(false)
    }
  }

  async function removeLocation(location: string) {
    indexWaitGeneration.current += 1
    dismissedSourcePaths.current.add(location)
    const name = sourceDisplayName(
      locations.find((item) => item.path === location)?.name,
      location,
    )
    setLocations((current) => current.filter((item) => item.path !== location))
    if (openedSource?.path === location) setOpenedSource(null)
    setSourcesNotice(null)
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().removeIndexedLocation(location))
      applyIndexSnapshot(await getSuhuellaApi().getIndexStatus())
      setSourcesNoticeKind('status')
      setSourcesNotice(sourceRemovedCopy(name, hostAccessFor(appInfo.host)))
    } catch {
      await refreshIndexStatus()
      setSourcesNoticeKind('error')
      setSourcesNotice(sourceRemoveFailedCopy(name))
    } finally {
      setBusy(false)
    }
  }

  async function rescan() {
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().startIndexScan())
      await refreshIndexStatus()
    } finally {
      setBusy(false)
    }
  }

  async function restoreLocation(path: string) {
    setSourcesNotice(null)
    setSourcesNoticeKind('error')
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().restoreSourceAccess(path))
      await refreshIndexStatus()
    } catch (error) {
      const message = folderConnectErrorMessage(error)
      if (message) setSourcesNotice(message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelScan() {
    await getSuhuellaApi().cancelIndexScan()
    await refreshIndexStatus()
  }

  async function toggleLaunchAtLogin(enabled: boolean) {
    setSettings(await getSuhuellaApi().setLaunchAtLogin(enabled))
  }

  async function updateSourceAppearance(
    path: string,
    update: { color?: string | null; iconId?: SourceIconId | null },
  ) {
    setSettings(await getSuhuellaApi().setSourceAppearance(path, update))
  }

  const caps = capabilitiesOf(appInfo)
  const saveAsActive = caps.saveAs
  const unsupportedCopy = folderAccessCopy(caps)
  const navItems = [
    { id: 'search' as const, label: chrome.search, icon: Search },
    { id: 'home' as const, label: chrome.home, icon: Home },
    { id: 'organise' as const, label: chrome.organise, icon: Bot },
    { id: 'locations' as const, label: chrome.sources, icon: HardDrive },
    { id: 'activity' as const, label: chrome.activity, icon: Clock3 },
  ]
  const recentFolders = settings?.recentFolders ?? []

  function clearSearch() {
    setSearchQuery('')
    setSearchFilter('all')
  }

  function navigateSection(next: AppSection, prefs = 'general') {
    if (next !== 'locations') setOpenedSource(null)
    if (next !== 'search') clearSearch()
    if (next === 'search' && sidebarCollapsed) {
      setSidebarCollapsed(false)
      writeSidebarCollapsed(false)
    }
    setSection(next)
    writeProductLocation(next, prefs)
  }

  function goToSection(next: AppSection, prefs = 'general') {
    recordNavSection(next)
    navigateSection(next, prefs)
  }

  function goBackSection() {
    if (navIndexRef.current <= 0) return
    navIndexRef.current -= 1
    syncNavControls()
    navigateSection(navStackRef.current[navIndexRef.current] ?? 'home')
  }

  function goForwardSection() {
    if (navIndexRef.current >= navStackRef.current.length - 1) return
    navIndexRef.current += 1
    syncNavControls()
    navigateSection(navStackRef.current[navIndexRef.current] ?? 'home')
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current
      writeSidebarCollapsed(next)
      return next
    })
  }

  async function openSearchHit(hit: SearchHit) {
    if (!hit.path) return
    if (hit.sourceAvailable === false) {
      setHostNotice(sourceOpenBlockedCopy(hit.sourceName ?? hit.subtitle))
      return
    }
    try {
      const result = await getSuhuellaApi().openSearchPath(hit.path)
      if (result.ok) {
        setHostNotice(null)
        return
      }
      setHostNotice(result.error ?? HOST_ACTION_COPY.openFileDesktopOnly)
    } catch {
      setHostNotice(HOST_ACTION_COPY.openFileDesktopOnly)
    }
  }

  async function revealSearchHit(hit: SearchHit) {
    if (!hit.path) return
    try {
      const result = await getSuhuellaApi().revealSearchPath(hit.path)
      if (result.ok) {
        setHostNotice(null)
        return
      }
      setHostNotice(result.error ?? HOST_ACTION_COPY.revealUnavailable)
    } catch {
      setHostNotice(HOST_ACTION_COPY.revealUnavailable)
    }
  }

  function showRecommendation(hit: SearchHit) {
    if (!hit.activityRunId) return
    setFocusActivityRunId(hit.activityRunId)
    setActivityScope('plans')
    goToSection('activity')
  }

  function showWorkflow(hit: SearchHit) {
    if (!hit.workflowId) return
    setPendingWorkflowId(hit.workflowId)
    goToSection('organise')
  }

  function showActivity(hit: SearchHit) {
    setFocusActivityRunId(hit.activityRunId ?? null)
    goToSection('activity')
  }

  function folderLabel(folderPath: string): string {
    const location =
      locations.find((item) => item.path === folderPath) ??
      locations.find((item) => isBrowsePathUnder(item.path, folderPath))
    return sourceDisplayName(location?.name, folderPath, isTechnicalSourceId)
  }

  function openFolderBrowse(folderPath: string, title?: string) {
    if (folderPath.trim().startsWith('cloud:')) {
      const rest = folderPath.trim().slice('cloud:'.length)
      const slash = rest.indexOf('/')
      const connectionId = slash === -1 ? rest : rest.slice(0, slash)
      const root = `cloud:${connectionId}`
      setOpenedSource({
        path: root,
        title: title ?? 'Google Drive',
        browsePath: slash === -1 ? undefined : folderPath.trim(),
      })
      goToSection('locations')
      return
    }
    const browseRoot = resolveBrowseRoot(folderPath, locations)
    const browsePath = normalizeBrowsePath(folderPath)
    const normalizedRoot = normalizeBrowsePath(browseRoot)
    setOpenedSource({
      path: normalizedRoot,
      title: title ?? folderLabel(normalizedRoot),
      browsePath: browsePath !== normalizedRoot ? browsePath : undefined,
    })
    goToSection('locations')
  }

  function startOrganiseFromSourceBrowse(context: Parameters<typeof writePendingOrganiseContext>[0]) {
    writePendingOrganiseContext(context)
    setOpenedSource(null)
    goToSection('organise')
  }

  function startOrganiseFromHome() {
    const scope = homeOrganiseScope(locations)
    if (scope) {
      writePendingOrganiseContext(
        buildPendingOrganiseContext({
          sourceId: sourceIdFromBrowsePath(scope.path),
          sourceTitle: scope.name,
          folderScope: scope.path,
          fileIds: [],
          fileNames: [],
        }),
      )
    }
    goToSection('organise')
  }

  const deviceName = displayComputerName({
    osName: appInfo.computerName ?? deviceMetrics?.deviceName,
    licenseName: license?.computerName,
    platform: appInfo.platform,
  })
  const licenseLine = !license
    ? chrome.freeActivate
    : license.needsAttention
      ? chrome.licenseNeedsAttention
      : license.kind === 'free'
        ? chrome.freeActivate
        : identityLicenseLine(license)
  const isFree = !license || license.kind === 'free'

  function openSettings(prefs: 'general' | 'license' = 'general') {
    goToSection('settings', prefs)
  }

  function refreshDeviceMetrics() {
    setMetricsLoading(true)
    void getSuhuellaApi()
      .getDeviceMetrics()
      .then(setDeviceMetrics)
      .catch(() => setDeviceMetrics(null))
      .finally(() => setMetricsLoading(false))
  }

  const isBrowser = appInfo.host === 'browser'
  const isMacDesktop = appInfo.platform === 'darwin' && !isBrowser

  return (
    <AppBrandingProvider organisationLogo={license?.organisationLogo}>
    <div
      className={`flex h-full min-h-0 w-full flex-1 overflow-hidden text-[var(--app-fg)] selection:bg-blue-200/40 ${
        isMacDesktop ? 'native-vibrancy bg-transparent' : 'bg-[var(--chrome-bg)]'
      } ${isBrowser ? 'rounded-[var(--window-radius)]' : ''}`}
    >
      <aside
        className={`app-sidebar relative z-10 flex h-full min-h-0 shrink-0 flex-col overflow-visible bg-transparent pb-3 pt-[52px] transition-[width,padding] duration-200 ${
          sidebarCollapsed ? 'w-[52px] px-1' : 'w-[220px] px-2'
        }`}
      >
        <div
          className={`drag-region absolute top-0 flex ${TITLEBAR_HEIGHT} items-center gap-2 ${
            sidebarCollapsed
              ? isMacDesktop
                ? 'inset-x-0 justify-end pr-1.5'
                : 'inset-x-0 justify-center'
              : isMacDesktop
                ? `inset-x-0 ${MAC_TOOLBAR_PAD} pr-2`
                : 'inset-x-0 px-2'
          }`}
        >
          {sidebarCollapsed && isMacDesktop ? null : (
          <button
            type="button"
            className={SIDEBAR_TOOLBAR_BUTTON}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={sidebarCollapsed}
            onClick={toggleSidebarCollapsed}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          )}
          {!sidebarCollapsed ? (
            <>
              <button
                type="button"
                className={SIDEBAR_TOOLBAR_BUTTON}
                aria-label="Previous section"
                disabled={!navControls.canBack}
                onClick={goBackSection}
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={SIDEBAR_TOOLBAR_BUTTON}
                aria-label="Next section"
                disabled={!navControls.canForward}
                onClick={goForwardSection}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          ) : null}
        </div>
        <nav className={`no-drag flex flex-col ${sidebarCollapsed ? 'gap-1' : 'gap-0.5'}`}>
          {sidebarCollapsed && isMacDesktop ? (
            <button
              type="button"
              className={`${SIDEBAR_TOOLBAR_BUTTON} mx-auto`}
              aria-label="Expand sidebar"
              aria-pressed={true}
              onClick={toggleSidebarCollapsed}
            >
              <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
          {navItems.map((item) => {
            const Icon = item.icon
            const active = section === item.id && !(item.id === 'locations' && openedSource)
            if (item.id === 'search' && searchActive && !sidebarCollapsed) {
              return (
                <label
                  key={item.id}
                  className="flex w-full items-center gap-2.5 rounded-lg bg-[var(--overlay-row)] px-3 py-1.5 text-[13px] font-medium text-[var(--app-fg)] ring-1 ring-[var(--sidebar-line)]"
                >
                  <Search className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2.5} />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[var(--app-fg)] outline-none placeholder:text-[var(--overlay-muted)]"
                  />
                </label>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                title={sidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                onClick={() => {
                  if (item.id === 'locations' && openedSource) {
                    setOpenedSource(null)
                    return
                  }
                  if (item.id === 'activity') {
                    setActivityScope('general')
                  }
                  goToSection(item.id)
                }}
                className={`group flex w-full items-center rounded-[8px] font-medium transition-colors ${
                  sidebarCollapsed
                    ? 'justify-center p-2.5'
                    : 'gap-2.5 px-3 py-1.5 text-[13px]'
                } ${
                  active
                    ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)]'
                    : 'text-[var(--app-fg)] opacity-80 hover:bg-[var(--overlay-row)] hover:opacity-100'
                }`}
              >
                <Icon
                  className={`${sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4'} ${
                    active ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {!sidebarCollapsed ? item.label : null}
              </button>
            )
          })}
        </nav>

        {!sidebarCollapsed ? (
          <div className="no-drag min-h-0 flex-1 overflow-y-auto px-1 pt-8">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--app-fg)] opacity-60">
              Recents
            </p>
            {recentFolders.length === 0 ? (
              <p className="px-3 text-[12px] text-[var(--app-fg)] opacity-50">No recent folders</p>
            ) : (
              <ul className="space-y-0.5">
                {recentFolders.map((folderPath) => (
                  <RecentFolderRow
                    key={folderPath}
                    folderPath={folderPath}
                    name={folderLabel(folderPath)}
                    appearance={resolveRecentSourceAppearance(folderPath, {
                      suggested,
                      indexed: locations.map((location) => ({
                        path: location.path,
                        label: location.name,
                      })),
                      overrides: settings?.sourceAppearance,
                      platform: appInfo.platform,
                    })}
                    appearanceOverride={settings?.sourceAppearance?.[normalizeSourceKey(folderPath)]}
                    platform={appInfo.platform}
                    onAppearanceChange={updateSourceAppearance}
                    onNavigate={() => openFolderBrowse(folderPath, folderLabel(folderPath))}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div
          className={`no-drag mt-auto flex w-full shrink-0 flex-col ${
            sidebarCollapsed ? 'gap-1.5 pt-2' : 'gap-1 pt-3'
          }`}
        >
          {isBrowser ? (
            <BrowserDesktopDownloadButton offer={downloadOffer} collapsed={sidebarCollapsed} />
          ) : null}
          <IdentityCard
            deviceName={deviceName}
            licenseLine={licenseLine}
            needsAttention={Boolean(license?.needsAttention)}
            free={isFree}
            compact={sidebarCollapsed}
            onActivateLicense={() => openSettings('general')}
          />
        </div>
      </aside>

      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[var(--app-bg)] shadow-[0_0_0_1px_var(--content-edge)]">
        <main
          className={`no-drag flex min-h-0 w-full flex-1 flex-col px-10 pt-10 pb-12 transition-all ${
            openedSource ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
          onDragOver={(event) => {
            if (section !== 'locations') return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(event) => {
            if (section !== 'locations') return
            event.preventDefault()
            const files = Array.from(event.dataTransfer.files)
            void addDroppedFolders(files)
          }}
        >
      <ServiceHealthBanner
        health={serviceHealth}
        host={appInfo.host === 'browser' ? 'browser' : 'electron'}
        downloadOffer={downloadOffer}
        onRetry={refreshServiceHealth}
      />
      {unsupportedCopy && section === 'locations' ? (
        <div className="mb-6 rounded-2xl border border-amber-200/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          <p className="font-semibold">{unsupportedCopy.title}</p>
          <p className="mt-1 opacity-80">{unsupportedCopy.body}</p>
          <p className="mt-1 opacity-80">{unsupportedCopy.detail}</p>
        </div>
      ) : null}
      {hostNotice ? (
        <div className="mb-6 rounded-2xl border border-amber-200/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          <p>{hostNotice}</p>
        </div>
      ) : null}
          {searchActive ? (
            <div className="page-enter">
            <Suspense fallback={<PanelFallback />}>
            <SearchResultsPanel
              query={searchQuery}
              results={searchResults}
              loading={searchLoading}
              filter={searchFilter}
              platform={appInfo.platform}
              host={appInfo.host}
              nativeReveal={caps.reveal}
              sourceCount={locations.length}
              indexedDocumentCount={settings?.indexedFileCount ?? health?.fileCount ?? 0}
              onFilterChange={setSearchFilter}
              onOpen={(hit) => void openSearchHit(hit)}
              onReveal={(hit) => void revealSearchHit(hit)}
              onShowRecommendation={showRecommendation}
              onShowWorkflow={showWorkflow}
              onShowActivity={showActivity}
            />
            </Suspense>
            </div>
          ) : null}
          {!searchActive && section === 'home' && (
            <div className="page-enter">
            <HomePanel
              appInfo={appInfo}
              scan={scan}
              locations={locations}
              fileCount={settings?.indexedFileCount ?? health?.fileCount ?? 0}
              onAddSource={locations.length === 0 ? () => requestConnectFolder() : undefined}
              onConnectSourceHint={
                locations.length === 0 ? (hint) => requestConnectFolder(hint) : undefined
              }
              onOrganise={locations.length > 0 ? startOrganiseFromHome : undefined}
              firstHomeHint={Boolean(settings && !settings.welcomeNotificationShown && locations.length > 0)}
              onDismissFirstHomeHint={() => {
                void getSuhuellaApi()
                  .dismissWelcomeHint()
                  .then((next) => setSettings(next))
              }}
            />
            </div>
          )}

          {!searchActive && section === 'organise' && (
            <div className="page-enter">
            <Suspense fallback={<PanelFallback />}>
            <OrganisePanel
              host={appInfo.host ?? 'electron'}
              canOrganise={caps.organise}
              folderAccess={caps.filesystem}
              locations={locations}
              onConnectFolder={() => requestConnectFolder()}
              onOpenSources={() => goToSection('locations')}
              onCompleted={() => {
                void refreshActivity()
              }}
              nextRunNumber={nextRunNumber}
              initialWorkflowId={pendingWorkflowId}
              onInitialWorkflowConsumed={() => setPendingWorkflowId(null)}
              onOpenActivity={() => {
                setActivityScope('plans')
                goToSection('activity')
              }}
              onOpenSettings={() => goToSection('settings', 'ai')}
              onViewActivity={(runId) => {
                setFocusActivityRunId(runId)
                setActivityScope('plans')
                goToSection('activity')
              }}
              onUndo={undoActivity}
              downloadOffer={appInfo.host === 'browser' ? downloadOffer : null}
            />
            </Suspense>
            </div>
          )}

          {!searchActive && section === 'locations' && openedSource ? (
            <div className="page-enter flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<PanelFallback />}>
              <SourceBrowsePanel
                key={openedSource.path}
                rootPath={openedSource.path}
                title={openedSource.title || folderLabel(openedSource.path)}
                initialPath={openedSource.browsePath}
                onClose={() => setOpenedSource(null)}
                onOpenFile={(path) => void openSearchHit({ path } as SearchHit)}
                onOrganise={openedSource.path.startsWith('cloud:') ? undefined : startOrganiseFromSourceBrowse}
                onBrowsePathChange={(browsePath) => {
                  if (openedSource.browsePath === browsePath) return
                  setOpenedSource({ ...openedSource, browsePath })
                }}
              />
              </Suspense>
            </div>
          ) : null}

          {!searchActive && section === 'locations' && !openedSource && (
            <div className="page-enter space-y-6">
            <Suspense fallback={<PanelFallback />}>
            <SourcesPanel
              settings={settings}
              scan={scan}
              locations={locations}
              suggested={suggested}
              platform={appInfo.platform}
              host={appInfo.host}
              capabilities={caps}
              busy={busy}
              notice={sourcesNotice}
              noticeKind={sourcesNoticeKind}
              downloadOffer={appInfo.host === 'browser' ? downloadOffer : null}
              developerSources={
                <DeveloperSourcesPanel
                  embedded
                  locations={locations}
                  busy={busy}
                  onLoadDemo={() => void pickFolder(DEV_DEMO_HINT)}
                  onReconnect={(path) => void restoreLocation(path)}
                />
              }
              onAdd={() => requestConnectFolder()}
              onAddSuggested={(path) => void addSuggestedLocation(path)}
              onRemove={(path) => void removeLocation(path)}
              onRescan={() => void rescan()}
              onRestore={(path) => void restoreLocation(path)}
              onCancelScan={() => void cancelScan()}
              onSourceAppearanceChange={(path, update) => void updateSourceAppearance(path, update)}
              onOpenSource={(path, title) => openFolderBrowse(path, title)}
              onLimitedSystemFolder={
                appInfo.host === 'browser'
                  ? () => setCapabilityNotice(browserCapabilityDialogCopy('protected_folder', locale))
                  : undefined
              }
            />
            </Suspense>
            </div>
          )}

          {!searchActive && section === 'settings' && (
            <div className="page-enter">
            <Suspense fallback={<PanelFallback />}>
            <SettingsPanel
              appInfo={appInfo}
              settings={settings}
              onSettingsChange={setSettings}
              saveAsActive={saveAsActive}
              metrics={deviceMetrics}
              metricsLoading={metricsLoading}
              onLaunchAtLoginChange={(enabled) => void toggleLaunchAtLogin(enabled)}
              onRebuildFolders={() => {
                void rescan()
              }}
              onActivityCleared={() => {
                void refreshActivity()
                void refreshIndexStatus()
              }}
              onRefreshMetrics={refreshDeviceMetrics}
            />
            </Suspense>
            </div>
          )}

          {!searchActive && section === 'activity' && (
            <div className="page-enter">
            <Suspense fallback={<PanelFallback />}>
            <ActivityPanel
              runs={activity}
              scope={activityScope}
              loading={activityLoading}
              error={activityError}
              busy={undoBusy}
              initialUndoRunId={activityScope === 'plans' ? activityUndoRunId : null}
              onInitialUndoConsumed={() => setActivityUndoRunId(null)}
              focusRunId={focusActivityRunId}
              onFocusConsumed={() => setFocusActivityRunId(null)}
              onOrganise={() => goToSection('organise')}
              onBack={activityScope === 'plans' ? () => goToSection('organise') : undefined}
              onRetry={() => {
                void refreshActivity()
              }}
              onUndo={undoActivity}
            />
            </Suspense>
            </div>
          )}

        </main>
        </div>
      </div>
      {appInfo.host === 'browser' && capabilityNotice ? (
        <Suspense fallback={null}>
        <BrowserFolderConnectDialog
          busy={busy}
          downloadOffer={downloadOffer}
          notice={capabilityNotice}
          onPick={() => void pickFolder()}
          onClose={() => {
            if (!busy) setCapabilityNotice(null)
          }}
        />
        </Suspense>
      ) : null}
    </div>
    </AppBrandingProvider>
  )
}
