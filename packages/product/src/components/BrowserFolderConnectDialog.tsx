// Native Chrome folder-picker and permission dialogs cannot be styled.
// SuHuella owns this modal only when the browser blocks a system folder.
import { useEffect, useId, useRef } from 'react'
import { useAppLocale } from '../lib/app-locale'
import {
  browserCapabilityDialogCopy,
  type BrowserCapabilityDialogCopy,
} from '../lib/browser-capability-notice'
import { sourceConnectWaitingStatus } from '../lib/sources-ui'
import { BrowserDesktopDownloadButton } from './BrowserDesktopDownloadButton'
import {
  detectDesktopDownloadPlatform,
  type DesktopDownloadOffer,
} from '../lib/desktop-download-cta'

type BrowserFolderConnectDialogProps = {
  busy?: boolean
  downloadOffer?: DesktopDownloadOffer | null
  notice?: BrowserCapabilityDialogCopy
  onPick?: () => void
  onClose: () => void
}

export function BrowserFolderConnectDialog({
  busy,
  downloadOffer,
  notice,
  onPick,
  onClose,
}: BrowserFolderConnectDialogProps) {
  const { locale } = useAppLocale()
  const copy = notice ?? browserCapabilityDialogCopy('protected_folder', locale)
  const platform = detectDesktopDownloadPlatform()
  const platformDownload =
    copy.offerDesktop &&
    downloadOffer &&
    (platform === 'mac' || platform === 'windows') &&
    downloadOffer.href.includes(`platform=${platform}`)
      ? locale === 'es'
        ? {
            ...downloadOffer,
            label: platform === 'mac' ? 'Descargar para Mac' : 'Descargar para Windows',
          }
        : downloadOffer
      : null
  const optionsPage =
    copy.offerDesktop && downloadOffer && !platformDownload && downloadOffer.href === '/download'
      ? downloadOffer
      : null
  const connecting = locale === 'es' ? 'Conectando…' : 'Connecting…'
  const titleId = useId()
  const bodyId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ;(primaryRef.current ?? closeRef.current)?.focus()
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
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-brand-dialog
        data-capability-notice={copy.id}
        className="brand-dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.35rem] border border-white/50 p-6 text-[#111827] shadow-2xl [color-scheme:light]"
      >
        <h2 id={titleId} className="text-[22px] font-semibold tracking-tight text-[#111827]">
          {copy.title}
        </h2>
        <p id={bodyId} className="mt-3 text-[15px] leading-relaxed text-[#1e293b]">{copy.body}</p>
        {platformDownload ? (
          <div className="mt-4 rounded-[10px] bg-white/55 px-1 py-1">
            <BrowserDesktopDownloadButton offer={platformDownload} collapsed={false} />
          </div>
        ) : null}
        {optionsPage ? (
          <p className="mt-4 text-[14px] text-[#1e293b]">
            <a href={optionsPage.href} className="font-semibold text-[var(--brand-accent)] underline">
              {locale === 'es' ? 'Ver opciones de escritorio' : optionsPage.label}
            </a>
          </p>
        ) : null}
        {copy.offerDesktop && !downloadOffer ? (
          <p className="mt-4 text-[14px] text-[#1e293b]">
            {locale === 'es'
              ? 'La aplicación de escritorio no está disponible para este sistema.'
              : 'The desktop app is not available for this system.'}
          </p>
        ) : null}
        {busy ? (
          <div role="status" aria-live="polite" data-source-connect-busy className="mt-5">
            <p className="text-[14px] font-semibold text-[#111827]">{connecting}</p>
            <div className="source-connect-busy-track mt-2" aria-hidden>
              <div className="source-connect-busy-bar" />
            </div>
            <p className="mt-2 text-[13px] text-[#1e293b] opacity-70">
              {locale === 'es' ? 'Abriendo el selector de carpetas…' : sourceConnectWaitingStatus('Connecting…', 'picker')}
            </p>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-[#1e293b] transition hover:bg-white/50 disabled:opacity-50"
          >
            {copy.secondary}
          </button>
          {copy.primary && onPick ? (
            <button
              ref={primaryRef}
              type="button"
              onClick={onPick}
              disabled={busy}
              aria-busy={busy}
              className="rounded-full bg-[var(--brand-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-50"
            >
              {busy ? connecting : copy.primary}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
