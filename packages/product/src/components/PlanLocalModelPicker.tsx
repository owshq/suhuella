import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
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
  PLAN_MODEL_HELP_LABEL,
  PLAN_MODEL_MANUAL_TOGGLE,
} from '../lib/plan-scope'

function PlanModelHelpMenu({
  anchorEl,
  host,
  probing,
  models,
  pickerBusy,
  manualOpen,
  modelName,
  baseUrl,
  onClose,
  onRefresh,
  onToggleManual,
  onModelNameChange,
  onBaseUrlChange,
  onConnectManual,
}: {
  anchorEl: HTMLElement
  host: AppHost
  probing: boolean
  models: DetectedLocalModel[]
  pickerBusy: boolean
  manualOpen: boolean
  modelName: string
  baseUrl: string
  onClose: () => void
  onRefresh: () => void
  onToggleManual: () => void
  onModelNameChange: (value: string) => void
  onBaseUrlChange: (value: string) => void
  onConnectManual: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isDesktop = host !== 'browser'
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    setAnchorRect(anchorEl.getBoundingClientRect())
  }, [anchorEl])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      if (anchorEl.contains(event.target as Node)) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorEl, onClose])

  if (!anchorRect) return null

  const menuWidth = 280
  const left = Math.min(
    Math.max(8, anchorRect.right - menuWidth),
    window.innerWidth - menuWidth - 8,
  )
  const top = anchorRect.bottom + 6

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 w-[280px] rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-bg)] p-3 text-[12px] leading-relaxed text-[var(--app-fg)] shadow-lg backdrop-blur-xl"
      style={{ top, left }}
    >
      {probing ? (
        <p className="opacity-70">Scanning for local models…</p>
      ) : models.length === 0 ? (
        <p className="opacity-80">{isDesktop ? DESKTOP_NO_LOCAL_MODEL_NOTE : BROWSER_LOCAL_MODEL_CORS_NOTE}</p>
      ) : (
        <p className="opacity-70">Choose a detected model or keep built-in rules.</p>
      )}
      {isDesktop && models.length === 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
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
        <div className="mt-2">
          <button
            type="button"
            disabled={pickerBusy}
            onClick={onToggleManual}
            className="font-semibold text-[var(--app-fg)] opacity-80 hover:opacity-100"
          >
            {manualOpen ? 'Hide manual connection' : PLAN_MODEL_MANUAL_TOGGLE}
          </button>
          {manualOpen ? (
            <div className="mt-2 grid gap-2">
              <input
                type="text"
                value={modelName}
                onChange={(event) => onModelNameChange(event.target.value)}
                disabled={pickerBusy}
                aria-label="Local model"
                placeholder="llama3"
                className="h-8 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 text-sm"
              />
              <input
                type="url"
                value={baseUrl}
                onChange={(event) => onBaseUrlChange(event.target.value)}
                disabled={pickerBusy}
                aria-label="Local server URL"
                placeholder="http://127.0.0.1:11434/v1"
                className="h-8 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 text-sm"
              />
              <button
                type="button"
                disabled={pickerBusy || modelName.trim().length === 0}
                onClick={onConnectManual}
                className="h-8 rounded-full bg-[var(--app-fg)] px-3 text-xs font-semibold text-[var(--app-bg)] disabled:opacity-50"
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
        onClick={() => {
          void onRefresh()
        }}
        className="mt-2 font-semibold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
      >
        Scan again
      </button>
    </div>,
    document.body,
  )
}

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
  const [helpOpen, setHelpOpen] = useState(false)
  const [modelName, setModelName] = useState('llama3')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const helpRef = useRef<HTMLButtonElement>(null)
  const pickerBusy = busy || connectBusy || manualBusy
  const connectedLocal =
    byokStatus?.connected && byokStatus.assistant === 'local_server' ? byokStatus : null

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
      setHelpOpen(false)
      void onRefresh()
    } catch {
      onNotice(PLAN_MODEL_DESKTOP_ONLY)
    } finally {
      setManualBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <select
        aria-label="Model"
        value={selectValue}
        disabled={pickerBusy}
        onChange={(event) => void onChange(event.target.value)}
        className="h-9 max-w-[11rem] min-w-[8.5rem] flex-1 rounded-full border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3 text-sm text-[var(--app-fg)]"
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
      <button
        ref={helpRef}
        type="button"
        aria-label={PLAN_MODEL_HELP_LABEL}
        aria-expanded={helpOpen}
        disabled={pickerBusy}
        onClick={() => setHelpOpen((open) => !open)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--sidebar-line)] bg-[var(--app-bg)] text-[var(--app-fg)] opacity-70 hover:opacity-100 disabled:opacity-40"
      >
        <HelpCircle className="h-4 w-4" strokeWidth={2.25} />
      </button>
      {helpOpen && helpRef.current ? (
        <PlanModelHelpMenu
          anchorEl={helpRef.current}
          host={host}
          probing={probing}
          models={models}
          pickerBusy={pickerBusy}
          manualOpen={manualOpen}
          modelName={modelName}
          baseUrl={baseUrl}
          onClose={() => setHelpOpen(false)}
          onRefresh={onRefresh}
          onToggleManual={() => setManualOpen((open) => !open)}
          onModelNameChange={setModelName}
          onBaseUrlChange={setBaseUrl}
          onConnectManual={() => void connectManual()}
        />
      ) : null}
    </div>
  )
}
