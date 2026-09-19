import { statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  Tray,
} from 'electron'
import { brand } from '@suhuella/brand'
import { isCustomizableIconId } from '../src/lib/source-appearance.ts'
import {
  cancelIndexScan,
  getIndexedFolders,
  getFoldersKnowledgeSummary,
  browseSource,
  getIndexBrowse,
  getIndexedLocationSummaries,
  getKnowledgeIndexHealth,
  getScanProgress,
  onScanProgress,
  getSuggestedLocations,
  startIndexScan,
} from './index-service.ts'
import { assertCanExecute, assertCapabilityKernelFrozen, intentAllowsCapability } from './capabilities.ts'
import { organisationActivityTrigger, persistOrganisationActivity } from './activity.ts'
import { workflowIntentSummary } from '../src/lib/workflow-copy.ts'
import { pathForSection, type AppSection } from '../src/lib/app-routes.ts'
import { loadActivityRuns, nextActivityRunNumber } from './activity-store.ts'
import { loadIndex } from './index-store.ts'
import { normalizeSearchQuery, searchKnowledge } from './search.ts'
import {
  clearManagedActivity,
  clearManagedCache,
  clearManagedLogs,
  exportActivityJson,
  getStorageUsage,
  runAutomaticCleanup,
} from './storage-manager.ts'
import { getDocumentStorageSummary, getStorageOverview } from './document-storage.ts'
import {
  getDesktopDeviceMetrics,
  recordRecommendationDuration,
  recordStartupDuration,
} from './device-metrics.ts'
import { getOsComputerName, getOsVersionLabel } from './device-identity.ts'
import { storageLayout } from './storage-paths.ts'
import { executeUndo, listActivityWithUndoState } from './undo.ts'
import {
  executeOrganisationPlan,
  pathsToKnowledgeSetItems,
  previewOrganisationPlanForFolders,
} from './knowledge-set.ts'
import { getPlanAssistantStatus, runPlanAssistant } from './plan-assistant-router.ts'
import { executeAutopilotWorkflow } from './autopilot.ts'
import {
  approveWorkflowPlan,
  deleteWorkflow,
  duplicateWorkflow,
  getWorkflow,
  listWorkflows,
  loadWorkflowForManualRun,
  markWorkflowRan,
  saveWorkflow,
  setWorkflowAutopilot,
  updateWorkflow,
} from './workflow-store.ts'
import { describeKnowledgeItem } from './descriptors.ts'
import { enrichKnowledgeDescriptor } from './local-intelligence.ts'
import { assertIntentKernelFrozen, resolveIntent } from './intents.ts'
import { buildFileProfileFromDescriptor, fileUnderstandingLabels, recommendFolders } from './recommendations.ts'
import { getBuildVersion } from './build-info.ts'
import {
  activateFromCheckout,
  activateLicense,
  createCheckoutAttempt,
  requestLicenseEmailCode,
  verifyLicenseEmailCode,
  updateBusinessBranding,
  checkLicense,
  getServiceHealth,
  deactivateLicense,
  deactivateRemoteDevice,
  getLicenseView,
  openCheckout,
  openExternalUrl,
  renameThisDevice,
  silentLicenseRefresh,
} from './license-client.ts'
import { checkDesktopRelease } from './release-check.ts'
import {
  buildCompatibilityExport,
  getCompatibilityDiagnostics,
  recordDetectionAttempt,
  recordNavigationAttempt,
} from './compatibility-diagnostics.ts'
import {
  formatSourceApp,
  isDevelopmentMode,
  logDev,
  startSaveDialogWatcher,
  type SaveDialogClosedEvent,
  type SaveDialogIgnoredEvent,
  type SaveDialogOpenedEvent,
  type SaveDialogWatcherHandle,
} from './save-dialog-watcher.ts'
import { assistWithByok } from './byok-client.ts'
import { clearByokConversation, listByokConversation } from './byok-conversation.ts'
import { connectByok, disconnectByok, getByokStatus } from './byok-store.ts'
import {
  addIndexedLocation,
  getSettingsFilePath,
  loadSettings,
  markFirstRunCompleted,
  recordRecentFolder,
  removeIndexedLocation,
  setIndexedLocations,
  setLaunchAtLogin,
  setSourceAppearance,
  setSourceAppearanceColor,
  type SourceAppearanceUpdate,
  shouldShowOnboarding,
} from './settings-store.ts'
import {
  appendBrowsedDestination,
  composeSaveAsOverlay,
  isSystemSavePath,
  markDestinationIncluded,
  refreshDestinationInclusion,
} from './save-as-overlay.ts'
import type {
  FileProfile,
  IncludeSourceResult,
  IndexScanProgress,
  NavigateFolderResult,
  OpenFolderResult,
  SuggestionPayload,
} from '../src/types.ts'

const SETTINGS_MIN_WIDTH = 760
const SETTINGS_MIN_HEIGHT = 560
const ONBOARDING_WIDTH = 520
const ONBOARDING_HEIGHT = 680
const SUGGESTION_WIDTH = 480
const SUGGESTION_HEIGHT = 620
const PREVIEW_SHORTCUT = 'CommandOrControl+Alt+S'

type RendererRoute = '/suggestion' | '/onboarding' | `/${string}`

let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let suggestionWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let currentSuggestion: SuggestionPayload | null = null
let restoreAfterSuggestion: 'settings' | 'onboarding' | null = null
let saveDialogWatcher: SaveDialogWatcherHandle | null = null
let ignoreSuggestionBlurUntil = 0
let navigationInFlight = false

function rendererUrl(route: RendererRoute, query?: Record<string, string>): string {
  const search =
    query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : ''
  const hash = `${route}${search}`
  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    return `${devServer.replace(/\/$/, '')}/#${hash}`
  }
  return `file://${path.join(__dirname, '../dist/index.html')}#${hash}`
}

function assetPath(fileName: string): string {
  return path.join(__dirname, '../assets', fileName)
}

function createTrayImage() {
  const candidates = ['trayTemplate.png', 'trayTemplate@2x.png', 'icon.png']
  for (const candidate of candidates) {
    const image = nativeImage.createFromPath(assetPath(candidate))
    if (!image.isEmpty()) {
      if (candidate.startsWith('trayTemplate')) {
        image.setTemplateImage(true)
      }
      return image.resize({ width: 18, height: 18 })
    }
  }
  return nativeImage.createEmpty()
}

function appIconImage() {
  const image = nativeImage.createFromPath(assetPath('icon.png'))
  return image.isEmpty() ? undefined : image
}

function applyAboutPanel(): void {
  const icon = appIconImage()
  app.setAboutPanelOptions({
    applicationName: brand.desktopProductName,
    applicationVersion: app.getVersion(),
    version: getBuildVersion(),
    copyright: `© ${brand.displayName}`,
    credits: `${brand.displayName} Desktop`,
    ...(icon ? { iconPath: assetPath('icon.png') } : {}),
  })
}

function windowChromeColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0b0f14' : '#f8fafc'
}

function onboardingChromeColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#0b1a28' : '#A7D8F9'
}

function applyWindowChrome(): void {
  settingsWindow?.setBackgroundColor(windowChromeColor())
  onboardingWindow?.setBackgroundColor(onboardingChromeColor())
}

function applyDockPolicy(): void {
  if (process.platform !== 'darwin') return
  const mainVisible = isWindowVisible(settingsWindow) || isWindowVisible(onboardingWindow)
  if (mainVisible) {
    app.dock?.show()
    return
  }
  app.dock?.hide()
}

function isWindowVisible(window: BrowserWindow | null): boolean {
  return Boolean(window && !window.isDestroyed() && window.isVisible())
}

function applyLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
  })
}

function persistLaunchAtLogin(enabled: boolean) {
  applyLaunchAtLogin(enabled)
  return setLaunchAtLogin(enabled)
}

function indexAwareWindows(): Array<BrowserWindow | null> {
  return [settingsWindow, onboardingWindow]
}

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function attachSaveAsOverlay(payload: SuggestionPayload, profile?: FileProfile): SuggestionPayload {
  return {
    ...payload,
    ...composeSaveAsOverlay({
      fileName: payload.fileName,
      sourceApp: payload.sourceApp,
      currentFolder: payload.currentFolder,
      mode: payload.mode,
      extension: payload.extension,
      recommendations: payload.recommendations,
      profile,
      availableLocations: getSuggestedLocations(),
      indexedLocations: loadSettings().indexedLocations,
      learnedFolderCount: getIndexedFolders().length,
    }),
  }
}

function buildSuggestion(
  fileName: string,
  sourceApp: string,
  mode: SuggestionPayload['mode'] = 'demo',
  options?: {
    currentFolder?: string
    windowHandle?: string
    extension?: string
    navigationError?: string | null
  },
): SuggestionPayload {
  const resolvedFolder = options?.currentFolder?.trim() || ''
  const started = Date.now()
  const descriptor = enrichKnowledgeDescriptor(
    describeKnowledgeItem({
      origin: mode === 'save-dialog' ? 'save_dialog' : 'preview',
      displayName: fileName,
      metadata: {
        sourceApp,
        currentFolder: resolvedFolder,
      },
    }),
  )
  const fileProfile = buildFileProfileFromDescriptor(descriptor)
  const intent = resolveIntent(descriptor, { mode })
  const recommendations = intentAllowsCapability(intent, 'recommend_folder')
    ? recommendFolders({
        descriptor,
        folders: getIndexedFolders(),
      })
    : []
  recordRecommendationDuration(Date.now() - started)
  logDev(
    `recommendation fileName="${fileName}" app="${sourceApp}" top=${recommendations[0]?.label ?? 'none'} ${Date.now() - started}ms`,
  )

  return attachSaveAsOverlay(
    {
      fileName,
      sourceApp,
      currentFolder: resolvedFolder,
      mode,
      recommendations,
      windowHandle: options?.windowHandle ?? '',
      extension: options?.extension ?? extensionOf(fileName),
      navigationError: options?.navigationError ?? null,
      detectedSignals: fileUnderstandingLabels(fileProfile),
    },
    fileProfile,
  )
}

type MainWindowSection = AppSection

async function createSettingsWindow(
  section: MainWindowSection = 'home',
  prefs = 'general',
  extraQuery: Record<string, string> = {},
): Promise<BrowserWindow> {
  const hash = pathForSection(section, prefs, extraQuery) as RendererRoute
  const url = rendererUrl(hash)

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    await settingsWindow.webContents.executeJavaScript(
      `window.location.hash = ${JSON.stringify(hash)}`,
    )
    return settingsWindow
  }

  const { workArea } = screen.getPrimaryDisplay()
  settingsWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: SETTINGS_MIN_WIDTH,
    minHeight: SETTINGS_MIN_HEIGHT,
    title: brand.displayName,
    icon: appIconImage(),
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: windowChromeColor(),
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: 'active',
    backgroundMaterial: process.platform === 'darwin' ? 'mica' : undefined,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  settingsWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[suhuella] settings preload failed', preloadPath, error)
  })
  settingsWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    settingsWindow?.setTitle(brand.displayName)
  })
  settingsWindow.setTitle(brand.displayName)

  settingsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      settingsWindow?.hide()
      applyDockPolicy()
    }
  })

  settingsWindow.on('hide', () => applyDockPolicy())
  settingsWindow.on('show', () => applyDockPolicy())

  settingsWindow.on('closed', () => {
    settingsWindow = null
    applyDockPolicy()
  })

  applyWindowChrome()

  await settingsWindow.loadURL(url)
  return settingsWindow
}

async function createOnboardingWindow(): Promise<BrowserWindow> {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    return onboardingWindow
  }

  onboardingWindow = new BrowserWindow({
    width: ONBOARDING_WIDTH,
    height: ONBOARDING_HEIGHT,
    minWidth: 460,
    minHeight: 520,
    title: `Welcome to ${brand.displayName}`,
    icon: appIconImage(),
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#00000000',
    vibrancy: process.platform === 'darwin' ? 'sidebar' : undefined,
    visualEffectState: 'active',
    backgroundMaterial: 'mica',
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  onboardingWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[suhuella] onboarding preload failed', preloadPath, error)
  })

  onboardingWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      onboardingWindow?.hide()
      applyDockPolicy()
    }
  })

  onboardingWindow.on('hide', () => applyDockPolicy())
  onboardingWindow.on('show', () => applyDockPolicy())

  onboardingWindow.on('closed', () => {
    onboardingWindow = null
    applyDockPolicy()
  })

  await onboardingWindow.loadURL(rendererUrl('/onboarding'))
  return onboardingWindow
}

function hideSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide()
  }
}

function hideOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.hide()
  }
}

async function showSettingsWindow(
  section: MainWindowSection = 'home',
  prefs = 'general',
  extraQuery: Record<string, string> = {},
): Promise<void> {
  hideOnboardingWindow()
  if (isWindowVisible(suggestionWindow)) {
    closeSuggestionWindow({ restore: false })
  }
  const window = await createSettingsWindow(section, prefs, extraQuery)
  revealWindow(window)
}

async function showOnboardingWindow(): Promise<void> {
  hideSettingsWindow()
  if (isWindowVisible(suggestionWindow)) {
    closeSuggestionWindow({ restore: false })
  }
  const window = await createOnboardingWindow()
  revealWindow(window)
}

