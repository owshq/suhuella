export type AppSection = 'search' | 'home' | 'organise' | 'locations' | 'activity' | 'settings'

export const PRODUCT_PATHS = {
  home: '/home',
  search: '/search',
  organise: '/plan-mode',
  locations: '/sources',
  activity: '/activity',
  settings: '/settings',
} as const

const PATH_TO_SECTION: Record<string, AppSection> = {
  '/home': 'home',
  '/search': 'search',
  '/plan-mode': 'organise',
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

const CHECKOUT_RETURN_QUERY_KEYS = ['session_id', 'checkout', 'plan', 'attempt'] as const

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

/** Remove Stripe checkout return params from a query string (pure — safe for tests). */
export function stripCheckoutReturnSearch(search: string): string {
  const query = new URLSearchParams(search.replace(/^\?/, ''))
  let changed = false
  for (const key of CHECKOUT_RETURN_QUERY_KEYS) {
    if (query.has(key)) {
      query.delete(key)
      changed = true
    }
  }
  if (!changed) return search.replace(/^\?/, '')
  return query.toString()
}

/** Drop checkout return params from the address bar so session_id does not linger in history. */
export function stripCheckoutReturnFromLocation(
  location: { pathname: string; hash: string; search: string } = browserWindow()?.location ?? {
    pathname: '',
    hash: '',
    search: '',
  },
): void {
  const win = browserWindow()
  if (!win) return

  const raw = location.hash.replace(/^#/, '')
  const hashPath = raw.includes('?') ? raw.slice(0, raw.indexOf('?')) : raw
  const hashQuery = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  const searchStripped = stripCheckoutReturnSearch(location.search)
  const hashStripped = hashQuery ? stripCheckoutReturnSearch(`?${hashQuery}`) : ''

  const nextSearch = searchStripped ? `?${searchStripped}` : ''
  const nextHash = hashPath
    ? `#${hashPath}${hashStripped ? `?${hashStripped}` : ''}`
    : hashStripped
      ? `#?${hashStripped}`
      : location.hash

  const current = `${location.pathname}${location.search}${location.hash}`
  const next = `${location.pathname}${nextSearch}${nextHash}`
  if (current === next) return
  win.history.replaceState(win.history.state, '', next)
}

type BrowserWindowLike = {
  location: { pathname: string; search: string; hash: string }
  history: {
    pushState: (state: unknown, title: string, url: string) => void
    replaceState: (state: unknown, title: string, url: string) => void
    state: unknown
  }
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
