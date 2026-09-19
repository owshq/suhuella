import { Folder, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import { HOST_ACTION_COPY } from '../lib/host-action-copy'
import type { SuggestionPayload } from '../types'

export function SuggestionWindow() {
  const [payload, setPayload] = useState<SuggestionPayload | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    try {
      const api = getSuhuellaApi()
      void api.getSuggestion().then(setPayload)
      return api.onSuggestionUpdated(setPayload)
    } catch {
      return undefined
    }
  }, [])

  return (
    <div className="flex h-screen items-stretch justify-center bg-transparent p-1.5">
      <div className="drag-region flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#141414]/95 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <p className="min-w-0 truncate text-[15px] font-medium tracking-[-0.02em] text-white">
            {payload?.fileName ?? 'Waiting for a save…'}
          </p>
          <button
            type="button"
            onClick={() => void getSuhuellaApi().closeSuggestion()}
            className="no-drag -mr-1 rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-4 border-t border-white/10" />

        <div className="no-drag flex flex-1 flex-col px-2 py-1.5">
          {payload?.recommendations.length ? (
            payload.recommendations.map((item, index) => (
              <button
                key={item.folder}
                type="button"
                onClick={() => {
                  void getSuhuellaApi()
                    .chooseRecommendedFolder(item.folder)
                    .then((result) => {
                      if (result.ok) {
                        setNotice(null)
                        return
                      }
                      setNotice(result.error ?? HOST_ACTION_COPY.saveAsPreviewOnly)
                    })
                    .catch(() => {
                      setNotice(HOST_ACTION_COPY.saveAsPreviewOnly)
                    })
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/8"
              >
                <Folder
                  className={`h-4 w-4 shrink-0 ${index === 0 ? 'text-[var(--brand-accent)]' : 'text-slate-500'}`}
                  fill={index === 0 ? 'var(--brand-accent)' : 'none'}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">
                  {item.label}
                </span>
                <span
                  className={`shrink-0 font-mono text-[12px] ${
                    index === 0 ? 'text-[color-mix(in_srgb,var(--brand-accent)_55%,white)]' : 'text-slate-500'
                  }`}
                >
                  {item.score}%
                </span>
              </button>
            ))
          ) : (
            <p className="px-2 py-6 text-center text-xs text-slate-500">
              Add a source to see suggestions.
            </p>
          )}
          {notice ? <p className="px-2 py-2 text-xs leading-relaxed text-amber-200">{notice}</p> : null}
        </div>

        <div className="mx-4 border-t border-white/10" />

        <button
          type="button"
          onClick={() => void getSuhuellaApi().chooseAnotherFolder()}
          className="no-drag px-4 py-2.5 text-left text-[13px] text-slate-400 transition hover:text-slate-200"
        >
          Choose another folder
        </button>
      </div>
    </div>
  )
}