function revealWindow(window: BrowserWindow): void {
  const show = () => {
    applyWindowChrome()
    window.show()
    window.focus()
    applyDockPolicy()
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.once('ready-to-show', show)
    return
  }
  show()
}

async function openSettingsOrOnboarding(): Promise<void> {
  if (shouldShowOnboarding()) {
    await showOnboardingWindow()
    return
  }
  await showSettingsWindow()
}

function positionSuggestionWindow(window: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  // Center-right of the current display so the panel sits beside a typical Save dialog.
  window.setPosition(
    x + width - SUGGESTION_WIDTH - 24,
    y + Math.round((height - SUGGESTION_HEIGHT) / 2),
  )
}

async function createSuggestionWindow(): Promise<BrowserWindow> {
  if (suggestionWindow && !suggestionWindow.isDestroyed()) {
    return suggestionWindow
  }

  suggestionWindow = new BrowserWindow({
    width: SUGGESTION_WIDTH,
    height: SUGGESTION_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: appIconImage(),
    acceptFirstMouse: true,
    backgroundColor: '#00000000',
    vibrancy: process.platform === 'darwin' ? 'popover' : undefined,
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  suggestionWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[suhuella] suggestion preload failed', preloadPath, error)
  })

  suggestionWindow.setAlwaysOnTop(true, 'floating')
  suggestionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  suggestionWindow.on('blur', () => {
    if (currentSuggestion?.mode !== 'save-dialog') return
    if (navigationInFlight || Date.now() < ignoreSuggestionBlurUntil) return
    closeSuggestionWindow({ restore: false })
  })

  suggestionWindow.on('closed', () => {
    suggestionWindow = null
  })

  await suggestionWindow.loadURL(rendererUrl('/suggestion'))
  return suggestionWindow
}

async function showSuggestionWindow(
  payload: SuggestionPayload,
  options?: { restoreOnClose?: 'settings' | 'onboarding'; inactive?: boolean },
): Promise<void> {
  if (isWindowVisible(suggestionWindow) && !options?.inactive) {
    return
  }

  currentSuggestion = payload
  restoreAfterSuggestion = options?.restoreOnClose ?? restoreAfterSuggestion

  hideSettingsWindow()
  hideOnboardingWindow()

  const window = await createSuggestionWindow()
  positionSuggestionWindow(window)
  window.webContents.send('suggestion:updated', payload)

  if (options?.inactive) {
    ignoreSuggestionBlurUntil = Date.now() + 500
    window.showInactive()
    return
  }

  window.show()
  window.focus()
}

function handleSaveDialogOpened(event: SaveDialogOpenedEvent): void {
  if (shouldShowOnboarding()) {
    recordDetectionAttempt({
      processName: event.processName,
      windowTitle: event.windowTitle,
      className: event.className,
      fileName: event.fileName,
      currentFolder: event.currentFolder,
      windowHandle: event.windowHandle,
      detected: true,
      recommendationCount: 0,
      failureReason: 'onboarding incomplete',
    })
    return
  }

  if (isWindowVisible(suggestionWindow)) {
    recordDetectionAttempt({
      processName: event.processName,
      windowTitle: event.windowTitle,
      className: event.className,
      fileName: event.fileName,
      currentFolder: event.currentFolder,
      windowHandle: event.windowHandle,
      detected: true,
      recommendationCount: currentSuggestion?.recommendations.length ?? 0,
      failureReason: 'ignored overlapping dialog',
    })
    logDev(`ignored overlapping Save As hwnd=${event.windowHandle}`)
    return
  }

  const fileName = event.fileName.trim() || 'Untitled'
  const sourceApp = formatSourceApp(event.processName) || event.windowTitle.trim()
  logDev(
    `detection title="${event.windowTitle}" class="${event.className}" process="${event.processName}" fileName="${fileName}" folder="${event.currentFolder}" hwnd=${event.windowHandle} hints=${event.automationHints} field=${event.filenameFieldFound}`,
  )

  const payload = buildSuggestion(fileName, sourceApp, 'save-dialog', {
    currentFolder: event.currentFolder,
    windowHandle: event.windowHandle,
    extension: event.extension,
  })
  recordDetectionAttempt({
    processName: event.processName,
    windowTitle: event.windowTitle,
    className: event.className,
    fileName: event.fileName,
    currentFolder: event.currentFolder,
    windowHandle: event.windowHandle,
    detected: true,
    recommendationCount: payload.recommendations.length,
  })
  void showSuggestionWindow(payload, { inactive: true })
}

function handleSaveDialogIgnored(event: SaveDialogIgnoredEvent): void {
  logDev(`classified ignore reason=${event.reason} title="${event.windowTitle}" class="${event.className}"`)
  recordDetectionAttempt({
    processName: event.processName,
    windowTitle: event.windowTitle,
    className: event.className,
    fileName: '',
    currentFolder: '',
    windowHandle: event.windowHandle,
    detected: false,
    recommendationCount: 0,
    failureReason: event.reason || 'ignored dialog',
  })
}

function handleSaveDialogClosed(event: SaveDialogClosedEvent): void {
  if (currentSuggestion?.mode !== 'save-dialog') return
  if (currentSuggestion.windowHandle && event.windowHandle !== currentSuggestion.windowHandle) {
    return
  }
  logDev(`save dialog closed hwnd=${event.windowHandle}`)
  closeSuggestionWindow({ restore: false })
}

function resolveSafeLocalPath(target: unknown, kind: 'any' | 'directory'): string | null {
  if (typeof target !== 'string') return null

  const trimmed = target.trim()
  if (!trimmed || trimmed.includes('\0')) return null

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  const looksLikeDrivePath = /^[a-zA-Z]:[\\/]/.test(trimmed)
  if (looksLikeUrl && !looksLikeDrivePath) return null
  if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) return null
  if (!path.isAbsolute(trimmed)) return null

  let resolved: string
  try {
    resolved = path.resolve(trimmed)
  } catch {
    return null
  }

  try {
    const stats = statSync(resolved)
    if (kind === 'directory' && !stats.isDirectory()) return null
  } catch {
    return null
  }

  return resolved
}

function resolveSafeLocalDirectory(folder: unknown): string | null {
  return resolveSafeLocalPath(folder, 'directory')
}

function isAllowedSearchPath(resolved: string): boolean {
  const roots = [
    ...loadSettings().indexedLocations,
    ...loadSettings().recentFolders,
    ...loadIndex().locations,
    ...loadIndex().folders.map((folder) => folder.absolutePath),
    ...loadActivityRuns(app.getPath('userData')).flatMap((run) =>
      run.items.flatMap((item) => [item.sourcePath, item.targetPath ?? '']),
    ),
    ...listWorkflows(app.getPath('userData')).flatMap((workflow) =>
      workflow.plan.knowledgeSet.items.map((item) => item.path),
    ),
  ]

  const normalized = resolved.toLowerCase()
  return roots.some((root) => {
    if (!root) return false
    let candidate: string
    try {
      candidate = path.resolve(root).toLowerCase()
    } catch {
      return false
    }
    return normalized === candidate || normalized.startsWith(`${candidate}${path.sep}`)
  })
}

