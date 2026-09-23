import { productCopy } from '../lib/product-copy'
import { hostAccessFor, type HostAccessCapabilities } from '../lib/platform-capabilities'
import type { AppHost, AppInfo, PlatformCapabilities } from '../types'

export {
  homeOrganiseActionLabel,
  homeOrganiseOpportunity,
  homeOrganiseScope,
} from '../lib/home-organise'
export type { HomeOrganiseLocation, HomeOrganiseOpportunity } from '../lib/home-organise'

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
  return productCopy('Documents SuHuella has seen')
}

export function homeKnowledgeLine(args: {
  sourceCount: number
  scanning?: boolean
  indexingFrom?: string | null
  saveAs?: boolean
  tray?: boolean
  host?: AppHost | null
  access?: HostAccessCapabilities
}): string {
  if (args.scanning) {
    if (args.indexingFrom) return productCopy(`Updating ${args.indexingFrom}…`)
    return productCopy('Updating documents SuHuella has seen')
  }
  if (args.sourceCount === 0) {
    const connectGrant = args.access?.connectGrant ?? hostAccessFor(args.host).connectGrant
    return connectGrant ? 'Connect a source to begin' : 'Add a source to begin'
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
