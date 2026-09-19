import { brand } from '@suhuella/brand'
import { ArrowLeft, ArrowRight, Clock3, FolderKanban, HardDrive, Home, PanelLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityPanel } from '../components/ActivityPanel'
import { BrowserDesktopDownloadButton } from '../components/BrowserDesktopDownloadButton'
import { HomePanel } from '../components/HomePanel'
import { AppBrandingProvider } from '../components/AppBrandingContext'
import { IdentityCard } from '../components/IdentityCard'
import { SuhuellaWordmark } from '../components/SuhuellaWordmark'
import {
  SourceAppearanceMenu,
  SourceIconBadge,
  useSourceAppearanceMenu,
} from '../components/SourceIconBadge'
import { SettingsPanel } from '../components/PreferencesPanel'
import { SearchResultsPanel } from '../components/SearchPanel'
import { SourceBrowsePanel } from '../components/SourceBrowsePanel'
import { SourcesPanel } from '../components/SourcesPanel'
import { OrganisePanel } from '../components/OrganisePanel'
import { ServiceHealthBanner } from '../components/ServiceHealthBanner'
import { capabilitiesFor, capabilitiesOf, folderAccessCopy } from '../host/capabilities'
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
import { BrowserFolderConnectDialog } from '../components/BrowserFolderConnectDialog'
import { DeveloperSourcesPanel } from '../components/DeveloperSourcesPanel'
import { DEV_DEMO_HINT } from '../host/browser/dev-host'
import { isTechnicalSourceId } from '../host/browser/connect-source'
import {
  folderConnectErrorMessage,
  isFolderPickAbort,
  isProtectedFolderConnectError,
  sourceDisplayName,
} from '../lib/sources-ui'
import { HOST_ACTION_COPY } from '../lib/host-action-copy'
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
  return locations.some((location) =>
    paths.some((path) => isBrowsePathUnder(location.path, path)),
  )
}

