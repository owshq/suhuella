import { FolderPlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HomeIdentityCard } from '../components/HomeIdentityCard'
import { SuhuellaLogo } from '../components/SuhuellaLogo'
import { getSuhuellaApi } from '../lib/api'
import { productCopy } from '../lib/product-copy'
import type { AppSettings, LicenseStatusView } from '../types'

const STEPS = 2

function sourceName(path: string): string {
  const parts = path.split(/[/\\]+/).filter(Boolean)
  return parts.at(-1) ?? path
}

export function OnboardingWindow() {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [license, setLicense] = useState<LicenseStatusView | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const api = getSuhuellaApi()
      void api.getSettings().then(setSettings)
      void api.getLicense().then(setLicense)
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

  async function finish() {
    setBusy(true)
    try {
      await getSuhuellaApi().finishOnboarding('home')
    } finally {
      setBusy(false)
    }
  }

  const hasSource = (settings?.indexedLocations ?? []).length > 0
  const canAdvance = step === 0 || hasSource

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
              <h2 className="text-base font-semibold text-[var(--app-fg)]">Your license</h2>
              <p className="mt-1 mb-4 text-xs leading-relaxed text-[var(--app-fg)] opacity-60">
                {productCopy('SuHuella Free keeps everything on this device. Activate a license later if you need paid features.')}
              </p>
              <HomeIdentityCard license={license} />
              <p className="mt-4 text-xs leading-relaxed text-[var(--app-fg)] opacity-50">
                {productCopy('Close the window anytime — SuHuella stays in the menu bar.')}
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-[var(--app-fg)]">Add your first source</h2>
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
                  Add folder
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
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3.5 py-2 text-sm font-semibold text-[var(--app-fg)] transition hover:opacity-90 disabled:opacity-60"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Add another
                  </button>
                </div>
              )}
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
            disabled={busy || !canAdvance}
            className="rounded-full bg-[var(--brand-accent)] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {step < STEPS - 1
              ? 'Continue'
              : busy
                ? 'Opening Home…'
                : productCopy('Go to Home')}
          </button>
        </div>
      </main>
    </div>
  )
}
