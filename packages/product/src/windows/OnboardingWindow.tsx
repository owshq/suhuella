import { FolderPlus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SuhuellaLogo } from '../components/SuhuellaLogo'
import { getSuhuellaApi } from '../lib/api'
import { productCopy } from '../lib/product-copy'
import type { AppSettings } from '../types'

const STEPS = 3

function sourceName(path: string): string {
  const parts = path.split(/[/\\]+/).filter(Boolean)
  return parts.at(-1) ?? path
}

export function OnboardingWindow() {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const api = getSuhuellaApi()
      void api.getSettings().then(setSettings)
    } catch {
      // Preload is only available inside the Electron window.
    }
  }, [])

  async function addSource() {
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().addIndexedLocation())
    } finally {
      setBusy(false)
    }
  }

  async function removeSource(path: string) {
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().removeIndexedLocation(path))
    } finally {
      setBusy(false)
    }
  }

  async function toggleLaunchAtLogin(enabled: boolean) {
    setSettings(await getSuhuellaApi().setLaunchAtLogin(enabled))
  }

  async function testAssistant() {
    setBusy(true)
    try {
      await getSuhuellaApi().previewSuggestions()
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    try {
      await getSuhuellaApi().finishOnboarding()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-transparent text-[var(--app-fg)]">
      <div className="drag-region h-11 shrink-0" />

      <main className="no-drag mx-auto flex w-full max-w-[440px] flex-1 flex-col px-6 pb-6">
        <header className="mb-5 mt-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3 py-1.5 text-sm font-semibold shadow-sm">
            <SuhuellaLogo className="h-4 w-4" />
            {productCopy('SuHuella')}
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">
            {productCopy('Welcome to SuHuella')}
          </h1>
        </header>

        <div className="mb-4 flex gap-1.5">
          {Array.from({ length: STEPS }, (_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-[var(--brand-accent)]' : 'bg-[var(--sidebar-line)]'}`}
            />
          ))}
        </div>

        <section className="flex flex-1 flex-col rounded-[1.6rem] border border-[var(--sidebar-line)] bg-[var(--app-bg)] p-5 shadow-xl">
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-[var(--app-fg)]">Sources</h2>
              <p className="mt-1 mb-5 text-xs leading-relaxed text-[var(--app-fg)] opacity-60">
                {productCopy('What can SuHuella see? Add a folder. Your documents stay on this device.')}
              </p>
              {(settings?.indexedLocations ?? []).length === 0 ? (
                <button
                  type="button"
                  onClick={() => void addSource()}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  <FolderPlus className="h-4 w-4" />
                  Add
                </button>
              ) : (
                <div className="space-y-2">
                  {(settings?.indexedLocations ?? []).map((path) => (
                    <div
                      key={path}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--app-fg)]">
                          {sourceName(path)}
                        </p>
                        <p className="text-[11px] text-[var(--app-fg)] opacity-50">Indexed</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeSource(path)}
                        disabled={busy}
                        className="rounded-full p-2 text-[var(--app-fg)] opacity-40 transition hover:bg-rose-50 hover:text-rose-500 hover:opacity-100 disabled:opacity-40"
                        aria-label={`Remove ${sourceName(path)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => void addSource()}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-[var(--app-fg)]">
                Enable automatic startup
              </h2>
              <p className="mt-1 mb-5 text-xs leading-relaxed text-[var(--app-fg)] opacity-60">
                {productCopy('SuHuella opens when you sign in. Close the window to keep it in the menu bar.')}
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-3.5 shadow-sm hover:opacity-90 transition">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--brand-accent)] accent-[var(--brand-accent)]"
                  checked={settings?.launchAtLogin ?? true}
                  onChange={(event) => void toggleLaunchAtLogin(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--app-fg)]">
                    {productCopy('Launch SuHuella when I sign in')}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--app-fg)] opacity-60">
                    Enabled by default. You can disable it anytime.
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-[var(--app-fg)]">Preview suggestions</h2>
              <p className="mt-1 mb-5 text-xs leading-relaxed text-[var(--app-fg)] opacity-60">
                {productCopy('Optional. See how SuHuella appears when you save. It never saves the file for you.')}
              </p>
              <button
                type="button"
                onClick={() => void testAssistant()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                Preview Suggestions
              </button>
            </>
          )}
        </section>

        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
              className="px-2 py-1 text-sm font-semibold text-[var(--app-fg)] opacity-60 transition hover:opacity-100 disabled:opacity-40"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => {
              if (step < STEPS - 1) setStep((s) => s + 1)
              else void finish()
            }}
            disabled={busy}
            className="rounded-full bg-[var(--brand-accent)] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {step < STEPS - 1 ? 'Continue' : busy ? 'Starting…' : productCopy('Start using SuHuella')}
          </button>
        </div>
      </main>
    </div>
  )
}