async function openLocalFolder(folder: unknown): Promise<OpenFolderResult> {
  assertCanExecute('open_folder')
  const resolved = resolveSafeLocalDirectory(folder)
  if (!resolved) return { ok: false, error: 'That location could not be shown.' }

  try {
    recordRecentFolder(resolved)
    const errorMessage = await shell.openPath(resolved)
    return errorMessage.length === 0
      ? { ok: true }
      : { ok: false, error: 'That location could not be shown.' }
  } catch {
    return { ok: false, error: 'That location could not be shown.' }
  }
}

async function navigateNativeDialog(folder: string): Promise<NavigateFolderResult> {
  assertCanExecute('navigate_save_dialog')
  const handle = currentSuggestion?.windowHandle ?? ''
  ignoreSuggestionBlurUntil = Date.now() + 1500
  navigationInFlight = true
  try {
    const result = await (saveDialogWatcher?.navigateFolder(handle, folder) ??
      Promise.resolve({
        ok: false,
        folder,
        error: 'Could not navigate automatically.',
        method: 'Failed' as const,
      }))
    recordNavigationAttempt({
      method: result.method ?? 'Failed',
      succeeded: result.ok,
      failureReason: result.error,
    })
    logDev(
      `navigation ${result.ok ? 'ok' : 'failed'} method=${result.method ?? 'Failed'} folder="${folder}" error=${result.error ?? ''}`,
    )
    return result
  } finally {
    navigationInFlight = false
    ignoreSuggestionBlurUntil = Date.now() + 400
  }
}

function showNavigationError(error: string): void {
  if (!currentSuggestion) return
  currentSuggestion = {
    ...currentSuggestion,
    navigationError: error || 'Could not navigate automatically.',
  }
  if (isWindowVisible(suggestionWindow)) {
    suggestionWindow?.webContents.send('suggestion:updated', currentSuggestion)
  }
}

function emptyPreviewSuggestion(): SuggestionPayload {
  return attachSaveAsOverlay({
    fileName: '',
    sourceApp: '',
    currentFolder: '',
    mode: 'preview',
    recommendations: [],
    windowHandle: '',
    extension: '',
    navigationError: null,
    detectedSignals: [],
  })
}

function previewSuggestionForName(fileName: string, sourceApp = ''): SuggestionPayload {
  const trimmed = fileName.trim()
  if (!trimmed) return emptyPreviewSuggestion()
  return buildSuggestion(trimmed, sourceApp, 'preview')
}

async function showPreviewSuggestions(options?: {
  fileName?: string
  sourceApp?: string
}): Promise<void> {
  if (isWindowVisible(suggestionWindow)) {
    return
  }

  const restoreOnClose = isWindowVisible(onboardingWindow)
    ? 'onboarding'
    : isWindowVisible(settingsWindow)
      ? 'settings'
      : undefined

  const payload = options?.fileName?.trim()
    ? previewSuggestionForName(options.fileName, options.sourceApp ?? '')
    : emptyPreviewSuggestion()

  await showSuggestionWindow(payload, {
    restoreOnClose,
  })
}

function pickFile(parent: BrowserWindow | null) {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose a file',
    properties: ['openFile'],
  }
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function closeSuggestionWindow(options?: { restore?: boolean }): void {
  if (suggestionWindow && !suggestionWindow.isDestroyed()) {
    suggestionWindow.hide()
  }

  const shouldRestore = options?.restore !== false
  const restore = restoreAfterSuggestion
  restoreAfterSuggestion = null

  if (!shouldRestore || !restore) {
    return
  }

  if (restore === 'onboarding') {
    void showOnboardingWindow()
    return
  }

  void showSettingsWindow()
}

function pickDirectory(parent: BrowserWindow | null, title: string) {
  const options: Electron.OpenDialogOptions = {
    title,
    properties: ['openDirectory', 'createDirectory'],
  }
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function pickFilesMulti(parent: BrowserWindow | null) {
  const options: Electron.OpenDialogOptions = {
    title: 'Select documents',
    properties: ['openFile', 'multiSelections'],
  }
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function pickFoldersMulti(parent: BrowserWindow | null) {
  const options: Electron.OpenDialogOptions = {
    title: 'Select folders',
    properties: ['openDirectory', 'multiSelections'],
  }
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function openPreferences(): void {
  if (shouldShowOnboarding()) {
    void showOnboardingWindow()
    return
  }
  void showSettingsWindow('settings')
}

function showAboutDialog(): void {
  if (process.platform === 'darwin') {
    app.showAboutPanel()
    return
  }
  const icon = appIconImage()
  void dialog.showMessageBox({
    type: 'info',
    title: `About ${brand.displayName}`,
    message: brand.displayName,
    detail: [
      `${brand.displayName} ${app.getVersion()} (${getBuildVersion()})`,
      getOsComputerName(),
      '',
      `${brand.displayName} Desktop`,
      '',
      `© ${brand.displayName}`,
    ].join('\n'),
    buttons: ['OK'],
    ...(icon ? { icon } : {}),
  })
}

function viewMenu(): Electron.MenuItemConstructorOptions {
  const go = (section: MainWindowSection) => () => {
    void showSettingsWindow(section)
  }
  return {
    label: 'View',
    submenu: [
      { label: 'Home', accelerator: 'CommandOrControl+1', click: go('home') },
      { label: 'Organise', accelerator: 'CommandOrControl+2', click: go('organise') },
      { label: 'Sources', accelerator: 'CommandOrControl+3', click: go('locations') },
      { label: 'Activity', accelerator: 'CommandOrControl+4', click: go('activity') },
      { type: 'separator' },
      { label: 'Search', accelerator: 'CommandOrControl+F', click: go('search') },
    ],
  }
}

function createApplicationMenu(): void {
  const settingsItem = {
    label: process.platform === 'darwin' ? 'Settings…' : 'Settings',
    accelerator: 'CommandOrControl+,',
    click: () => openPreferences(),
  }

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            settingsItem,
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { role: 'editMenu' },
        viewMenu(),
        { role: 'windowMenu' },
      ]),
    )
    return
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: `Open ${brand.displayName}`,
            click: () => {
              void openSettingsOrOnboarding()
            },
          },
          settingsItem,
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      viewMenu(),
      {
        label: 'Help',
        submenu: [
          {
            label: `About ${brand.displayName}`,
            click: () => showAboutDialog(),
          },
        ],
      },
    ]),
  )
}

