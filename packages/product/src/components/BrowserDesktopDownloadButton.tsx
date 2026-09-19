import { ArrowDownToLine } from 'lucide-react'
import { openAppOverlay } from '../lib/app-modal'
import {
  resolveSidebarDesktopDownload,
  type DesktopDownloadOffer,
} from '../lib/desktop-download-cta'
import { AppleIcon, WindowsIcon } from './PlatformIcons'

type BrowserDesktopDownloadButtonProps = {
  offer: DesktopDownloadOffer | null
  collapsed: boolean
}

export function BrowserDesktopDownloadButton({
  offer,
  collapsed,
}: BrowserDesktopDownloadButtonProps) {
  const download = resolveSidebarDesktopDownload(offer)
  const layoutClass = collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2 text-[13px]'
  const iconClass = collapsed ? 'h-5 w-5' : 'h-4 w-4'

  if (download.kind === 'available' && download.external) {
    const PlatformIcon = download.platform === 'mac' ? AppleIcon : WindowsIcon
    return (
      <a
        href={download.href}
        target="_blank"
        rel="noopener noreferrer"
        title={download.label}
        aria-label={download.label}
        className={`group flex w-full items-center rounded-[8px] font-medium text-[var(--brand-accent)] no-underline transition-colors hover:bg-[var(--overlay-row)] ${layoutClass}`}
      >
        <PlatformIcon
          className={`shrink-0 opacity-80 group-hover:opacity-100 ${iconClass}`}
        />
        {!collapsed ? download.label : null}
      </a>
    )
  }

  const label = download.kind === 'available' ? download.label : download.message
  const PlatformIcon =
    download.kind === 'available' && download.platform === 'mac' ? AppleIcon : WindowsIcon

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => openAppOverlay('downloads')}
      className={`group flex w-full items-center rounded-[8px] font-medium transition-colors hover:bg-[var(--overlay-row)] ${
        download.kind === 'available'
          ? 'text-[var(--brand-accent)]'
          : 'text-amber-600/90 dark:text-amber-500/90'
      } ${layoutClass}`}
    >
      {download.kind === 'available' ? (
        <PlatformIcon className={`shrink-0 opacity-80 group-hover:opacity-100 ${iconClass}`} />
      ) : (
        <ArrowDownToLine
          className={`shrink-0 opacity-80 group-hover:opacity-100 ${iconClass}`}
          strokeWidth={2}
        />
      )}
      {!collapsed ? <span className="min-w-0 leading-snug text-left">{label}</span> : null}
    </button>
  )
}
