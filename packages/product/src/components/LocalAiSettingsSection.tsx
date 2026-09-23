import { useState } from 'react'
import type { AppHost, ByokStatus } from '../types'
import { getSuhuellaApi } from '../lib/api'
import {
  BROWSER_LOCAL_MODEL_CORS_NOTE,
  DESKTOP_NO_LOCAL_MODEL_NOTE,
  LOCAL_MODEL_ENGINES,
  detectedLocalModelKey,
  localModelConnectRequest,
  type DetectedLocalModel,
} from '../lib/local-model-discovery'
import {
  LOCAL_AI_SECTION_LEAD,
  LOCAL_AI_SECTION_TITLE,
} from '../lib/byok-storage-copy'
import { useLocalModelDiscovery } from '../hooks/useLocalModelDiscovery'
import { LocalServerLogo } from './ByokAssistantLogos'
import { productCopy } from '../lib/product-copy'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  )
}

export function LocalAiSettingsSection({
  host,
  status,
  loading,
  onStatusChange,
}: {
  host: AppHost
  status: ByokStatus | null
  loading: boolean
  onStatusChange: (status: ByokStatus) => void
}) {
  const { models, browserBlocked, probing, refresh } = useLocalModelDiscovery(true)
  const [manualOpen, setManualOpen] = useState(false)
  const [modelName, setModelName] = useState('llama3')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connectedLocal =
    status?.connected && status.assistant === 'local_server' ? status : null
  const isDesktop = host !== 'browser'

  async function connectDetected(model: DetectedLocalModel) {
    setBusy(true)
    setError(null)
    try {
      const result = await getSuhuellaApi().connectByok(localModelConnectRequest(model))
      if (!result.ok) {
        setError(result.error)
        return
      }
      onStatusChange(result.status)
    } catch {
      setError('Could not connect to this local model.')
    } finally {
      setBusy(false)
    }
  }

  async function connectManual() {
    setBusy(true)
    setError(null)
    try {
      const result = await getSuhuellaApi().connectByok({
        assistant: 'local_server',
        apiKey: 'ollama',
        model: modelName.trim(),
        baseUrl: baseUrl.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onStatusChange(result.status)
      setManualOpen(false)
    } catch {
      setError('Could not connect to this local server.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      onStatusChange(await getSuhuellaApi().disconnectByok())
    } catch {
      setError('Could not disconnect this local model.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--app-fg)]">{LOCAL_AI_SECTION_TITLE}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--app-fg)] opacity-60">{LOCAL_AI_SECTION_LEAD}</p>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <LocalServerLogo />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[var(--app-fg)]">Detect on this device</h3>
              <button
                type="button"
                disabled={probing || busy}
                onClick={() => void refresh()}
                className="text-xs font-semibold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
              >
                {probing ? 'Scanning…' : 'Scan again'}
              </button>
            </div>

            {connectedLocal ? (
              <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
                <p className="font-semibold">
                  Connected · {connectedLocal.model ?? connectedLocal.assistantLabel}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  className="mt-2 text-xs font-semibold text-emerald-800 underline disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ) : null}

            {loading || probing ? (
              <p className="mt-3 text-sm text-[var(--app-fg)] opacity-50">Looking for local models…</p>
            ) : models.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {models.map((model) => (
                  <li
                    key={detectedLocalModelKey(model)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 py-2"
                  >
                    <span className="min-w-0 text-sm text-[var(--app-fg)]">
                      <span className="font-semibold">{model.engineLabel}</span>
                      <span className="opacity-60"> · </span>
                      <span>{model.model}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy || Boolean(connectedLocal)}
                      onClick={() => void connectDetected(model)}
                      className="rounded-full bg-[var(--app-fg)] px-3 py-1 text-xs font-semibold text-[var(--app-bg)] disabled:opacity-50"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--app-fg)] opacity-70">
                <p>{isDesktop ? DESKTOP_NO_LOCAL_MODEL_NOTE : BROWSER_LOCAL_MODEL_CORS_NOTE}</p>
                {browserBlocked && isDesktop ? (
                  <p className="text-xs opacity-80">{BROWSER_LOCAL_MODEL_CORS_NOTE}</p>
                ) : null}
                {isDesktop ? (
                  <p className="flex flex-wrap gap-3">
                    {LOCAL_MODEL_ENGINES.map((engine) => (
                      <a
                        key={engine.id}
                        href={engine.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--brand-accent)] hover:underline"
                      >
                        {engine.installLabel}
                      </a>
                    ))}
                  </p>
                ) : null}
              </div>
            )}

            {isDesktop ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setManualOpen((open) => !open)}
                  className="text-sm font-semibold text-[var(--app-fg)] opacity-70 hover:opacity-100"
                >
                  {manualOpen ? 'Hide manual connection' : 'Connect manually'}
                </button>
                {manualOpen ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                    <label className="block text-sm">
                      <span className="font-medium text-[var(--app-fg)]">Model</span>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(event) => setModelName(event.target.value)}
                        disabled={busy}
                        className="mt-1 w-full rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-[var(--app-fg)]">Server URL</span>
                      <input
                        type="url"
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        disabled={busy}
                        className="mt-1 w-full rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || !modelName.trim()}
                      onClick={() => void connectManual()}
                      className="self-end rounded-full bg-[var(--app-fg)] px-4 py-2 text-sm font-semibold text-[var(--app-bg)] disabled:opacity-50"
                    >
                      Connect
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
            <p className="mt-3 text-xs leading-relaxed text-[var(--app-fg)] opacity-45">
              {productCopy('SuHuella talks to your server over HTTP on this device. No model runs inside the app.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