function applyTrayActivity(progress: IndexScanProgress): void {
  if (!tray) return
  if (progress.status === 'scanning') {
    const files = progress.filesSeen.toLocaleString()
    tray.setToolTip(`${brand.displayName} — Learning from documents… (${files} files)`)
    if (process.platform === 'darwin') {
      app.dock?.setBadge('•')
    }
    return
  }
  tray.setToolTip(brand.displayName)
  if (process.platform === 'darwin') {
    app.dock?.setBadge('')
  }
}

function createTray(): void {
  tray = new Tray(createTrayImage())
  applyTrayActivity(getScanProgress())
  onScanProgress(applyTrayActivity)
  const menu: Electron.MenuItemConstructorOptions[] = [
    {
      label: `Open ${brand.displayName}`,
      click: () => {
        void openSettingsOrOnboarding()
      },
    },
    {
      label: 'Settings',
      click: () => openPreferences(),
    },
  ]
  if (isDevelopmentMode()) {
    menu.push({
      label: 'Preview Save As',
      accelerator: PREVIEW_SHORTCUT,
      click: () => {
        void showPreviewSuggestions()
      },
    })
  }
  menu.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  )
  tray.setContextMenu(Menu.buildFromTemplate(menu))
  tray.on('click', () => {
    if (process.platform === 'win32') {
      void openSettingsOrOnboarding()
    }
  })
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:getPath', () => getSettingsFilePath())
  ipcMain.handle('release:check', () => checkDesktopRelease())
  ipcMain.handle('app:getInfo', () => {
    const platform = process.platform as 'darwin' | 'win32' | 'linux'
    return {
      name: brand.desktopProductName,
      version: app.getVersion(),
      buildVersion: getBuildVersion(),
      platform,
      development: isDevelopmentMode(),
      host: 'electron' as const,
      folderAccess: true,
      computerName: getOsComputerName(),
      osVersion: getOsVersionLabel(),
      capabilities: {
        saveAs: platform === 'win32',
        tray: true,
        openFolder: true,
        reveal: true,
        filesystem: true,
        notifications: true,
        nativeDialogs: true,
        organise: true,
        search: true,
        activity: true,
        workflows: true,
        license: true,
      },
    }
  })

  ipcMain.handle('license:get', () => getLicenseView())
  ipcMain.handle('license:serviceHealth', () => getServiceHealth())
  ipcMain.handle('shell:openExternal', (_event, url: unknown) => {
    if (typeof url !== 'string') return false
    return openExternalUrl(url)
  })
  ipcMain.handle('license:openCheckout', (_event, plan: unknown, email: unknown) => {
    if (plan !== 'lifetime' && plan !== 'monthly' && plan !== 'business') return false
    return openCheckout(plan, typeof email === 'string' ? email : '')
  })
  ipcMain.handle('license:activateFromCheckout', (_event, sessionId: unknown, activationAttemptId: unknown) => {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return { ok: false, error: 'invalid_request', license: getLicenseView() }
    }
    return activateFromCheckout(
      sessionId.trim(),
      typeof activationAttemptId === 'string' ? activationAttemptId : undefined,
    )
  })
  ipcMain.handle('license:createCheckoutAttempt', (_event, plan: unknown) => {
    if (plan !== 'lifetime' && plan !== 'monthly' && plan !== 'business') {
      return { ok: false, error: 'invalid_request' }
    }
    return createCheckoutAttempt(plan)
  })
  ipcMain.handle('license:requestEmailCode', (_event, email: unknown) => {
    if (typeof email !== 'string' || !email.trim()) {
      return { ok: false, error: 'invalid_request' }
    }
    return requestLicenseEmailCode(email.trim())
  })
  ipcMain.handle('license:verifyEmailCode', (_event, challengeId: unknown, code: unknown) => {
    if (typeof challengeId !== 'string' || typeof code !== 'string') {
      return { ok: false, error: 'invalid_request' }
    }
    return verifyLicenseEmailCode(challengeId.trim(), code.trim())
  })
  ipcMain.handle('license:activate', (_event, emailProofId: unknown) => {
    if (typeof emailProofId !== 'string' || !emailProofId.trim()) {
      return { ok: false, error: 'invalid_request' }
    }
    return activateLicense(emailProofId.trim())
  })
  ipcMain.handle('license:updateBranding', (_event, dataUrl: unknown) => {
    if (dataUrl !== null && typeof dataUrl !== 'string') {
      return { ok: false, error: 'invalid_request', license: getLicenseView() }
    }
    return updateBusinessBranding(dataUrl)
  })
  ipcMain.handle('license:check', () => checkLicense())
  ipcMain.handle('license:deactivate', () => deactivateLicense())
  ipcMain.handle('license:deactivate-remote', (_event, deviceIndex: unknown) => {
    if (typeof deviceIndex !== 'number' || !Number.isInteger(deviceIndex)) {
      return { ok: false, error: 'invalid_request', license: getLicenseView() }
    }
    return deactivateRemoteDevice(deviceIndex)
  })
  ipcMain.handle('license:rename-device', (_event, name: unknown) => {
    if (typeof name !== 'string') return { ok: false, error: 'invalid_request', license: getLicenseView() }
    return renameThisDevice(name)
  })

  ipcMain.handle('diagnostics:get', () => getCompatibilityDiagnostics())

  ipcMain.handle('diagnostics:export', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const result = parent
      ? await dialog.showSaveDialog(parent, {
          title: 'Export diagnostics for support',
          defaultPath: `suhuella-diagnostics-${Date.now()}.json`,
          filters: [{ name: 'Diagnostics', extensions: ['json'] }],
        })
      : await dialog.showSaveDialog({
          title: 'Export diagnostics for support',
          defaultPath: `suhuella-diagnostics-${Date.now()}.json`,
          filters: [{ name: 'Diagnostics', extensions: ['json'] }],
        })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, buildCompatibilityExport(app.getVersion()), 'utf8')
    return result.filePath
  })

  ipcMain.handle('index:getStatus', () => ({
    settings: loadSettings(),
    scan: getScanProgress(),
    locations: getIndexedLocationSummaries(),
    summary: getFoldersKnowledgeSummary(),
  }))

  ipcMain.handle('index:getKnowledgeHealth', () => getKnowledgeIndexHealth())

  ipcMain.handle('index:getSuggestedLocations', () => getSuggestedLocations())

  ipcMain.handle('index:getBrowse', () => getIndexBrowse())
  ipcMain.handle('index:browseSource', (_event, path: unknown) => {
    if (typeof path !== 'string') return browseSource('')
    return browseSource(path)
  })

  ipcMain.handle('search:query', (_event, request: unknown) => {
    const query = normalizeSearchQuery(request)
    return searchKnowledge(query, {
      index: loadIndex(),
      recents: loadSettings().recentFolders,
      activity: loadActivityRuns(app.getPath('userData')),
      workflows: listWorkflows(app.getPath('userData')),
    })
  })

  ipcMain.handle('search:open', async (_event, target: unknown): Promise<OpenFolderResult> => {
    const resolved = resolveSafeLocalPath(target, 'any')
    if (!resolved || !isAllowedSearchPath(resolved)) {
      return { ok: false, error: 'That file could not be opened.' }
    }
    try {
      if (statSync(resolved).isDirectory()) {
        return openLocalFolder(resolved)
      }
      recordRecentFolder(path.dirname(resolved))
      const errorMessage = await shell.openPath(resolved)
      return errorMessage.length === 0
        ? { ok: true }
        : { ok: false, error: 'That file could not be opened.' }
    } catch {
      return { ok: false, error: 'That file could not be opened.' }
    }
  })

  ipcMain.handle('search:reveal', async (_event, target: unknown): Promise<OpenFolderResult> => {
    const resolved = resolveSafeLocalPath(target, 'any')
    if (!resolved || !isAllowedSearchPath(resolved)) {
      return { ok: false, error: 'That location could not be shown.' }
    }
    try {
      shell.showItemInFolder(resolved)
      return { ok: true }
    } catch {
      return { ok: false, error: 'That location could not be shown.' }
    }
  })

  ipcMain.handle('index:addLocation', async (event) => {
    const result = await pickDirectory(
      BrowserWindow.fromWebContents(event.sender),
      'Add folder',
    )
    if (result.canceled || result.filePaths.length === 0) {
      return loadSettings()
    }
    addIndexedLocation(result.filePaths[0])
    assertCanExecute('refresh_index')
    return startIndexScan(indexAwareWindows())
  })

  ipcMain.handle('index:removeLocation', async (_event, location: unknown) => {
    if (typeof location !== 'string') return loadSettings()
    removeIndexedLocation(location)
    assertCanExecute('refresh_index')
    return startIndexScan(indexAwareWindows())
  })

  ipcMain.handle('index:setLocations', (_event, locations: unknown) => {
    if (!Array.isArray(locations)) return loadSettings()
    const paths = locations.filter((item): item is string => typeof item === 'string')
    return setIndexedLocations(paths)
  })

  ipcMain.handle('index:startScan', () => {
    assertCanExecute('refresh_index')
    return startIndexScan(indexAwareWindows())
  })

  ipcMain.handle('index:restoreSourceAccess', () => {
    assertCanExecute('refresh_index')
    return startIndexScan(indexAwareWindows())
  })

  ipcMain.handle('index:cancelScan', () => {
    cancelIndexScan()
  })

  ipcMain.handle('settings:matchFoldersForFile', (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim()) return null

    const normalizedPath = path.normalize(filePath.trim())
    const fileName = path.basename(normalizedPath)
    const descriptor = enrichKnowledgeDescriptor(
      describeKnowledgeItem({
        origin: 'local_file',
        displayName: fileName,
        metadata: { filePath: normalizedPath },
      }),
    )

    const intent = resolveIntent(descriptor, { mode: 'probe' })
    const started = Date.now()
    const recommendations = intentAllowsCapability(intent, 'recommend_folder')
      ? recommendFolders({
          descriptor,
          folders: getIndexedFolders(),
        })
      : []
    recordRecommendationDuration(Date.now() - started)
    return {
      fileName,
      filePath: normalizedPath,
      recommendations,
    }
  })

  ipcMain.handle('settings:setLaunchAtLogin', (_event, enabled: unknown) => {
    return persistLaunchAtLogin(Boolean(enabled))
  })

  ipcMain.handle('settings:setSourceAppearanceColor', (_event, path: unknown, color: unknown) => {
    if (typeof path !== 'string') return loadSettings()
    const nextColor = color === null ? null : typeof color === 'string' ? color : null
    return setSourceAppearanceColor(path, nextColor)
  })

  ipcMain.handle('settings:setSourceAppearance', (_event, path: unknown, update: unknown) => {
    if (typeof path !== 'string' || !update || typeof update !== 'object') return loadSettings()
    const raw = update as { color?: unknown; iconId?: unknown }
    const next: SourceAppearanceUpdate = {}
    if ('color' in raw) next.color = raw.color === null ? null : typeof raw.color === 'string' ? raw.color : null
    if ('iconId' in raw) {
      if (raw.iconId === null) next.iconId = null
      else if (typeof raw.iconId === 'string' && isCustomizableIconId(raw.iconId)) next.iconId = raw.iconId
    }
    return setSourceAppearance(path, next)
  })

  ipcMain.handle('settings:revealFile', async () => {
    const filePath = getSettingsFilePath()
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('onboarding:finish', async (_event, destination: unknown) => {
    const settings = markFirstRunCompleted()
    await showSettingsWindow(destination === 'organise' ? 'organise' : 'home')
    return settings
  })

  ipcMain.handle('suggestion:preview', async () => {
    await showPreviewSuggestions()
  })

  ipcMain.handle('suggestion:previewName', async (_event, fileName: unknown) => {
    if (typeof fileName !== 'string') {
      return currentSuggestion
    }

    const payload = previewSuggestionForName(fileName)
    currentSuggestion = payload

    if (isWindowVisible(suggestionWindow)) {
      suggestionWindow?.webContents.send('suggestion:updated', payload)
    }

    return payload
  })

  ipcMain.handle('suggestion:pickFile', async (event) => {
    const result = await pickFile(BrowserWindow.fromWebContents(event.sender))
    if (result.canceled || !result.filePaths[0]) {
      return null
    }

    const filePath = result.filePaths[0]
    const fileName = path.basename(filePath)
    const payload = buildSuggestion(fileName, '', 'preview')

    if (isWindowVisible(suggestionWindow)) {
      currentSuggestion = payload
      suggestionWindow?.webContents.send('suggestion:updated', payload)
      return payload
    }

    const restoreOnClose = isWindowVisible(onboardingWindow)
      ? 'onboarding'
      : isWindowVisible(settingsWindow)
        ? 'settings'
        : undefined

    await showSuggestionWindow(payload, { restoreOnClose })
    return payload
  })

  ipcMain.handle('suggestion:get', () => currentSuggestion)

  ipcMain.handle('suggestion:choose', async (_event, folder: unknown): Promise<NavigateFolderResult> => {
    if (typeof folder !== 'string' || !folder.trim()) {
      return { ok: false, folder: '', error: 'Could not navigate automatically.' }
    }

    if (currentSuggestion?.mode !== 'save-dialog') {
      logDev(`preview choose folder="${folder}"`)
      return { ok: true, folder }
    }

    const result = await navigateNativeDialog(folder)
    if (result.ok) {
      closeSuggestionWindow({ restore: false })
      return result
    }

    showNavigationError(result.error || 'Could not navigate automatically.')
    return result
  })

  ipcMain.handle('suggestion:chooseAnother', async (event) => {
    ignoreSuggestionBlurUntil = Date.now() + 10_000
    const result = await pickDirectory(
      BrowserWindow.fromWebContents(event.sender),
      'Choose a folder',
    )
    if (result.canceled || !result.filePaths[0]) {
      return loadSettings()
    }

    const folder = result.filePaths[0]
    if (currentSuggestion?.mode !== 'save-dialog') {
      logDev(`preview browse folder="${folder}"`)
      if (currentSuggestion) {
        currentSuggestion = appendBrowsedDestination(currentSuggestion, folder, {
          included: loadSettings().indexedLocations.some(
            (root) =>
              path.normalize(folder).toLowerCase() === path.normalize(root).toLowerCase() ||
              path.normalize(folder).toLowerCase().startsWith(`${path.normalize(root).toLowerCase()}${path.sep}`),
          ),
        })
        suggestionWindow?.webContents.send('suggestion:updated', currentSuggestion)
      }
      return loadSettings()
    }

    const navigation = await navigateNativeDialog(folder)
    if (navigation.ok) {
      closeSuggestionWindow({ restore: false })
      return loadSettings()
    }

    showNavigationError(navigation.error || 'Could not navigate automatically.')
    return loadSettings()
  })

  ipcMain.handle('suggestion:includeSource', (_event, folder: unknown): IncludeSourceResult => {
    const resolved = resolveSafeLocalDirectory(folder)
    if (!resolved) {
      return { ok: false, error: 'This source is not available right now.' }
    }
    if (isSystemSavePath(resolved)) {
      return { ok: false, error: `${brand.displayName} cannot add this folder.` }
    }

    addIndexedLocation(resolved)
    assertCanExecute('refresh_index')
    void startIndexScan(indexAwareWindows())

    if (currentSuggestion) {
      currentSuggestion = refreshDestinationInclusion(
        markDestinationIncluded(currentSuggestion, resolved),
        loadSettings().indexedLocations,
      )
      if (isWindowVisible(suggestionWindow)) {
        suggestionWindow?.webContents.send('suggestion:updated', currentSuggestion)
      }
    }

    return { ok: true, folder: resolved }
  })

  ipcMain.handle('suggestion:copyPath', async (_event, folder: unknown) => {
    if (typeof folder !== 'string' || !folder.trim()) return false
    assertCanExecute('copy_path')
    clipboard.writeText(folder)
    return true
  })

  ipcMain.handle('suggestion:openFolder', async (_event, folder: unknown): Promise<OpenFolderResult> => {
    return openLocalFolder(folder)
  })

  ipcMain.handle('suggestion:close', () => {
    closeSuggestionWindow()
  })

  ipcMain.handle('knowledge-set:pickFiles', async (event) => {
    const result = await pickFilesMulti(BrowserWindow.fromWebContents(event.sender))
    if (result.canceled || result.filePaths.length === 0) {
      return []
    }
    return pathsToKnowledgeSetItems(result.filePaths)
  })

  ipcMain.handle('knowledge-set:pickFolders', async (event) => {
    const result = await pickFoldersMulti(BrowserWindow.fromWebContents(event.sender))
    if (result.canceled || result.filePaths.length === 0) {
      return []
    }
    return pathsToKnowledgeSetItems(result.filePaths)
  })

  ipcMain.handle('knowledge-set:previewPlan', (_event, knowledgeSet: unknown) => {
    const result = previewOrganisationPlanForFolders(knowledgeSet, getIndexedFolders())
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    return { ok: true as const, preview: result.data }
  })

  ipcMain.handle('knowledge-set:suggestPlan', async (_event, request: unknown) => {
    return runPlanAssistant(app.getPath('userData'), request, getIndexedFolders())
  })

  ipcMain.handle('plan-assistant:status', () => getPlanAssistantStatus(app.getPath('userData')))

  ipcMain.handle('activity:get', () => listActivityWithUndoState(app.getPath('userData')))

  ipcMain.handle('byok:get', () => getByokStatus(app.getPath('userData')))
  ipcMain.handle('byok:connect', (_event, request: unknown) =>
    connectByok(app.getPath('userData'), request),
  )
  ipcMain.handle('byok:disconnect', () => disconnectByok(app.getPath('userData')))
  ipcMain.handle('byok:assist', (_event, request: unknown) =>
    assistWithByok(app.getPath('userData'), request),
  )
  ipcMain.handle('byok:conversation', () => listByokConversation())
  ipcMain.handle('byok:clearConversation', () => clearByokConversation())

  ipcMain.handle('storage:get', () => getStorageUsage(app.getPath('userData')))
  ipcMain.handle('storage:documentSummary', () => getDocumentStorageSummary())
  ipcMain.handle('storage:overview', () => getStorageOverview())
  ipcMain.handle('metrics:get', () => getDesktopDeviceMetrics())
  ipcMain.handle('storage:clearCache', () => clearManagedCache(app.getPath('userData')))
  ipcMain.handle('storage:clearLogs', () => clearManagedLogs(app.getPath('userData')))
  ipcMain.handle('storage:clearActivity', () => clearManagedActivity(app.getPath('userData')))
  ipcMain.handle('storage:exportActivity', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const defaultPath = path.join(
      storageLayout(app.getPath('userData')).diagnosticsDir,
      `suhuella-activity-${Date.now()}.json`,
    )
    const result = parent
      ? await dialog.showSaveDialog(parent, {
          title: 'Export activity',
          defaultPath,
          filters: [{ name: 'Activity', extensions: ['json'] }],
        })
      : await dialog.showSaveDialog({
          title: 'Export activity',
          defaultPath,
          filters: [{ name: 'Activity', extensions: ['json'] }],
        })
    if (result.canceled || !result.filePath) return null
    return exportActivityJson(app.getPath('userData'), result.filePath)
  })

  ipcMain.handle('activity:undo', (_event, request: unknown) => {
    const result = executeUndo(request, app.getPath('userData'))
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    return { ok: true as const, result: result.data }
  })

  ipcMain.handle('knowledge-set:executePlan', (_event, request: unknown) => {
    const userDataDir = app.getPath('userData')
    const startedAt = new Date().toISOString()
    const storedNext = nextActivityRunNumber(loadActivityRuns(userDataDir))
    const requested =
      request && typeof request === 'object' && 'runNumber' in request
        ? Number((request as { runNumber?: unknown }).runNumber)
        : Number.NaN
    const runNumber = Number.isInteger(requested) && requested >= storedNext ? requested : storedNext
    const confirmedRequest =
      request && typeof request === 'object' ? { ...request, runNumber } : request
    const result = executeOrganisationPlan(confirmedRequest, getIndexedFolders())
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    const trigger = organisationActivityTrigger(
      request && typeof request === 'object' && 'trigger' in request
        ? (request as { trigger?: unknown }).trigger
        : undefined,
    )
    const workflowId =
      request && typeof request === 'object' && 'workflowId' in request
        ? (request as { workflowId?: unknown }).workflowId
        : undefined
    try {
      const workflow =
        typeof workflowId === 'string' && workflowId.trim()
          ? getWorkflow(userDataDir, workflowId)
          : null
      persistOrganisationActivity(userDataDir, result.data, startedAt, {
        trigger,
        ...(workflow
          ? {
              workflowId: workflow.id,
              workflowName: workflow.name,
              workflowSummary: workflowIntentSummary(workflow),
            }
          : {}),
      })
      if (workflow) {
        markWorkflowRan(userDataDir, workflow.id)
        const plan =
          request && typeof request === 'object' && 'plan' in request
            ? (request as { plan?: unknown }).plan
            : null
        if (plan) {
          approveWorkflowPlan(userDataDir, workflowId, plan)
        }
      }
    } catch (error) {
      console.error('[suhuella] failed to persist activity', error)
    }
    return { ok: true as const, result: result.data }
  })

  ipcMain.handle('workflows:list', () => listWorkflows(app.getPath('userData')))

  ipcMain.handle('workflows:save', (_event, draft: unknown) => {
    const result = saveWorkflow(app.getPath('userData'), draft)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data }
  })

  ipcMain.handle('workflows:update', (_event, workflowId: unknown, draft: unknown) => {
    const result = updateWorkflow(app.getPath('userData'), workflowId, draft)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data }
  })

  ipcMain.handle('workflows:delete', (_event, workflowId: unknown) => {
    const result = deleteWorkflow(app.getPath('userData'), workflowId)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflows: result.data }
  })

  ipcMain.handle('workflows:duplicate', (_event, workflowId: unknown) => {
    const result = duplicateWorkflow(app.getPath('userData'), workflowId)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data }
  })

  ipcMain.handle('workflows:loadForRun', (_event, workflowId: unknown) => {
    const result = loadWorkflowForManualRun(app.getPath('userData'), workflowId)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data.workflow, knowledgeSet: result.data.knowledgeSet }
  })

  ipcMain.handle('workflows:setAutopilot', (_event, workflowId: unknown, enabled: unknown) => {
    const result = setWorkflowAutopilot(app.getPath('userData'), workflowId, enabled)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data }
  })

  ipcMain.handle('workflows:approvePlan', (_event, workflowId: unknown, plan: unknown) => {
    const result = approveWorkflowPlan(app.getPath('userData'), workflowId, plan)
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, workflow: result.data }
  })

  ipcMain.handle('autopilot:run', (_event, request: unknown) => {
    const result = executeAutopilotWorkflow(request, app.getPath('userData'), getIndexedFolders())
    if (!result.ok) return { ok: false as const, error: result.error }
    return { ok: true as const, result: result.data }
  })
}

