import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { brand } from '@suhuella/brand'
import type { NavigationMethod } from '../src/types.ts'

export type SaveDialogOpenedEvent = {
  type: 'save-dialog-opened'
  windowTitle: string
  processName: string
  fileName: string
  extension: string
  currentFolder: string
  windowHandle: string
  className: string
  filenameFieldFound: boolean
  currentFolderFound: boolean
  automationHints: string
  timestamp: string
}

export type SaveDialogClosedEvent = {
  type: 'save-dialog-closed'
  windowHandle: string
  timestamp: string
}

export type SaveDialogIgnoredEvent = {
  type: 'save-dialog-ignored'
  windowTitle: string
  processName: string
  className: string
  windowHandle: string
  reason: string
  timestamp: string
}

export type NavigateFolderResult = {
  ok: boolean
  folder: string
  error?: string
  method?: NavigationMethod
}

type NavigateResultEvent = {
  type: 'navigate-result'
  requestId: string
  ok: boolean
  windowHandle: string
  folder: string
  error: string
  navigationMethod: NavigationMethod
}

export type SaveDialogWatcherHandle = {
  stop: () => void
  navigateFolder: (windowHandle: string, folder: string) => Promise<NavigateFolderResult>
}

const HELPER_FILE_NAME = 'SuhuellaSaveWatcher.exe'
const RESTART_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]
const NAVIGATE_TIMEOUT_MS = 900

const PROCESS_APP_NAMES: Record<string, string> = {
  winword: 'Microsoft Word',
  excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  acrord32: 'Adobe Acrobat',
  acrobat: 'Adobe Acrobat',
  notepad: 'Notepad',
  notepad3: 'Notepad',
  'notepad++': 'Notepad++',
  explorer: 'Explorer',
  code: 'Visual Studio Code',
  devenv: 'Visual Studio',
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  photos: 'Photos',
  paint: 'Paint',
  wordpad: 'WordPad',
}

export function formatSourceApp(processName: string): string {
  const key = processName.trim().toLowerCase()
  if (!key) return ''
  return PROCESS_APP_NAMES[key] ?? processName
}

export function isDevelopmentMode(): boolean {
  return !app.isPackaged || process.env.SUHUELLA_DEV === '1' || Boolean(process.env.VITE_DEV_SERVER_URL)
}

export function logDev(message: string, extra?: unknown): void {
  if (!isDevelopmentMode()) return
  if (extra === undefined) {
    console.log(`[suhuella] ${message}`)
    return
  }
  console.log(`[suhuella] ${message}`, extra)
}

