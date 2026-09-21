import { brand, siteOrigin, siteUrl } from '@suhuella/brand'
import { useEffect, useState, type ReactNode } from 'react'
import { getSuhuellaApi, invokeSuhuella } from '../lib/api'
import { settingsPrefsFromLocation, writeProductLocation } from '../lib/app-routes'
import { capabilitiesOf } from '../host/capabilities'
import { displayComputerName } from '../lib/folders-ui'
import { BYOK_ASSISTANTS } from '../lib/byok-assistants'
import type {
  AppInfo,
  AppSettings,
  ByokAssistantId,
  ByokStatus,
  CompatibilityDiagnostics,
  DeviceMetrics,
  LicenseStatusView,
  StorageUsage,
} from '../types'
import {
  AnthropicLogo,
  CompatibleApiLogo,
  LocalIntelligenceLogo,
  LocalServerLogo,
  OpenAiLogo,
} from './ByokAssistantLogos'
import { DeviceMetricsPanel } from './HomeHealthCards'
import { LicenseStatusPanel } from './LicenseStatusPanel'
import { useProductBrandIdentity } from './AppBrandingContext'
import { BrandMark } from './BrandMark'
import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { HOST_ACTION_COPY, isHostCapabilityError } from '../lib/host-action-copy'
import { deriveDisplayVersion } from '../lib/display-version'
import type { ReleaseDecision } from '../lib/release-lifecycle'

type PreferencesPanelProps = {
  appInfo: AppInfo
  settings: AppSettings | null
  saveAsActive: boolean
  license?: LicenseStatusView | null
  metrics?: DeviceMetrics | null
  metricsLoading?: boolean
  onLaunchAtLoginChange: (enabled: boolean) => void
  onRebuildFolders: () => void
  onActivityCleared?: () => void
  onRefreshMetrics?: () => void
}

const WEBSITE = siteOrigin()
const PRIVACY_URL = siteUrl('/privacidad')
const SUPPORT_EMAIL = brand.supportEmail

function openExternal(url: string) {
  window.open(url)
}

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
      {children}
    </div>
  )
}

function QuietCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-white/60 bg-white/45 p-5 backdrop-blur-xl">{children}</div>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-[var(--brand-accent)] hover:underline"
      onClick={(event) => {
        event.preventDefault()
        openExternal(href)
      }}
    >
      {children}
    </a>
  )
}

