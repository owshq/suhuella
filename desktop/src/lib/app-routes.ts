export type AppSection = 'search' | 'home' | 'organise' | 'locations' | 'activity' | 'settings'

export const PRODUCT_PATHS = {
  home: '/home',
  search: '/search',
  organise: '/organise',
  locations: '/sources',
  activity: '/activity',
  settings: '/settings',
} as const

const PATH_TO_SECTION: Record<string, AppSection> = {
  '/home': 'home',
  '/search': 'search',
  '/organise': 'organise',
  '/sources': 'locations',
  '/activity': 'activity',
  '/settings': 'settings',
}

const LEGACY_SECTIONS = new Set<AppSection>([
  'search',
  'home',
  'organise',
  'locations',
  'activity',
  'settings',
])

export function pathForSection(
  section: AppSection,
  prefs = 'general',
  extraQuery: Record<string, string> = {},
): string {
  const path = PRODUCT_PATHS[section]
  const params = new URLSearchParams()
  if (section === 'settings' && prefs && prefs !== 'general') {
    params.set('prefs', prefs)
  }
  for (const [key, value] of Object.entries(extraQuery)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function sectionFromPathname(pathname: string): AppSection | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  return PATH_TO_SECTION[path] ?? null
}

export function sectionFromLocation(location: {
  pathname: string
  hash: string
  search: string
}): AppSection {
  const fromPath = sectionFromPathname(location.pathname)
  if (fromPath) return fromPath

  const raw = location.hash.replace(/^#/, '')
  const [hashPath, hashQuery = ''] = raw.split('?')
  const fromHashPath = sectionFromPathname(hashPath)
  if (fromHashPath) return fromHashPath

  const query = new URLSearchParams(hashQuery || location.search.replace(/^\?/, ''))
  const requested = query.get('section')
  if (requested && LEGACY_SECTIONS.has(requested as AppSection)) {
    return requested as AppSection
  }
  return 'home'
}

function locationQuery(location: { pathname: string; hash: string; search: string }): URLSearchParams {
  const raw = location.hash.replace(/^#/, '')
  const hashQuery = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  return new URLSearchParams(hashQuery || location.search.replace(/^\?/, ''))
}

export function settingsPrefsFromLocation(location: {
  pathname: string
  hash: string
  search: string
}): string {
  const query = locationQuery(location)
  return query.get('prefs') || query.get('tab') || 'general'
}

export function checkoutReturnFromLocation(location: {
  pathname: string
  hash: string
  search: string
}): { sessionId: string; checkout: string; plan: string } {
  const query = locationQuery(location)
  return {
    sessionId: query.get('session_id')?.trim() ?? '',
    checkout: query.get('checkout')?.trim() ?? '',
    plan: query.get('plan')?.trim() ?? '',
  }
}

type BrowserWindowLike = {
  location: { pathname: string; search: string; hash: string }
  history: { pushState: (state: unknown, title: string, url: string) => void }
}

function browserWindow(): BrowserWindowLike | null {
  const candidate = (globalThis as { window?: BrowserWindowLike }).window
  return candidate ?? null
}

function usesProductPathname(): boolean {
  const win = browserWindow()
  if (!win) return false
  return sectionFromPathname(win.location.pathname) !== null
}

export function writeProductLocation(section: AppSection, prefs = 'general'): void {
  const win = browserWindow()
  if (!win) return

  const next = pathForSection(section, prefs)
  if (usesProductPathname()) {
    const current = `${win.location.pathname}${win.location.search}`
    if (current === next) return
    win.history.pushState({ section, prefs }, '', next)
    return
  }
  if (win.location.hash === `#${next}`) return
  win.location.hash = next
}
