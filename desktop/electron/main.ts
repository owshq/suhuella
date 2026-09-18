import path from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  screen,
  shell,
  Tray,
} from 'electron'
import { recommendFolders } from './recommendations.ts'
import {
  addFavouriteFolder,
  getSettingsFilePath,
  loadSettings,
  markFirstRunCompleted,
  markWelcomeNotificationShown,
  removeFavouriteFolder,
  setLaunchAtLogin,
  shouldShowOnboarding,
} from './settings-store.ts'
import type { SuggestionPayload } from '../src/types.ts'

const SETTINGS_WIDTH = 640
const SETTINGS_HEIGHT = 620
const ONBOARDING_WIDTH = 520
const ONBOARDING_HEIGHT = 620
const SUGGESTION_WIDTH = 360
const SUGGESTION_HEIGHT = 300
const TEST_FILE_NAME = 'Factura_Cliente_2026.pdf'
const TEST_SOURCE_APP = 'Microsoft Word'
const TEST_SHORTCUT = 'CommandOrControl+Alt+S'

type RendererRoute = '/settings' | '/suggestion' | '/onboarding'

let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let suggestionWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let currentSuggestion: SuggestionPayload | null = null
let restoreAfterSuggestion: 'settings' | 'onboarding' | null = null

function rendererUrl(route: RendererRoute): string {
  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    return `${devServer.replace(/\/$/, '')}/#${route}`
  }
  return `file://${path.join(__dirname, '../dist/index.html')}#${route}`
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

function buildSuggestion(fileName: string, sourceApp: string): SuggestionPayload {
  const settings = loadSettings()
  return {
    fileName,
    sourceApp,
    currentFolder: 'Current folder — simulated Save As location',
    recommendations: recommendFolders({
      fileName,
      sourceApp,
      favouriteFolders: settings.favouriteFolders,
    }),
  }
}