function helperCandidates(): string[] {
  const override = process.env.SUHUELLA_SAVE_WATCHER
  const candidates = [
    override,
    path.join(process.resourcesPath, 'win-save-watcher', HELPER_FILE_NAME),
    path.join(app.getAppPath(), 'native', 'win-save-watcher', 'publish', HELPER_FILE_NAME),
    path.join(__dirname, '..', 'native', 'win-save-watcher', 'publish', HELPER_FILE_NAME),
    path.join(__dirname, '..', 'native', 'win-save-watcher', 'bin', 'Release', HELPER_FILE_NAME),
    path.join(__dirname, '..', 'native', 'win-save-watcher', 'bin', 'Debug', HELPER_FILE_NAME),
  ]

  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

function resolveHelperPath(): string | null {
  for (const candidate of helperCandidates()) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

function asTextField(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function asNavigationMethod(value: unknown): NavigationMethod {
  const method = asTextField(value)
  if (
    method === 'UIAutomation' ||
    method === 'AddressBar' ||
    method === 'CtrlL' ||
    method === 'AltD' ||
    method === 'PasteEnter'
  ) {
    return method
  }
  return 'Failed'
}

function normalizeOpened(value: Record<string, unknown>): SaveDialogOpenedEvent {
  const fileName = asTextField(value.fileName)
  const currentFolder = asTextField(value.currentFolder)
  return {
    type: 'save-dialog-opened',
    windowTitle: asTextField(value.windowTitle),
    processName: asTextField(value.processName),
    fileName,
    extension: asTextField(value.extension) || extensionOf(fileName),
    currentFolder,
    windowHandle: asTextField(value.windowHandle),
    className: asTextField(value.className),
    filenameFieldFound: asBoolean(value.filenameFieldFound) || Boolean(fileName),
    currentFolderFound: asBoolean(value.currentFolderFound) || Boolean(currentFolder),
    automationHints: asTextField(value.automationHints),
    timestamp: asTextField(value.timestamp) || new Date().toISOString(),
  }
}

function normalizeClosed(value: Record<string, unknown>): SaveDialogClosedEvent {
  return {
    type: 'save-dialog-closed',
    windowHandle: asTextField(value.windowHandle),
    timestamp: asTextField(value.timestamp) || new Date().toISOString(),
  }
}

function normalizeIgnored(value: Record<string, unknown>): SaveDialogIgnoredEvent {
  return {
    type: 'save-dialog-ignored',
    windowTitle: asTextField(value.windowTitle),
    processName: asTextField(value.processName),
    className: asTextField(value.className),
    windowHandle: asTextField(value.windowHandle),
    reason: asTextField(value.reason),
    timestamp: asTextField(value.timestamp) || new Date().toISOString(),
  }
}

function normalizeNavigateResult(value: Record<string, unknown>): NavigateResultEvent {
  return {
    type: 'navigate-result',
    requestId: asTextField(value.requestId),
    ok: value.ok === true,
    windowHandle: asTextField(value.windowHandle),
    folder: asTextField(value.folder),
    error: asTextField(value.error),
    navigationMethod: asNavigationMethod(value.navigationMethod),
  }
}

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function attachLineReader(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index !== -1) {
      const line = buffer.slice(0, index).replace(/\r$/, '').trim()
      buffer = buffer.slice(index + 1)
      if (line) onLine(line)
      index = buffer.indexOf('\n')
    }
  })
}

function unavailableHandle(): SaveDialogWatcherHandle {
  return {
    stop() {},
    async navigateFolder(_windowHandle, folder) {
      return {
        ok: false,
        folder,
        error: 'Could not navigate automatically.',
        method: 'Failed',
      }
    },
  }
}