function registerShortcuts(): void {
  if (!isDevelopmentMode()) return
  globalShortcut.register(PREVIEW_SHORTCUT, () => {
    void showPreviewSuggestions()
  })
}

function protocolUrlFromArgv(argv: string[]): string | null {
  return argv.find((item) => item.startsWith(`${brand.desktopProtocol}:`)) ?? null
}

async function handleProtocolUrl(raw: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return
  }
  if (parsed.protocol !== `${brand.desktopProtocol}:`) return
  const path = `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '')
  if (path === 'license/success' || path === 'license' || path === 'activate' || path === '') {
    const extra: Record<string, string> = {}
    const sessionId = parsed.searchParams.get('session_id')?.trim()
    const checkout = parsed.searchParams.get('checkout')?.trim()
    if (sessionId) extra.session_id = sessionId
    if (checkout) extra.checkout = checkout
    await showSettingsWindow('settings', 'license', extra)
    if (!sessionId) silentLicenseRefresh()
    return
  }
  await openSettingsOrOnboarding()
}

function registerProtocolClient(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(brand.desktopProtocol, process.execPath, [path.resolve(process.argv[1])])
    return
  }
  app.setAsDefaultProtocolClient(brand.desktopProtocol)
}

let pendingProtocolUrl: string | null = null

function queueProtocolUrl(raw: string): void {
  if (app.isReady()) {
    void handleProtocolUrl(raw)
    return
  }
  pendingProtocolUrl = raw
}

const gotLock = app.requestSingleInstanceLock()
app.setName(brand.desktopProductName)

if (!gotLock) {
  app.quit()
} else {
  registerProtocolClient()
  app.on('second-instance', (_event, argv) => {
    const protocolUrl = protocolUrlFromArgv(argv)
    if (protocolUrl) {
      queueProtocolUrl(protocolUrl)
      return
    }
    void openSettingsOrOnboarding()
  })
  app.on('open-url', (event, url) => {
    event.preventDefault()
    queueProtocolUrl(url)
  })

  if (process.platform === 'win32') {
    app.setAppUserModelId(brand.desktopAppId)
  }

  const launchStartedAt = Date.now()
  app.whenReady().then(() => {
    recordStartupDuration(Date.now() - launchStartedAt)
    applyAboutPanel()
    nativeTheme.themeSource = 'system'
    nativeTheme.on('updated', () => applyWindowChrome())
    createApplicationMenu()
    applyDockPolicy()

    assertCapabilityKernelFrozen()
    assertIntentKernelFrozen()
    registerIpc()
    createTray()
    registerShortcuts()
    saveDialogWatcher = startSaveDialogWatcher({
      onOpened: handleSaveDialogOpened,
      onClosed: handleSaveDialogClosed,
      onIgnored: handleSaveDialogIgnored,
    })

    const settings = loadSettings()
    applyLaunchAtLogin(settings.launchAtLogin)
    try {
      runAutomaticCleanup(app.getPath('userData'))
    } catch (error) {
      console.error('[suhuella] storage cleanup failed', error)
    }

    silentLicenseRefresh()
    const launchUrl = pendingProtocolUrl ?? protocolUrlFromArgv(process.argv)
    pendingProtocolUrl = null
    if (launchUrl) {
      void handleProtocolUrl(launchUrl)
      return
    }

    // Open the full app on launch. Closing the window hides to the tray instead.
    void openSettingsOrOnboarding()
  })
}

app.on('before-quit', () => {
  isQuitting = true
  saveDialogWatcher?.stop()
  saveDialogWatcher = null
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Stay in the tray until the user quits.
})

app.on('activate', () => {
  void openSettingsOrOnboarding()
})