const SIDEBAR_TOOLBAR_BUTTON =
  'no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--app-fg)] opacity-50 transition hover:bg-[var(--overlay-row)] hover:opacity-100 disabled:pointer-events-none disabled:opacity-20'

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
  const { t: chrome } = useAppLocale()
  const [section, setSection] = useState<AppSection>(initialAppSection)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [health, setHealth] = useState<KnowledgeIndexHealth | null>(null)
  const [locations, setLocations] = useState<IndexedLocationSummary[]>([])
  const [foldersSummary, setFoldersSummary] = useState<FoldersKnowledgeSummary | null>(null)
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
  const [blockedFolderDialogOpen, setBlockedFolderDialogOpen] = useState(false)
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
    setSourcesNotice(null)
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
      .startIndexScan()
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
    setBusy(true)
    try {
      console.info('[suhuella-connect] click', { hint: hint ?? null })
      const next = await getSuhuellaApi().addIndexedLocation(hint)
      for (const path of next.indexedLocations) dismissedSourcePaths.current.delete(path)
      setSettings({ ...next })
      await refreshIndexStatus()
      void waitForSourceIndexing()
      setBlockedFolderDialogOpen(false)
    } catch (error) {
      if (isProtectedFolderConnectError(error) || isFolderPickAbort(error)) {
        setBlockedFolderDialogOpen(true)
        return
      }
      const message = folderConnectErrorMessage(error)
      if (message) setSourcesNotice(message)
      setBlockedFolderDialogOpen(false)
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
      setSettings(await getSuhuellaApi().startIndexScan())
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
    setBusy(true)
    try {
      const current = settings?.indexedLocations ?? []
      if (!current.some((item) => item.toLowerCase() === folderPath.toLowerCase())) {
        await getSuhuellaApi().setIndexedLocations([...current, folderPath])
      }
      await refreshIndexStatus()
      setBusy(false)
      setSettings(await getSuhuellaApi().startIndexScan())
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
    setLocations((current) => current.filter((item) => item.path !== location))
    if (openedSource?.path === location) setOpenedSource(null)
    try {
      setSettings(await getSuhuellaApi().removeIndexedLocation(location))
      applyIndexSnapshot(await getSuhuellaApi().getIndexStatus())
    } catch {
      await refreshIndexStatus()
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

  const folderCount = health?.folderCount ?? settings?.indexedFolderCount ?? 0
  const caps = capabilitiesOf(appInfo)
  const saveAsActive = caps.saveAs
  const unsupportedCopy = folderAccessCopy(caps)
  const homeLicense = useMemo(() => {
    if (!license) return null
    const learningOk = folderCount > 0
    return {
      ...license,
      health: license.health.map((item) => {
        if (item.id === 'learning') {
          return { ...item, status: learningOk ? ('ok' as const) : ('attention' as const) }
        }
        if (item.id === 'save_as') {
          return { ...item, status: saveAsActive ? ('ok' as const) : ('unknown' as const) }
        }
        return item
      }),
    }
  }, [license, folderCount, saveAsActive])
  const navItems = [
    { id: 'search' as const, label: chrome.search, icon: Search },
    { id: 'home' as const, label: chrome.home, icon: Home },
    { id: 'organise' as const, label: chrome.organise, icon: FolderKanban },
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
    const location = locations.find((item) => item.path === folderPath)
    return sourceDisplayName(location?.name, folderPath, isTechnicalSourceId)
  }

  function recentFolderLabel(folderPath: string): string {
    return sourceDisplayName(undefined, folderPath, isTechnicalSourceId)
  }

  function openFolderBrowse(folderPath: string, title?: string) {
    const browseRoot = resolveBrowseRoot(folderPath, locations)
    const browsePath = normalizeBrowsePath(folderPath)
    const normalizedRoot = normalizeBrowsePath(browseRoot)
    setOpenedSource({
      path: normalizedRoot,
      title: title ?? folderLabel(folderPath),
      browsePath: browsePath !== normalizedRoot ? browsePath : undefined,
    })
    goToSection('locations')
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
      className={`flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)] selection:bg-blue-200/40 ${
        isBrowser ? 'rounded-[var(--window-radius)]' : ''
      }`}
    >
      <aside
        className={`relative z-10 flex h-full min-h-0 shrink-0 flex-col overflow-visible bg-[var(--sidebar-bg)] pb-3 pt-12 transition-[width,padding] duration-200 ${
          sidebarCollapsed ? 'w-[52px] px-1' : 'w-[220px] px-2'
        } ${isBrowser ? 'rounded-l-[var(--window-radius)]' : ''}`}
      >
        <div
          className={`drag-region absolute top-0 flex h-11 items-center gap-0.5 ${
            sidebarCollapsed
              ? 'inset-x-0 justify-center'
              : isMacDesktop
                ? 'inset-x-0 pl-[72px] pr-1.5'
                : 'inset-x-0 px-2'
          }`}
        >
          <button
            type="button"
            className={SIDEBAR_TOOLBAR_BUTTON}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={sidebarCollapsed}
            onClick={toggleSidebarCollapsed}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
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
        <div
          className={`no-drag ${
            sidebarCollapsed ? 'flex justify-center pb-2' : 'px-2 pb-3'
          }`}
        >
          {sidebarCollapsed ? (
            <SuhuellaWordmark variant="compact" glyphSize={24} />
          ) : (
            <SuhuellaWordmark
              glyphSize={24}
              textClassName="text-[15px] font-semibold tracking-[-0.02em] text-[var(--app-fg)]"
            />
          )}
        </div>
        <nav className={`no-drag flex flex-col ${sidebarCollapsed ? 'gap-1' : 'gap-0.5'}`}>
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
                    name={recentFolderLabel(folderPath)}
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
                    onNavigate={() => openFolderBrowse(folderPath, recentFolderLabel(folderPath))}
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

      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg)]">
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
            <SearchResultsPanel
              query={searchQuery}
              results={searchResults}
              loading={searchLoading}
              filter={searchFilter}
              platform={appInfo.platform}
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
            </div>
          ) : null}
          {!searchActive && section === 'home' && (
            <div className="page-enter">
            <HomePanel
              appInfo={appInfo}
              scan={scan}
              locations={locations}
              foldersSummary={foldersSummary}
              fileCount={settings?.indexedFileCount ?? health?.fileCount ?? 0}
              onAddSource={locations.length === 0 ? () => goToSection('locations') : undefined}
            />
            </div>
          )}

          {!searchActive && section === 'organise' && (
            <div className="page-enter">
            <OrganisePanel
              host={appInfo.host ?? 'electron'}
              canOrganise={caps.organise}
              folderAccess={caps.filesystem}
              locations={locations}
              onConnectFolder={() => requestConnectFolder()}
              onCompleted={() => {
                void refreshActivity()
              }}
              nextRunNumber={nextRunNumber}
              initialWorkflowId={pendingWorkflowId}
              onInitialWorkflowConsumed={() => setPendingWorkflowId(null)}
              onViewActivity={(runId) => {
                setFocusActivityRunId(runId)
                goToSection('activity')
              }}
              onUndo={undoActivity}
            />
            </div>
          )}

          {!searchActive && section === 'locations' && openedSource ? (
            <div className="page-enter flex min-h-0 flex-1 flex-col">
              <SourceBrowsePanel
                key={openedSource.path}
                rootPath={openedSource.path}
                title={openedSource.title}
                initialPath={openedSource.browsePath}
                onClose={() => setOpenedSource(null)}
                onOpenFile={(path) => void openSearchHit({ path } as SearchHit)}
                onBrowsePathChange={(browsePath) => {
                  if (openedSource.browsePath === browsePath) return
                  setOpenedSource({ ...openedSource, browsePath })
                }}
              />
            </div>
          ) : null}

          {!searchActive && section === 'locations' && !openedSource && (
            <div className="page-enter space-y-6">
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
            />
            </div>
          )}

          {!searchActive && section === 'settings' && (
            <div className="page-enter">
            <SettingsPanel
              appInfo={appInfo}
              settings={settings}
              saveAsActive={saveAsActive}
              license={homeLicense}
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
            </div>
          )}

          {!searchActive && section === 'activity' && (
            <div className="page-enter">
            <ActivityPanel
              runs={activity}
              loading={activityLoading}
              error={activityError}
              busy={undoBusy}
              initialUndoRunId={activityUndoRunId}
              onInitialUndoConsumed={() => setActivityUndoRunId(null)}
              focusRunId={focusActivityRunId}
              onFocusConsumed={() => setFocusActivityRunId(null)}
              onOrganise={() => goToSection('organise')}
              onRetry={() => {
                void refreshActivity()
              }}
              onUndo={undoActivity}
            />
            </div>
          )}

        </main>
      </div>
      {blockedFolderDialogOpen ? (
        <BrowserFolderConnectDialog
          busy={busy}
          downloadOffer={downloadOffer}
          onPick={() => void pickFolder()}
          onClose={() => {
            if (!busy) setBlockedFolderDialogOpen(false)
          }}
        />
      ) : null}
    </div>
    </AppBrandingProvider>
  )
}
