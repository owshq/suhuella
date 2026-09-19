export type DesktopDownloadPlatform = 'mac' | 'windows' | 'unknown'

export type DesktopDownloadOffer = {
  label: string
  panelLabel: string
  href: string
  external: boolean
}

export type SidebarDesktopDownload =
  | {
      kind: 'available'
      platform: 'mac' | 'windows'
      label: string
      href: string
      external: boolean
    }
  | {
      kind: 'unavailable'
      message: string
    }

type ReleaseUrls = {
  mac: string
  windows: string
}

/** Approximate client OS for download CTA — honest, never overclaims. */
export function detectDesktopDownloadPlatform(): DesktopDownloadPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod|Android/i.test(ua)) return 'unknown'
  if (/Win/i.test(ua)) return 'windows'
  if (/Mac/i.test(ua)) return 'mac'
  return 'unknown'
}

function hasUrl(url: string | undefined): url is string {
  return Boolean(url?.trim())
}

export function buildDesktopDownloadOffer(
  manifest: ReleaseUrls,
  platform: DesktopDownloadPlatform,
): DesktopDownloadOffer | null {
  const mac = manifest.mac.trim()
  const windows = manifest.windows.trim()
  const hasMac = hasUrl(mac)
  const hasWindows = hasUrl(windows)
  const hasAny = hasMac || hasWindows

  if (platform === 'mac' && hasMac) {
    return {
      label: 'Download for Mac',
      panelLabel: 'Download desktop app',
      href: mac,
      external: true,
    }
  }

  if (platform === 'windows' && hasWindows) {
    return {
      label: 'Download for Windows',
      panelLabel: 'Download desktop app',
      href: windows,
      external: true,
    }
  }

  if (hasAny) {
    return {
      label: 'Get the desktop app',
      panelLabel: 'Download desktop app',
      href: '/download',
      external: false,
    }
  }

  return null
}

async function fetchReleaseUrls(): Promise<ReleaseUrls | null> {
  try {
    const response = await fetch('/api/release', { cache: 'no-store' })
    if (!response.ok) return null
    const data = (await response.json()) as {
      ok?: boolean
      release?: { mac?: string; windows?: string }
    }
    if (!data.ok || !data.release) return null
    return {
      mac: data.release.mac ?? '',
      windows: data.release.windows ?? '',
    }
  } catch {
    return null
  }
}

export async function resolveDesktopDownloadOffer(): Promise<DesktopDownloadOffer | null> {
  const manifest = await fetchReleaseUrls()
  if (!manifest) return null
  return buildDesktopDownloadOffer(manifest, detectDesktopDownloadPlatform())
}

export function resolveSidebarDesktopDownload(
  offer: DesktopDownloadOffer | null,
  platform: DesktopDownloadPlatform = detectDesktopDownloadPlatform(),
): SidebarDesktopDownload {
  if (platform === 'mac') {
    return {
      kind: 'available',
      platform: 'mac',
      label: offer?.label ?? 'Download for Mac',
      href: offer?.href ?? '/download',
      external: offer?.external ?? false,
    }
  }

  if (platform === 'windows') {
    return {
      kind: 'available',
      platform: 'windows',
      label: offer?.label ?? 'Download for Windows',
      href: offer?.href ?? '/download',
      external: offer?.external ?? false,
    }
  }

  return {
    kind: 'unavailable',
    message: 'Not available for this system yet',
  }
}