function compatibilitySummary(
  appInfo: AppInfo,
  diagnostics: CompatibilityDiagnostics | null,
): string {
  if (!capabilitiesOf(appInfo).saveAs && !capabilitiesOf(appInfo).nativeDialogs) {
    return 'Save As is not active on this device.'
  }
  if (appInfo.platform !== 'win32') {
    return 'Save suggestions work in preview on this Mac. Full Save As is for Windows.'
  }

  if (!diagnostics?.lastAttempt) {
    return 'Save As has not been used yet on this computer. If something does not work, export diagnostics and contact support.'
  }

  const app = diagnostics.lastAttempt.appName
  if (diagnostics.lastAttempt.navigationSucceeded) {
    return `The last Save As check in ${app} worked on this computer.`
  }

  if (diagnostics.lastAttempt.detected) {
    return `The last Save As check in ${app} needs attention. Export diagnostics and contact support if suggestions are not appearing.`
  }

  return productCopy('SuHuella could not read the last Save As dialog. Export diagnostics if you need help.')
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function GeneralSection({
  settings,
  appInfo,
  license,
  onLaunchAtLoginChange,
}: {
  settings: AppSettings | null
  appInfo: AppInfo
  license?: LicenseStatusView | null
  onLaunchAtLoginChange: (enabled: boolean) => void
}) {
  const caps = capabilitiesOf(appInfo)
  const { locale, setLocale, t } = useAppLocale()
  const computerName = displayComputerName({
    osName: appInfo.computerName,
    licenseName: license?.computerName,
    platform: appInfo.platform,
  })
  const saveAsLabel = caps.saveAs
    ? 'Available'
    : appInfo.platform === 'darwin' && caps.nativeDialogs
      ? 'Preview available'
      : null

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-slate-900">{t.computer}</h2>
        <dl className="mt-3">
          <SettingsRow label={t.name} value={computerName} />
          <SettingsRow
            label={t.operatingSystem}
            value={
              appInfo.osVersion ||
              (appInfo.platform === 'darwin' ? 'macOS' : appInfo.platform === 'win32' ? 'Windows' : 'Linux')
            }
          />
        </dl>
        <div className="mt-4 border-t border-slate-200/70 pt-4">
          <p className="text-sm font-medium text-slate-800">{t.language}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.languageHint}</p>
          <div className="mt-3 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1">
            {(['es', 'en'] as const).map((option) => {
              const active = locale === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all duration-200 ${
                    active
                      ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-pressed={active}
                  aria-label={option === 'es' ? 'Español' : 'English'}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {caps.tray ? (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Startup</h2>
          <label className="mt-3 flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3.5 shadow-sm">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">
                {productCopy('Launch SuHuella when I sign in')}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {productCopy(
                  'SuHuella opens when you sign in. Close the window to keep it in the menu bar.',
                )}
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[var(--brand-accent)] accent-[var(--brand-accent)]"
              checked={settings?.launchAtLogin ?? true}
              onChange={(event) => onLaunchAtLoginChange(event.target.checked)}
            />
          </label>
        </Card>
      ) : null}

      {saveAsLabel ? (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Save As</h2>
          <dl className="mt-3">
            <SettingsRow label="On this computer" value={saveAsLabel} />
          </dl>
        </Card>
      ) : null}
    </div>
  )
}

function AssistantLogo({ id }: { id: ByokAssistantId | 'local_intelligence' }) {
  if (id === 'openai') return <OpenAiLogo />
  if (id === 'anthropic') return <AnthropicLogo />
  if (id === 'compatible_api') return <CompatibleApiLogo />
  if (id === 'local_server') return <LocalServerLogo />
  return <LocalIntelligenceLogo />
}

function AiSection() {
  const [status, setStatus] = useState<ByokStatus | null>(null)
  const [connecting, setConnecting] = useState<ByokAssistantId | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void invokeSuhuella('getByokStatus')
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  function openConnect(assistant: ByokAssistantId) {
    const definition = BYOK_ASSISTANTS.find((item) => item.id === assistant)
    setConnecting(assistant)
    setApiKey('')
    setModel(definition?.defaultModel ?? '')
    setBaseUrl(definition?.defaultBaseUrl ?? '')
    setError(null)
  }

  async function connect() {
    if (!connecting) return
    setBusy(true)
    setError(null)
    try {
      const result = await getSuhuellaApi().connectByok({
        assistant: connecting,
        apiKey,
        model: model.trim() || undefined,
        baseUrl: BYOK_ASSISTANTS.find((item) => item.id === connecting)?.needsBaseUrl
          ? baseUrl.trim()
          : undefined,
      })
      if (result.ok) {
        setStatus(result.status)
        setConnecting(null)
        setApiKey('')
      } else {
        setError(result.error)
      }
    } catch {
      setError('Could not save your assistant on this computer.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      setStatus(await getSuhuellaApi().disconnectByok())
      setConnecting(null)
    } catch {
      setError('Could not disconnect this assistant.')
    } finally {
      setBusy(false)
    }
  }

  const connectedAssistant = status?.connected ? status.assistant : null

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <LocalIntelligenceLogo />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">On-device intelligence</h2>
              <span className="text-sm font-medium text-emerald-700">Always available</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Private. Runs on this computer. Does not change the Recommendation Engine.
            </p>
          </div>
        </div>
      </Card>

      <p className="text-sm font-medium text-slate-800">Your own AI</p>
      <p className="text-sm leading-relaxed text-slate-500">
        Optional. You pay your provider. The assistant may use it to explain a Plan. It never
        {productCopy('teaches SuHuella and never ranks folders.')}
      </p>

      <ul className="space-y-2">
        {BYOK_ASSISTANTS.map((assistant) => {
          const isConnected = connectedAssistant === assistant.id
          const isOpen = connecting === assistant.id
          return (
            <li
              key={assistant.id}
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <AssistantLogo id={assistant.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{assistant.label}</p>
                    <span className="text-right">
                      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </span>
                      <span
                        className={`block text-sm font-medium ${
                          isConnected ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {loading ? '…' : isConnected ? 'Ready' : 'Not connected'}
                      </span>
                      {isConnected ? (
                        <span className="block text-xs font-medium text-slate-500">
                          Using your account
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{assistant.description}</p>
                  {isConnected ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void disconnect()}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : isOpen ? (
                    <div className="mt-3 space-y-3">
                      <label className="block text-sm">
                        <span className="font-medium text-slate-800">API key</span>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          autoComplete="off"
                          placeholder="Paste your key"
                          className="mt-1 w-full rounded-2xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-800"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-slate-800">Model</span>
                        <input
                          type="text"
                          value={model}
                          onChange={(event) => setModel(event.target.value)}
                          placeholder={assistant.defaultModel || 'Required'}
                          className="mt-1 w-full rounded-2xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-800"
                        />
                      </label>
                      {assistant.needsBaseUrl ? (
                        <label className="block text-sm">
                          <span className="font-medium text-slate-800">
                            {assistant.localhostOnly ? 'Local server URL' : 'API URL'}
                          </span>
                          <input
                            type="url"
                            value={baseUrl}
                            onChange={(event) => setBaseUrl(event.target.value)}
                            placeholder={
                              assistant.localhostOnly
                                ? 'http://localhost:11434/v1'
                                : 'https://…'
                            }
                            className="mt-1 w-full rounded-2xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-800"
                          />
                        </label>
                      ) : null}
                      <p className="text-xs leading-relaxed text-slate-500">
                        {productCopy('Your AI key stays on this computer. SuHuella never stores it in the cloud.')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !apiKey.trim()}
                          onClick={() => void connect()}
                          className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {busy ? 'Connecting…' : 'Connect'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConnecting(null)}
                          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || Boolean(connectedAssistant) || loading}
                      onClick={() => openConnect(assistant.id)}
                      className="mt-3 text-sm font-semibold text-[var(--brand-accent)] hover:underline disabled:opacity-60"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  )
}

function PrivacySection() {
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Everything stays on your device</h2>
      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
        <li>Your documents stay on this device or in the provider you choose.</li>
        <li>{productCopy('SuHuella does not upload your documents.')}</li>
        <li>The Knowledge Index stays on this device.</li>
      </ul>
      <p className="mt-4 text-sm">
        <ExternalLink href={PRIVACY_URL}>Privacy policy</ExternalLink>
      </p>
    </Card>
  )
}

export function StorageManageSection({
  onRebuildFolders,
  onActivityCleared,
  onStorageChanged,
}: {
  onRebuildFolders: () => void
  onActivityCleared?: () => void
  onStorageChanged?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClearActivity, setConfirmClearActivity] = useState(false)

  async function runAction(label: string, action: () => Promise<StorageUsage>, done: string) {
    setBusy(label)
    setError(null)
    setMessage(null)
    try {
      await action()
      setMessage(done)
      onStorageChanged?.()
    } catch {
      setError('That could not be completed. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-5">
      <QuietCard>
        <h2 className="text-base font-semibold text-slate-900">Manage</h2>
        <p className="mt-1.5 mb-4 text-sm leading-relaxed text-slate-500">
          Use a specific action. There is no button that deletes everything at once.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void runAction('cache', () => getSuhuellaApi().clearCache(), 'Cache cleared.')}
            className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {busy === 'cache' ? 'Clearing…' : 'Clear cache'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onRebuildFolders}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Rebuild index
          </button>
          {confirmClearActivity ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3">
              <p className="text-sm font-semibold text-rose-900">Clear activity history?</p>
              <p className="mt-1 text-sm leading-relaxed text-rose-800">
                This removes what happened from this computer. It does not undo documents.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    void runAction(
                      'activity',
                      () => getSuhuellaApi().clearActivityHistory(),
                      'Activity history cleared.',
                    ).then(() => {
                      setConfirmClearActivity(false)
                      onActivityCleared?.()
                    })
                  }}
                  className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busy === 'activity' ? 'Clearing…' : 'Clear activity history'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => setConfirmClearActivity(false)}
                  className="rounded-full border border-white bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setConfirmClearActivity(true)}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Clear activity history
            </button>
          )}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void runAction('logs', () => getSuhuellaApi().clearLogs(), 'Logs cleared.')}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy === 'logs' ? 'Clearing…' : 'Clear logs'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              setBusy('export')
              setError(null)
              setMessage(null)
              void getSuhuellaApi()
                .exportActivity()
                .then((filePath) => {
                  setMessage(filePath ? `Activity exported as ${fileNameFromPath(filePath)}.` : null)
                })
                .catch((error: unknown) => {
                  setError(
                    isHostCapabilityError(error)
                      ? HOST_ACTION_COPY.exportUnavailable
                      : 'Could not export activity.',
                  )
                })
                .finally(() => setBusy(null))
            }}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy === 'export' ? 'Exporting…' : 'Export activity'}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </QuietCard>
    </div>
  )
}

const SETTINGS_TAB_IDS = [
  'general',
  'ai',
  'license',
  'privacy',
  'notifications',
  'diagnostics',
  'about',
] as const

export type SettingsTab = (typeof SETTINGS_TAB_IDS)[number]

const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  folders: 'general',
  connections: 'general',
  storage: 'diagnostics',
}

function resolveSettingsTab(requested: string): SettingsTab {
  if (SETTINGS_TAB_IDS.includes(requested as SettingsTab)) return requested as SettingsTab
  return LEGACY_SETTINGS_TABS[requested] ?? 'general'
}

function initialSettingsTab(): SettingsTab {
  return resolveSettingsTab(settingsPrefsFromLocation(window.location))
}

export function SettingsPanel({
  appInfo,
  settings,
  saveAsActive,
  license,
  metrics,
  metricsLoading,
  onLaunchAtLoginChange,
  onRebuildFolders,
  onActivityCleared,
  onRefreshMetrics,
}: PreferencesPanelProps) {
  const { t } = useAppLocale()
  const [tab, setTab] = useState<SettingsTab>(initialSettingsTab)

  useEffect(() => {
    const syncTab = () => setTab(initialSettingsTab())
    window.addEventListener('hashchange', syncTab)
    window.addEventListener('popstate', syncTab)
    return () => {
      window.removeEventListener('hashchange', syncTab)
      window.removeEventListener('popstate', syncTab)
    }
  }, [])

  function go(next: SettingsTab) {
    setTab(next)
    writeProductLocation('settings', next)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.settings}</h1>
        <p className="mt-2 text-[15px] text-[var(--app-fg)] opacity-70">{t.settingsIntro}</p>
      </header>
      <nav className="flex flex-wrap gap-1.5">
        {SETTINGS_TAB_IDS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              tab === item
                ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)]'
                : 'bg-[var(--overlay-row)] text-[var(--app-fg)] opacity-70 ring-1 ring-[var(--sidebar-line)] hover:opacity-100'
            }`}
          >
            {t[item]}
          </button>
        ))}
      </nav>

      {tab === 'general' ? (
        <GeneralSection
          settings={settings}
          appInfo={appInfo}
          license={license}
          onLaunchAtLoginChange={onLaunchAtLoginChange}
        />
      ) : null}
      {tab === 'ai' ? <AiSection /> : null}
      {tab === 'license' ? <LicenseStatusPanel /> : null}
      {tab === 'privacy' ? <PrivacySection /> : null}
      {tab === 'notifications' ? (
        <NotificationsSection saveAsActive={saveAsActive} notifyWhenSave={capabilitiesOf(appInfo).notifications} />
      ) : null}
      {tab === 'diagnostics' ? (
        <div className="space-y-4">
          <DeviceMetricsPanel
            metrics={metrics ?? null}
            loading={metricsLoading}
            onRefresh={() => onRefreshMetrics?.()}
          />
          <DiagnosticsSection appInfo={appInfo} />
          <StorageManageSection
            onRebuildFolders={onRebuildFolders}
            onActivityCleared={onActivityCleared}
            onStorageChanged={onRefreshMetrics}
          />
        </div>
      ) : null}
      {tab === 'about' ? <AboutSection appInfo={appInfo} /> : null}
    </div>
  )
}

type NotificationEntry = {
  label: string
  status: string
  detail: string
}

function NotificationsSection({ saveAsActive, notifyWhenSave }: { saveAsActive: boolean; notifyWhenSave?: boolean }) {
  const items: NotificationEntry[] = []
  if (notifyWhenSave) {
    items.push({
      label: 'Save As recommendation',
      status: saveAsActive ? 'Available' : 'Preview available',
      detail: '',
    })
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
      {items.length > 0 ? (
        <>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm"
            >
              <span className="font-medium text-slate-800">{item.label}</span>
              <span
                className={`font-medium ${item.status === 'Available' ? 'text-emerald-700' : 'text-slate-500'}`}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Activity records confirmed Plans. Save As prepares the folder; you press Save in the other app.
        </p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Save As recommendations appear on the desktop app. This browser does not show those
          notifications.
        </p>
      )}
    </Card>
  )
}

function DiagnosticsSection({ appInfo }: { appInfo: AppInfo }) {
  const [diagnostics, setDiagnostics] = useState<CompatibilityDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportPath, setExportPath] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    void getSuhuellaApi()
      .getCompatibilityDiagnostics()
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null))
      .finally(() => setLoading(false))
  }, [])

  const platformLabel =
    appInfo.osVersion ||
    (appInfo.platform === 'darwin' ? 'macOS' : appInfo.platform === 'win32' ? 'Windows' : 'Linux')

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Support diagnostics</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          If Save As suggestions are not working, export a file for support. It describes how
          {productCopy('SuHuella detected Save As dialogs — not your documents.')}
        </p>
        <dl className="mt-4 grid gap-2 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Version</dt>
            <dd className="font-semibold text-slate-900">{shownVersion(appInfo.version)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Build</dt>
            <dd className="font-semibold text-slate-900">{shownVersion(appInfo.buildVersion)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Platform</dt>
            <dd className="font-semibold text-slate-900">{platformLabel}</dd>
          </div>
        </dl>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Checking Save As…</p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {compatibilitySummary(appInfo, diagnostics)}
          </p>
        )}
        <div className="mt-4">
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setExporting(true)
              setExportError(null)
              void getSuhuellaApi()
                .exportCompatibilityDiagnostics()
                .then((filePath) => {
                  if (filePath) {
                    setExportPath(filePath)
                    return getSuhuellaApi().getCompatibilityDiagnostics().then(setDiagnostics)
                  }
                  return undefined
                })
                .catch((error: unknown) => {
                  setExportError(
                    isHostCapabilityError(error)
                      ? HOST_ACTION_COPY.exportUnavailable
                      : 'Could not save diagnostics. Try again or contact support.',
                  )
                })
                .finally(() => setExporting(false))
            }}
            className="rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export diagnostics for support'}
          </button>
        </div>
        {exportPath ? (
          <p className="mt-3 text-sm text-emerald-700">
            Diagnostics saved as {fileNameFromPath(exportPath)}. Attach this file when you email{' '}
            {SUPPORT_EMAIL}.
          </p>
        ) : null}
        {exportError ? <p className="mt-3 text-sm text-rose-700">{exportError}</p> : null}
      </Card>
    </div>
  )
}

