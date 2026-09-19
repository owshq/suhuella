// Native Chrome folder-picker and permission dialogs cannot be styled.
// SuHuella owns this modal only when the browser blocks a system folder.
import { useEffect, useRef } from 'react'
import { useAppLocale } from '../lib/app-locale'
import { browserBlockedFolderDialogCopy } from '../lib/sources-ui'
import { BrowserDesktopDownloadButton } from './BrowserDesktopDownloadButton'
import type { DesktopDownloadOffer } from '../lib/desktop-download-cta'

type BrowserFolderConnectDialogProps = {
  busy?: boolean
  downloadOffer?: DesktopDownloadOffer | null
  onPick: () => void
  onClose: () => void
}

export function BrowserFolderConnectDialog({
  busy,
  downloadOffer,
  onPick,
  onClose,
}: BrowserFolderConnectDialogProps) {
  const { locale } = useAppLocale()
  const copy = browserBlockedFolderDialogCopy(locale)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="browser-folder-connect-title"
        data-brand-dialog
        className="brand-dialog-surface w-full max-w-md rounded-[1.35rem] border border-white/50 p-6 text-[#111827] shadow-2xl [color-scheme:light]"
      >
        <h2 id="browser-folder-connect-title" className="text-[22px] font-semibold tracking-tight text-[#111827]">
          {copy.title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#1e293b]">{copy.body}</p>
        <div className="mt-4 rounded-[10px] bg-white/55 px-1 py-1">
          <BrowserDesktopDownloadButton offer={downloadOffer ?? null} collapsed={false} />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-[#1e293b] transition hover:bg-white/50 disabled:opacity-50"
          >
            {copy.secondary}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onPick}
            disabled={busy}
            className="rounded-full bg-[var(--brand-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-50"
          >
            {copy.primary}
          </button>
        </div>
      </div>
    </div>
  )
}