export function startSaveDialogWatcher(handlers: {
  onOpened: (event: SaveDialogOpenedEvent) => void
  onClosed: (event: SaveDialogClosedEvent) => void
  onIgnored?: (event: SaveDialogIgnoredEvent) => void
}): SaveDialogWatcherHandle {
  // TODO(macos): Launch a native helper that uses the Accessibility Framework
  // (AXUIElement). Observe kAXWindowCreatedNotification or
  // kAXFocusedWindowChangedNotification, detect Save / Save As sheets, read the
  // proposed file name and source app from the AX tree, and emit the same JSON
  // lines. Folder navigation would use Cmd+Shift+G / AX path field. macOS
  // requires an explicit Accessibility grant. App Store distribution is not
  // possible; ship a signed .dmg instead.
  if (process.platform !== 'win32') {
    logDev(`save-dialog watcher skipped on ${process.platform}`)
    return unavailableHandle()
  }

  const helperPath = resolveHelperPath()
  if (!helperPath) {
    console.warn(
      '[suhuella] Windows save-dialog helper not found. Build it on Windows with npm run publish:win-helper. Preview Save As is available in development only.',
    )
    return unavailableHandle()
  }

  let child: ChildProcess | null = null
  let stopped = false
  let restartAttempt = 0
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0
  const pending = new Map<
    string,
    { resolve: (result: NavigateFolderResult) => void; timer: ReturnType<typeof setTimeout> }
  >()

  const failPending = (error: string) => {
    for (const [id, waiter] of pending) {
      clearTimeout(waiter.timer)
      waiter.resolve({ ok: false, folder: '', error, method: 'Failed' })
      pending.delete(id)
    }
  }

  const spawnHelper = () => {
    if (stopped) return

    const args = isDevelopmentMode() ? ['--dev'] : []
    logDev(`launching save-dialog helper ${helperPath}`)

    let nextChild: ChildProcess
    try {
      nextChild = spawn(helperPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          PRODUCT_PROCESS_TOKEN: brand.desktopProtocol,
        },
      })
    } catch (error) {
      console.warn('[suhuella] failed to spawn save-dialog helper', error)
      scheduleRestart()
      return
    }

    child = nextChild
    nextChild.stdout?.setEncoding('utf8')
    nextChild.stderr?.setEncoding('utf8')
    nextChild.stdin?.setDefaultEncoding('utf8')

    if (nextChild.stdout) {
      attachLineReader(nextChild.stdout, (line) => {
        try {
          const parsed: unknown = JSON.parse(line)
          if (!parsed || typeof parsed !== 'object') {
            logDev('ignored helper line', line)
            return
          }

          const record = parsed as Record<string, unknown>
          if (record.type === 'save-dialog-opened') {
            handlers.onOpened(normalizeOpened(record))
            return
          }
          if (record.type === 'save-dialog-closed') {
            handlers.onClosed(normalizeClosed(record))
            return
          }
          if (record.type === 'save-dialog-ignored') {
            handlers.onIgnored?.(normalizeIgnored(record))
            return
          }
          if (record.type === 'navigate-result') {
            const result = normalizeNavigateResult(record)
            const waiter = pending.get(result.requestId)
            if (!waiter) return
            clearTimeout(waiter.timer)
            pending.delete(result.requestId)
            waiter.resolve({
              ok: result.ok,
              folder: result.folder,
              error: result.ok ? undefined : result.error || 'Could not navigate automatically.',
              method: result.navigationMethod,
            })
            return
          }

          logDev('ignored helper line', line)
        } catch (error) {
          logDev('failed to parse helper JSON line', error)
        }
      })
    }

    nextChild.stderr?.on('data', (chunk: string) => {
      if (isDevelopmentMode()) {
        const text = chunk.trim()
        if (text) console.log(text)
      }
    })

    nextChild.on('error', (error) => {
      console.warn('[suhuella] save-dialog helper error', error)
    })

    nextChild.on('exit', (code, signal) => {
      child = null
      failPending('Could not navigate automatically.')
      if (stopped) return
      logDev(`save-dialog helper exited code=${code} signal=${signal ?? ''}`)
      scheduleRestart()
    })
  }

  const scheduleRestart = () => {
    if (stopped || restartTimer) return
    const delay = RESTART_DELAYS_MS[Math.min(restartAttempt, RESTART_DELAYS_MS.length - 1)]
    restartAttempt += 1
    restartTimer = setTimeout(() => {
      restartTimer = null
      spawnHelper()
    }, delay)
  }

  spawnHelper()

  return {
    stop() {
      stopped = true
      if (restartTimer) {
        clearTimeout(restartTimer)
        restartTimer = null
      }
      failPending('Could not navigate automatically.')
      if (child && !child.killed) {
        child.kill()
      }
      child = null
    },
    navigateFolder(windowHandle, folder) {
      return new Promise((resolve) => {
        if (!child?.stdin) {
          resolve({
            ok: false,
            folder,
            error: 'Could not navigate automatically.',
            method: 'Failed',
          })
          return
        }

        const id = String(++requestId)
        const timer = setTimeout(() => {
          pending.delete(id)
          resolve({
            ok: false,
            folder,
            error: 'Could not navigate automatically.',
            method: 'Failed',
          })
        }, NAVIGATE_TIMEOUT_MS)

        pending.set(id, { resolve, timer })

        const command = JSON.stringify({
          type: 'navigate-folder',
          requestId: id,
          windowHandle,
          folder,
        })

        try {
          child.stdin.write(`${command}\n`)
          logDev(`navigate-folder hwnd=${windowHandle} folder=${folder}`)
        } catch (error) {
          clearTimeout(timer)
          pending.delete(id)
          logDev('failed to write navigate command', error)
          resolve({
            ok: false,
            folder,
            error: 'Could not navigate automatically.',
            method: 'Failed',
          })
        }
      })
    },
  }
}
