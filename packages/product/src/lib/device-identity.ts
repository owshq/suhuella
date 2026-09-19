const GENERIC_DEVICE_NAME =
  /^(this mac|this pc|this computer|this browser|device|mac|pc|computer)$/i

export function isGenericDeviceName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true
  return GENERIC_DEVICE_NAME.test(name.trim())
}

function browserKind(): string {
  if (typeof navigator === 'undefined') return 'Browser'
  const ua = navigator.userAgent
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Browser'
}

function platformKind(): 'Mac' | 'Windows' | 'Linux' | 'Device' {
  if (typeof navigator === 'undefined') return 'Device'
  const ua = navigator.userAgent
  if (/Win/i.test(ua)) return 'Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Device'
}

/** Browser cannot read the OS computer name — use a stable, human label instead of "This Mac". */
export function getBrowserComputerName(storedName?: string | null): string {
  const custom = storedName?.trim()
  if (custom && !isGenericDeviceName(custom)) return custom

  if (typeof localStorage !== 'undefined') {
    const persisted = localStorage.getItem('suhuella-browser-computer-name')?.trim()
    if (persisted && !isGenericDeviceName(persisted)) return persisted
  }

  const platform = platformKind()
  if (platform === 'Mac') return `${browserKind()} on Mac`
  if (platform === 'Windows') return `${browserKind()} on Windows`
  if (platform === 'Linux') return `${browserKind()} on Linux`
  return `${browserKind()} preview`
}

export function persistBrowserComputerName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed || typeof localStorage === 'undefined') return
  localStorage.setItem('suhuella-browser-computer-name', trimmed)
}

export function upgradeGenericDeviceName(name: string | null | undefined): string {
  if (!isGenericDeviceName(name)) return name?.trim() ?? getBrowserComputerName()
  return getBrowserComputerName()
}