async function createSettingsWindow(): Promise<BrowserWindow> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    minWidth: 560,
    minHeight: 520,
    title: 'SuHuella',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#A7D8F9',
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

  settingsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      settingsWindow?.hide()
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  await settingsWindow.loadURL(rendererUrl('/settings'))
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
    title: 'Welcome to SuHuella',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#A7D8F9',
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
    }
  })

  onboardingWindow.on('closed', () => {
    onboardingWindow = null
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

async function showSettingsWindow(): Promise<void> {
  hideOnboardingWindow()
  if (isWindowVisible(suggestionWindow)) {
    closeSuggestionWindow({ restore: false })
  }
  const window = await createSettingsWindow()
  window.show()
  window.focus()
}

async function showOnboardingWindow(): Promise<void> {
  hideSettingsWindow()
  if (isWindowVisible(suggestionWindow)) {
    closeSuggestionWindow({ restore: false })
  }
  const window = await createOnboardingWindow()
  window.show()
  window.focus()
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
    backgroundColor: '#00000000',
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

  suggestionWindow.on('closed', () => {
    suggestionWindow = null
  })

  await suggestionWindow.loadURL(rendererUrl('/suggestion'))
  return suggestionWindow
}

async function showSuggestionWindow(
  payload: SuggestionPayload,
  options?: { restoreOnClose?: 'settings' | 'onboarding' },
): Promise<void> {
  if (isWindowVisible(suggestionWindow)) {
    return
  }

  currentSuggestion = payload
  restoreAfterSuggestion = options?.restoreOnClose ?? null

  hideSettingsWindow()
  hideOnboardingWindow()

  const window = await createSuggestionWindow()
  positionSuggestionWindow(window)
  window.webContents.send('suggestion:updated', payload)
  window.show()
  window.focus()
}

async function showTestSuggestion(): Promise<void> {
  if (isWindowVisible(suggestionWindow)) {
    return
  }

  const restoreOnClose = isWindowVisible(onboardingWindow)
    ? 'onboarding'
    : isWindowVisible(settingsWindow)
      ? 'settings'
      : undefined

  await showSuggestionWindow(buildSuggestion(TEST_FILE_NAME, TEST_SOURCE_APP), {
    restoreOnClose,
  })
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

function showWelcomeNotification(): void {
  if (!Notification.isSupported()) {
    return
  }

  const options: Electron.NotificationConstructorOptions = {
    title: 'SuHuella is now running in the background.',
    body: 'SuHuella is now running in the background.',
  }

  if (process.platform === 'win32') {
    options.actions = [
      { type: 'button', text: 'Open Settings' },
      { type: 'button', text: 'Later' },
    ]
  }

  const notification = new Notification(options)
  notification.on('click', () => {
    void openSettingsOrOnboarding()
  })
  notification.on('action', (_event, index) => {
    if (index === 0) {
      void openSettingsOrOnboarding()
    }
  })
  notification.show()
}

function createTray(): void {
  tray = new Tray(createTrayImage())
  tray.setToolTip('SuHuella')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Settings',
        click: () => {
          void openSettingsOrOnboarding()
        },
      },
      {
        label: 'Preview Suggestions',
        accelerator: TEST_SHORTCUT,
        click: () => {
          void showTestSuggestion()
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => {
    if (process.platform === 'win32') {
      void openSettingsOrOnboarding()
    }
  })
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:getPath', () => getSettingsFilePath())
  ipcMain.handle('app:getInfo', () => ({
    name: 'SuHuella',
    version: app.getVersion(),
  }))

  ipcMain.handle('settings:addFolder', async (event) => {
    const result = await pickDirectory(
      BrowserWindow.fromWebContents(event.sender),
      'Add favourite folder',
    )
    if (result.canceled || result.filePaths.length === 0) {
      return loadSettings()
    }
    return addFavouriteFolder(result.filePaths[0])
  })

  ipcMain.handle('settings:removeFolder', (_event, folder: unknown) => {
    if (typeof folder !== 'string') return loadSettings()
    return removeFavouriteFolder(folder)
  })

  ipcMain.handle('settings:setLaunchAtLogin', (_event, enabled: unknown) => {
    return persistLaunchAtLogin(Boolean(enabled))
  })

  ipcMain.handle('settings:revealFile', async () => {
    const filePath = getSettingsFilePath()
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('onboarding:finish', () => {
    const settings = markFirstRunCompleted()
    hideOnboardingWindow()
    return settings
  })

  ipcMain.handle('suggestion:test', async () => {
    await showTestSuggestion()
  })

  ipcMain.handle('suggestion:get', () => currentSuggestion)

  ipcMain.handle('suggestion:choose', async (_event, folder: unknown) => {
    if (typeof folder === 'string') {
      console.log(`[suhuella] mock choose folder: ${folder}`)
    }
    closeSuggestionWindow()
  })

  ipcMain.handle('suggestion:chooseAnother', async (event) => {
    const result = await pickDirectory(
      BrowserWindow.fromWebContents(event.sender),
      'Choose another folder',
    )
    if (!result.canceled && result.filePaths[0]) {
      addFavouriteFolder(result.filePaths[0])
      console.log(`[suhuella] mock choose another folder: ${result.filePaths[0]}`)
    }
    closeSuggestionWindow()
    return loadSettings()
  })

  ipcMain.handle('suggestion:close', () => {
    closeSuggestionWindow()
  })
}

function registerShortcuts(): void {
  globalShortcut.register(TEST_SHORTCUT, () => {
    void showTestSuggestion()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    void openSettingsOrOnboarding()
  })

  app.setName('SuHuella')

  app.whenReady().then(() => {
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null)
    }

    if (process.platform === 'darwin') {
      app.dock?.hide()
    }

    registerIpc()
    createTray()
    registerShortcuts()

    const settings = loadSettings()
    applyLaunchAtLogin(settings.launchAtLogin)

    if (!settings.firstRunCompleted && !settings.welcomeNotificationShown) {
      showWelcomeNotification()
      markWelcomeNotificationShown()
    }
  })
}

app.on('before-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Stay in the tray until the user quits.
})

app.on('activate', () => {
  void openSettingsOrOnboarding()
})
