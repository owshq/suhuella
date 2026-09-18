import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FavouriteFoldersList } from '../components/FavouriteFoldersList'
import { SuhuellaLogo } from '../components/SuhuellaLogo'
import { getSuhuellaApi } from '../lib/api'
import type { AppSettings } from '../types'

const STEPS = 3

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

  async function addFolder() {
    setBusy(true)
    try {
      setSettings(await getSuhuellaApi().addFavouriteFolder())
    } finally {
      setBusy(false)
    }
  }

  async function removeFolder(folder: string) {
    setSettings(await getSuhuellaApi().removeFavouriteFolder(folder))
  }

  async function toggleLaunchAtLogin(enabled: boolean) {
    setSettings(await getSuhuellaApi().setLaunchAtLogin(enabled))
  }

  async function testAssistant() {
    setBusy(true)
    try {
      await getSuhuellaApi().testSuggestion()
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
    <div className="flex min-h-screen flex-col overflow-y-auto bg-[#A7D8F9] text-slate-900">
      <div className="drag-region h-11 shrink-0" />

      <main className="no-drag mx-auto flex w-full max-w-[440px] flex-1 flex-col px-6 pb-6">
        <header className="mb-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur">
            <SuhuellaLogo className="h-4 w-4" />
            SuHuella
          </div>
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em] text-slate-900">
            Welcome to SuHuella
          </h1>
          <p className="mt-1 text-sm text-slate-600">1 minute setup</p>
        </header>

        <div className="mb-4 flex gap-1.5">
          {Array.from({ length: STEPS }, (_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-[#0084FF]' : 'bg-white/60'}`}
            />
          ))}
        </div>

        <section className="flex flex-1 flex-col rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-slate-900">
                Where do you usually save your files?
              </h2>
              <p className="mt-1 mb-4 text-xs text-slate-500">
                Add the folders SuHuella should recommend. Nothing is pre-selected.
              </p>
              <FavouriteFoldersList
                folders={settings?.favouriteFolders ?? []}
                busy={busy}
                onAdd={() => void addFolder()}
                onRemove={(folder) => void removeFolder(folder)}
              />
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-slate-900">
                Enable automatic startup
              </h2>
              <p className="mt-1 mb-5 text-xs leading-relaxed text-slate-500">
                SuHuella stays in the tray and waits silently. You can change this later in
                Settings.
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3.5 shadow-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0084FF] accent-[#0084FF]"
                  checked={settings?.launchAtLogin ?? true}
                  onChange={(event) => void toggleLaunchAtLogin(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Launch SuHuella when I sign in
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Enabled by default. You can disable it anytime.
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-slate-900">Preview suggestions</h2>
              <p className="mt-1 mb-5 text-xs leading-relaxed text-slate-500">
                Optional. See how SuHuella appears when you save. It never saves the file for you.
              </p>
              <button
                type="button"
                onClick={() => void testAssistant()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
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
              onClick={() => setStep((current) => current - 1)}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current + 1)}
              className="rounded-full bg-[#0084FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_-10px_rgba(0,132,255,0.7)] hover:bg-[#0076e6]"
            >
              {step === 0 ? 'Continue' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="rounded-full bg-[#0084FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_-10px_rgba(0,132,255,0.7)] hover:bg-[#0076e6] disabled:opacity-60"
            >
              Finish
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
