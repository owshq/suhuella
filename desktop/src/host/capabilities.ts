import { productCopy } from '../lib/product-copy'
import type { AppHost, AppInfo, PlatformCapabilities } from '../types'

export type HostKind = AppHost

export function capabilitiesFor(input: {
  host: HostKind
  platform?: AppInfo['platform']
  folderAccess?: boolean
  organise?: boolean
}): PlatformCapabilities {
  const desktop = input.host === 'electron'
  const folderAccess = desktop ? true : Boolean(input.folderAccess)
  const organise = desktop ? true : Boolean(input.organise ?? folderAccess)
  return {
    saveAs: desktop && input.platform === 'win32',
    tray: desktop,
    openFolder: desktop,
    reveal: desktop,
    filesystem: folderAccess,
    notifications: desktop,
    nativeDialogs: desktop,
    organise,
    search: true,
    activity: true,
    workflows: true,
    license: true,
  }
}

export function capabilitiesOf(
  info?: Pick<AppInfo, 'capabilities' | 'host' | 'platform' | 'folderAccess'> | null,
): PlatformCapabilities {
  if (info?.capabilities) return info.capabilities
  if (!info?.host) {
    const folderAccess = Boolean(info?.folderAccess)
    return {
      saveAs: false,
      tray: false,
      openFolder: false,
      reveal: false,
      filesystem: folderAccess,
      notifications: false,
      nativeDialogs: false,
      organise: folderAccess,
      search: true,
      activity: true,
      workflows: true,
      license: true,
    }
  }
  return capabilitiesFor({
    host: info.host,
    platform: info.platform,
    folderAccess: info.folderAccess,
    organise: info.capabilities?.organise,
  })
}

export function homeHeadline(_info?: Pick<AppInfo, 'capabilities' | 'host' | 'platform' | 'folderAccess'> | null): string {
  return productCopy('What SuHuella knows')
}

export function homeKnowledgeLine(args: {
  sourceCount: number
  scanning?: boolean
  learningFrom?: string | null
  saveAs?: boolean
  tray?: boolean
  host?: AppHost | null
}): string {
  if (args.sourceCount === 0) {
    return args.host === 'browser' ? 'Connect a source to begin' : 'Add a source to begin'
  }
  if (args.scanning) {
    if (args.learningFrom) return productCopy(`Learning from ${args.learningFrom}…`)
    return productCopy('Updating what SuHuella knows')
  }
  return ''
}

export function folderAccessCopy(caps: PlatformCapabilities) {
  if (caps.filesystem) return null
  return {
    title: 'Folder access is not available in this browser.',
    body: 'Use Chrome or Edge, or download the desktop app.',
    detail: 'Your documents stay on this device. Nothing is uploaded.',
    action: 'Use Chrome or Edge, or download the desktop app.',
  }
}
