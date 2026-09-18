import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FavouriteFoldersList } from '../components/FavouriteFoldersList'
import { SuhuellaLogo } from '../components/SuhuellaLogo'
import { getSuhuellaApi } from '../lib/api'
import type { AppInfo, AppSettings } from '../types'

type SettingsTab = 'general' | 'folders' | 'about'

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'folders', label: 'Folders' },
  { id: 'about', label: 'About' },
]

const shortcut =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘⌥S'
    : 'Ctrl+Alt+S'

export function SettingsWindow() {
  const [tab, setTab] = useState<SettingsTab>('general')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [settingsPath, setSettingsPath] = useState('')
  const [appInfo, setAppInfo] = useState<AppInfo>({ name: 'SuHuella', version: '' })
  const [busy, setBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    try {
      const api = getSuhuellaApi()
      void api.getSettings().then(setSettings)
      void api.getSettingsPath().then(setSettingsPath)
      void api.getAppInfo().then(setAppInfo)
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

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-[#A7D8F9] text-slate-900">
      <div className="drag-region h-11 shrink-0" />

      <main className="no-drag mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-6 pb-6">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur">
            <SuhuellaLogo className="h-4 w-4" />
            SuHuella
          </div>
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.04em] text-slate-900">
            Settings
          </h1>
        </header>

        <div className="flex rounded-full border border-white/70 bg-white/50 p-1 shadow-sm backdrop-blur">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                tab === item.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <section className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-slate-900">Startup</h2>
            <p className="mt-1 mb-4 text-xs text-slate-500">
              SuHuella waits silently in the tray after you sign in.
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
          </section>
        )}

        {tab === 'folders' && (
          <section className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
            <h2 className="text-base font-semibold text-slate-900">Favourite folders</h2>
            <p className="mt-0.5 mb-4 text-xs text-slate-500">
              These are the destinations the assistant can recommend.
            </p>
            <FavouriteFoldersList
              folders={settings?.favouriteFolders ?? []}
              busy={busy}
              onAdd={() => void addFolder()}
              onRemove={(folder) => void removeFolder(folder)}
            />

            <div className="mt-5 rounded-2xl border border-white/70 bg-white/45 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Local settings
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Stored as <span className="font-mono">settings.json</span> on this computer.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-[11px] text-slate-500">
                  {settingsPath}
                </p>
                <button
                  type="button"
                  onClick={() => void getSuhuellaApi().revealSettingsFile()}
                  className="shrink-0 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white"
                >
                  Reveal file
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === 'about' && (
          <section className="space-y-4">
            <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
              <h2 className="text-base font-semibold text-slate-900">{appInfo.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Version {appInfo.version || '…'}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                SuHuella never owns the Save operation. It only recommends a folder.
                It must feel invisible: no unexpected windows, no interruption, gone
                the moment you choose.
              </p>
              <button
                type="button"
                onClick={() => setUpdateMessage('Coming soon')}
                className="mt-4 rounded-full border border-white/80 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
              >
                Check for updates
              </button>
              {updateMessage ? (
                <p className="mt-2 text-xs font-medium text-slate-500">{updateMessage}</p>
              ) : null}
            </div>

            <div className="rounded-[1.6rem] border border-white/60 bg-white/45 p-5 backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Preview
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                See how SuHuella will appear when you save{' '}
                <span className="font-mono text-slate-700">Factura_Cliente_2026.pdf</span>.
                Settings hides while the suggestion is open, then returns.
              </p>
              <button
                type="button"
                onClick={() => void testAssistant()}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                Preview Suggestions
              </button>
              <p className="mt-3 text-[11px] text-slate-500">
                Keyboard shortcut: <span className="font-mono text-slate-700">{shortcut}</span>
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