function shownVersion(value: string): string {
  const shown = deriveDisplayVersion(value)
  return shown || '…'
}

function releaseStatusCopy(decision: ReleaseDecision): string {
  const installed = deriveDisplayVersion(decision.installed)
  const latest = deriveDisplayVersion(decision.latest)
  if (decision.kind === 'current') return "You're up to date"
  if (decision.kind === 'unknown') return "Couldn't check for updates"
  if (decision.kind === 'downgrade_blocked') {
    return `This computer has ${installed}. Published release is ${latest}. Downgrade is not offered.`
  }
  if (decision.canInstall) {
    return decision.kind === 'update_mandatory'
      ? `Version ${latest} is required.`
      : `Version ${latest} is available.`
  }
  return decision.kind === 'update_mandatory'
    ? `Version ${latest} is required. The installer is not available to download yet.`
    : `Version ${latest} is published. The installer is not available to download yet.`
}

function AboutSection({ appInfo }: { appInfo: AppInfo }) {
  const productIdentity = useProductBrandIdentity()
  const desktop = appInfo.host !== 'browser'
  const [decision, setDecision] = useState<ReleaseDecision | null>(null)
  const [checking, setChecking] = useState(false)

  async function checkForUpdates() {
    setChecking(true)
    try {
      setDecision(await getSuhuellaApi().checkRelease())
    } catch {
      setDecision({
        kind: 'unknown',
        installed: appInfo.version,
        latest: '',
        minimum: '',
        notes: '',
        url: null,
        canInstall: false,
      })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (appInfo.host === 'browser') return
    let cancelled = false
    setChecking(true)
    void getSuhuellaApi()
      .checkRelease()
      .then((next) => {
        if (!cancelled) setDecision(next)
      })
      .catch(() => {
        if (!cancelled) {
          setDecision({
            kind: 'unknown',
            installed: appInfo.version,
            latest: '',
            minimum: '',
            notes: '',
            url: null,
            canInstall: false,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [appInfo.host, appInfo.version])

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <BrandMark identity={productIdentity} size={32} />
          <div>
            <h2 className="text-base font-semibold text-slate-900">{appInfo.name}</h2>
            <p className="text-sm text-slate-500">Suggests the right folder when you save.</p>
          </div>
        </div>
        <dl className="mt-3">
          <SettingsRow label="Version" value={shownVersion(appInfo.version)} />
          <SettingsRow label="Build" value={shownVersion(appInfo.buildVersion)} />
        </dl>
        {desktop ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-900">Updates</p>
            <p className="mt-1 text-sm text-slate-600">
              {checking ? 'Checking…' : decision ? releaseStatusCopy(decision) : 'Check when you want to.'}
            </p>
            {decision?.notes ? <p className="mt-1 text-sm text-slate-500">{decision.notes}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void checkForUpdates()}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800"
              >
                Check for updates
              </button>
              {decision?.canInstall && decision.url ? (
                <button
                  type="button"
                  onClick={() => void getSuhuellaApi().openExternal(decision.url!)}
                  className="rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--brand-on-accent)]"
                >
                  Update now
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
      <QuietCard>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Website</dt>
            <dd className="mt-1">
              <ExternalLink href={WEBSITE}>{brand.primaryDomain}</ExternalLink>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Support</dt>
            <dd className="mt-1">
              <ExternalLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</ExternalLink>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Privacy policy</dt>
            <dd className="mt-1">
              <ExternalLink href={PRIVACY_URL}>{`${brand.primaryDomain}/privacidad`}</ExternalLink>
            </dd>
          </div>
        </dl>
      </QuietCard>
    </div>
  )
}

