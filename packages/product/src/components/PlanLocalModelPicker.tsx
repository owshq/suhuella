import { useState } from 'react'
import type { AppHost, ByokStatus } from '../types'
import { getSuhuellaApi } from '../lib/api'
import {
  BROWSER_LOCAL_MODEL_CORS_NOTE,
  DESKTOP_NO_LOCAL_MODEL_NOTE,
  LOCAL_MODEL_ENGINES,
  detectedLocalModelKey,
  type DetectedLocalModel,
} from '../lib/local-model-discovery'
import {
  PLAN_MODEL_BUILTIN,
  PLAN_MODEL_DESKTOP_ONLY,
  PLAN_MODEL_DETECTED_SUFFIX,
  PLAN_MODEL_MANUAL_TOGGLE,
} from '../lib/plan-scope'

export function PlanLocalModelPicker({
  host,
  busy,
  connectBusy,
  probing,
  models,
  onRefresh,
  selectValue,
  byokStatus,
  onChange,
  onConnected,
  onNotice,
}: {
  host: AppHost
  busy: boolean
  connectBusy: boolean
  probing: boolean
  models: DetectedLocalModel[]
  onRefresh: () => void
  selectValue: string
  byokStatus: ByokStatus | null
  onChange: (value: string) => void | Promise<void>
  onConnected: (status: ByokStatus) => void
  onNotice: (message: string | null) => void
}) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualBusy, setManualBusy] = useState(false)
  const [modelName, setModelName] = useState('llama3')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const pickerBusy = busy || connectBusy || manualBusy
  const isDesktop = host !== 'browser'
  const connectedLocal =
    byokStatus?.connected && byokStatus.assistant === 'local_server' ? byokStatus : null
  const showEmptyHelp = !probing && models.length === 0

  async function connectManual() {
    onNotice(null)
    setManualBusy(true)
    try {
      const result = await getSuhuellaApi().connectByok({
        assistant: 'local_server',
        apiKey: 'ollama',
        model: modelName.trim(),
        baseUrl: baseUrl.trim(),
      })
      if (!result.ok) {
        onNotice(result.error === 'not_available' ? PLAN_MODEL_DESKTOP_ONLY : result.error)
        return
      }
      onConnected(result.status)
      setManualOpen(false)
      void onRefresh()
    } catch {
      onNotice(PLAN_MODEL_DESKTOP_ONLY)
    } finally {
      setManualBusy(false)
    }
  }

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <select
        aria-label="Model"
        value={selectValue}
        disabled={pickerBusy}
        onChange={(event) => void onChange(event.target.value)}
        className="h-9 w-full rounded-full border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3 text-sm text-[var(--app-fg)]"
      >
        <option value="builtin">{PLAN_MODEL_BUILTIN}</option>
        {connectedLocal &&
        !models.some((model) => model.model === connectedLocal.model) &&
        connectedLocal.model ? (
          <option value={`local:connected:${connectedLocal.model}`}>
            {connectedLocal.model} · connected
          </option>
        ) : null}
        {models.map((model) => (
          <option key={detectedLocalModelKey(model)} value={`local:${detectedLocalModelKey(model)}`}>
            {model.engineLabel} · {model.model}
            {PLAN_MODEL_DETECTED_SUFFIX}
          </option>
        ))}
      </select>

      {probing ? (
        <p className="text-[12px] text-[var(--app-fg)] opacity-50">Scanning for local models…</p>
      ) : null}

      {showEmptyHelp ? (
        <div className="space-y-2 rounded-xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--app-fg)] opacity-70">
          <p>{isDesktop ? DESKTOP_NO_LOCAL_MODEL_NOTE : BROWSER_LOCAL_MODEL_CORS_NOTE}</p>
          {isDesktop ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1">
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
          {isDesktop ? (
            <div>
              <button
                type="button"
                disabled={pickerBusy}
                onClick={() => setManualOpen((open) => !open)}
                className="font-semibold text-[var(--app-fg)] opacity-80 hover:opacity-100"
              >
                {manualOpen ? 'Hide manual connection' : PLAN_MODEL_MANUAL_TOGGLE}
              </button>
              {manualOpen ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    disabled={pickerBusy}
                    aria-label="Local model"
                    placeholder="llama3"
                    className="h-9 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 text-sm"
                  />
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    disabled={pickerBusy}
                    aria-label="Local server URL"
                    placeholder="http://127.0.0.1:11434/v1"
                    className="h-9 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pickerBusy || modelName.trim().length === 0}
                    onClick={() => void connectManual()}
                    className="h-9 rounded-full bg-[var(--app-fg)] px-3 text-xs font-semibold text-[var(--app-bg)] disabled:opacity-50"
                  >
                    Connect
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={probing || pickerBusy}
            onClick={() => void onRefresh()}
            className="text-[12px] font-semibold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
          >
            Scan again
          </button>
        </div>
      ) : null}
    </div>
  )
}
