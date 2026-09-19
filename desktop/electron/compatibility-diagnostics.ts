import type {
  CompatibilityAttempt,
  CompatibilityDiagnostics,
  NavigationMethod,
} from '../src/types.ts'
import { formatSourceApp, isDevelopmentMode, logDev } from './save-dialog-watcher.ts'

const MAX_ATTEMPTS = 50

const attempts: CompatibilityAttempt[] = []

function now(): string {
  return new Date().toISOString()
}

export function recordDetectionAttempt(input: {
  processName: string
  windowTitle: string
  className: string
  fileName: string
  currentFolder: string
  windowHandle: string
  detected: boolean
  recommendationCount: number
  failureReason?: string
}): CompatibilityAttempt {
  const attempt: CompatibilityAttempt = {
    timestamp: now(),
    appName: formatSourceApp(input.processName) || input.windowTitle || input.processName,
    processName: input.processName,
    windowTitle: input.windowTitle,
    className: input.className,
    windowHandle: input.windowHandle,
    detected: input.detected,
    filenameExtracted: Boolean(input.fileName.trim()),
    currentFolderExtracted: Boolean(input.currentFolder.trim()),
    windowHandlePresent: Boolean(input.windowHandle.trim()),
    recommendationCount: input.recommendationCount,
    navigationAttempted: false,
    navigationMethod: null,
    navigationSucceeded: false,
    failureReason: input.failureReason ?? '',
  }

  attempts.push(attempt)
  if (attempts.length > MAX_ATTEMPTS) {
    attempts.shift()
  }

  logDev(
    `compat detect app="${attempt.appName}" title="${attempt.windowTitle}" class="${attempt.className}" file=${attempt.filenameExtracted} folder=${attempt.currentFolderExtracted} hwnd=${attempt.windowHandlePresent} reason="${attempt.failureReason}"`,
  )

  return attempt
}

export function recordNavigationAttempt(input: {
  method?: NavigationMethod | null
  succeeded: boolean
  failureReason?: string
}): void {
  const attempt = attempts[attempts.length - 1]
  if (!attempt || !attempt.detected) {
    return
  }

  attempt.navigationAttempted = true
  attempt.navigationMethod = input.method ?? (input.succeeded ? 'UIAutomation' : 'Failed')
  attempt.navigationSucceeded = input.succeeded
  attempt.failureReason = input.succeeded ? '' : input.failureReason || 'Could not navigate automatically.'

  logDev(
    `compat navigate method=${attempt.navigationMethod} ok=${attempt.navigationSucceeded} reason="${attempt.failureReason}"`,
  )
}

export function getCompatibilityDiagnostics(): CompatibilityDiagnostics {
  return {
    development: isDevelopmentMode(),
    attemptCount: attempts.length,
    lastAttempt: attempts[attempts.length - 1] ?? null,
    attempts: [...attempts],
  }
}

export function buildCompatibilityExport(version: string): string {
  return `${JSON.stringify(
    {
      exportedAt: now(),
      suhuellaVersion: version,
      development: isDevelopmentMode(),
      note: 'Diagnostics for support. No document contents. Exported only when you choose.',
      attempts,
    },
    null,
    2,
  )}\n`
}
