import { brand } from '@suhuella/brand'
import type { SourceAppearanceOverride, SourceIconId, SuggestedLocationKind } from '../types.ts'
import { sameSourceName, wellKnownSources, type WellKnownGroup, type WellKnownSource } from './well-known-sources.ts'

const CORPORATE_PALETTE_TAIL = [
  '#5856D6',
  '#5AC8FA',
  '#34C759',
  '#FF9500',
  '#AF52DE',
  '#FF2D55',
  '#8E8E93',
] as const

export function corporateColors(): string[] {
  return [brand.theme.accent.toUpperCase(), ...CORPORATE_PALETTE_TAIL]
}

export const CORPORATE_COLORS = corporateColors()

export type SourceIconTone =
  | 'slate'
  | 'blue'
  | 'indigo'
  | 'rose'
  | 'orange'
  | 'violet'
  | 'sky'
  | 'teal'

export type ResolvedSourceAppearance = {
  iconId: SourceIconId
  tone: SourceIconTone
  color: string | null
  group: WellKnownGroup | 'other'
  customizable: boolean
}

/** Icons users may pick for computer / user-folder sources. */
export const CUSTOMIZABLE_ICONS: SourceIconId[] = [
  'folder',
  'documents',
  'downloads',
  'pictures',
  'movies',
  'music',
  'shared',
  'applications',
  'developer',
  'icloud',
]

export const SOURCE_TONE_DOT_COLORS: Record<SourceIconTone, string> = {
  slate: '#8E8E93',
  blue: '#3B82F6',
  indigo: '#6366F1',
  rose: '#F43F5E',
  orange: '#F97316',
  violet: '#8B5CF6',
  sky: '#0EA5E9',
  teal: '#14B8A6',
}

export function sourceAppearanceDotColor(appearance: ResolvedSourceAppearance): string {
  return appearance.color ?? SOURCE_TONE_DOT_COLORS[appearance.tone]
}

/** Corporate swatch that reflects the source's current color (custom or tone default). */
const TONE_SWATCH: Record<SourceIconTone, string> = {
  slate: '#8E8E93',
  blue: corporateColors()[0],
  indigo: '#5856D6',
  rose: '#FF2D55',
  orange: '#FF9500',
  violet: '#AF52DE',
  sky: '#5AC8FA',
  teal: '#34C759',
}

export function sourceAppearanceActiveSwatch(appearance: ResolvedSourceAppearance): string {
  if (appearance.color) return appearance.color.trim().toUpperCase()
  const toneColor = SOURCE_TONE_DOT_COLORS[appearance.tone].toUpperCase()
  const paletteMatch = CORPORATE_COLORS.find((color) => color.toUpperCase() === toneColor)
  return (paletteMatch ?? TONE_SWATCH[appearance.tone]).toUpperCase()
}

export function sourceAppearanceSwatchSelected(
  appearance: ResolvedSourceAppearance,
  swatch: string,
): boolean {
  return sourceAppearanceActiveSwatch(appearance) === swatch.trim().toUpperCase()
}

export function isCustomizableIconId(iconId: string): iconId is SourceIconId {
  return CUSTOMIZABLE_ICONS.includes(iconId as SourceIconId)
}

export const SOURCE_TONE_CLASSES: Record<SourceIconTone, string> = {
  slate: 'from-[var(--sidebar-line)] to-transparent text-[var(--app-fg)] opacity-80',
  blue: 'from-blue-500/10 to-transparent text-blue-500',
  indigo: 'from-indigo-500/10 to-transparent text-indigo-500',
  rose: 'from-rose-500/10 to-transparent text-rose-500',
  orange: 'from-orange-500/10 to-transparent text-orange-500',
  violet: 'from-violet-500/10 to-transparent text-violet-500',
  sky: 'from-sky-500/10 to-transparent text-sky-500',
  teal: 'from-teal-500/10 to-transparent text-teal-500',
}

const WELL_KNOWN_ICON: Record<string, SourceIconId> = {
  desktop: 'folder',
  documents: 'documents',
  downloads: 'downloads',
  pictures: 'pictures',
  movies: 'movies',
  videos: 'movies',
  music: 'music',
  shared: 'shared',
  developer: 'developer',
  applications: 'applications',
  icloud: 'icloud',
  dropbox: 'dropbox',
  onedrive: 'onedrive',
  google_drive: 'google_drive',
  external: 'volume',
  usb: 'usb',
  nas: 'volume',
}

const WELL_KNOWN_TONE: Record<string, SourceIconTone> = {
  desktop: 'slate',
  documents: 'blue',
  downloads: 'indigo',
  pictures: 'rose',
  movies: 'orange',
  videos: 'orange',
  music: 'violet',
  shared: 'teal',
  developer: 'slate',
  applications: 'slate',
  icloud: 'sky',
  dropbox: 'blue',
  onedrive: 'sky',
  google_drive: 'blue',
  external: 'violet',
  usb: 'violet',
  nas: 'violet',
}

export function normalizeSourceKey(path: string): string {
  return path.trim().replace(/\\/g, '/').toLowerCase()
}

const WELL_KNOWN_LEAF_ALIASES: Record<string, string> = {
  desktop: 'desktop',
  escritorio: 'desktop',
  documents: 'documents',
  documentos: 'documents',
  downloads: 'downloads',
  descargas: 'downloads',
  pictures: 'pictures',
  photos: 'pictures',
  imágenes: 'pictures',
  imagenes: 'pictures',
  movies: 'movies',
  películas: 'movies',
  peliculas: 'movies',
  videos: 'videos',
  music: 'music',
  música: 'music',
  musica: 'music',
  shared: 'shared',
  compartido: 'shared',
  developer: 'developer',
  applications: 'applications',
  aplicaciones: 'applications',
}

function normalizeLeafToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function catalogById(catalog: WellKnownSource[], id: string): WellKnownSource | null {
  return catalog.find((source) => source.id === id) ?? null
}

function isExternalVolumePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  const lower = normalized.toLowerCase()
  if (lower.includes('/system/volumes/')) return false
  if (/\/volumes\/[^/]+/i.test(normalized) && !/users|documents and settings/i.test(lower)) {
    return true
  }
  return /^[a-z]:\\/i.test(normalized) && !/users|documents and settings/i.test(lower)
}

export function matchWellKnownSource(
  name: string,
  path: string,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): WellKnownSource | null {
  const catalog = wellKnownSources(platform)

  const byLabel = catalog.find(
    (source: WellKnownSource) => sameSourceName(source.label, name) || sameSourceName(source.id, name),
  )
  if (byLabel) return byLabel

  const token = path.includes(':') && !path.includes('/')
    ? normalizeLeafToken(path.split(':').pop() ?? path)
    : normalizeLeafToken(sourceLabelFromPath(path))
  const leafId = WELL_KNOWN_LEAF_ALIASES[token]
  if (leafId) {
    const byLeaf = catalogById(catalog, leafId)
    if (byLeaf) return byLeaf
  }

  const text = `${name} ${path}`.toLowerCase()
  if (/icloud|clouddocs|mobile documents/i.test(text)) {
    return catalogById(catalog, 'icloud')
  }
  if (/dropbox/i.test(text)) return catalogById(catalog, 'dropbox')
  if (/onedrive|one drive/i.test(text)) return catalogById(catalog, 'onedrive')
  if (/google drive|google-drive|googledrive/i.test(text)) {
    return catalogById(catalog, 'google_drive')
  }
  if (isExternalVolumePath(path)) {
    if (/usb/i.test(text)) return catalogById(catalog, 'usb')
    if (/nas/i.test(text)) return catalogById(catalog, 'nas')
    return catalogById(catalog, 'external')
  }
  return null
}

function appearanceFromWellKnown(source: WellKnownSource): Omit<ResolvedSourceAppearance, 'color' | 'customizable'> {
  return {
    iconId: WELL_KNOWN_ICON[source.id] ?? 'folder',
    tone: WELL_KNOWN_TONE[source.id] ?? 'slate',
    group: source.group,
  }
}

/** Policy by source group — icon comes from catalog; color only where brand is ours. */
export function sourceAppearancePolicy(group: WellKnownGroup | 'other'): {
  customizable: boolean
} {
  if (group === 'computer' || group === 'other') return { customizable: true }
  return { customizable: false }
}

export function defaultSourceAppearance(
  name: string,
  path: string,
  kind?: SuggestedLocationKind,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): ResolvedSourceAppearance {
  const known = matchWellKnownSource(name, path, platform)
  if (known) {
    return {
      ...appearanceFromWellKnown(known),
      color: null,
      ...sourceAppearancePolicy(known.group),
    }
  }

  if (kind === 'volume' || /ssd|usb|nas|volume/.test(name.toLowerCase())) {
    if (/usb/.test(name.toLowerCase())) {
      return { iconId: 'usb', tone: 'violet', color: null, group: 'external', customizable: false }
    }
    return { iconId: 'volume', tone: 'violet', color: null, group: 'external', customizable: false }
  }

  return {
    iconId: 'folder',
    tone: 'slate',
    color: null,
    group: 'other',
    ...sourceAppearancePolicy('other'),
  }
}

export function resolveSourceAppearance(
  path: string,
  name: string,
  kind: SuggestedLocationKind | undefined,
  overrides: Record<string, SourceAppearanceOverride> | undefined,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): ResolvedSourceAppearance {
  const defaults = defaultSourceAppearance(name, path, kind, platform)
  if (!defaults.customizable) return defaults
  const override = overrides?.[normalizeSourceKey(path)]
  if (!override) return defaults
  return {
    ...defaults,
    ...(override.color ? { color: override.color } : {}),
    ...(override.iconId && isCustomizableIconId(override.iconId) ? { iconId: override.iconId } : {}),
  }
}

type RecentSourceCandidate = {
  path: string
  label: string
  kind?: SuggestedLocationKind
}

/** Match Recents entries the same way Sources cards resolve icon + tone. */
export function resolveRecentSourceAppearance(
  path: string,
  options: {
    suggested?: RecentSourceCandidate[]
    indexed?: RecentSourceCandidate[]
    overrides?: Record<string, SourceAppearanceOverride>
    platform?: 'darwin' | 'win32' | 'linux' | string
  } = {},
): ResolvedSourceAppearance {
  const platform = options.platform ?? 'darwin'
  const normalized = normalizeSourceKey(path)
  const leaf = sourceLabelFromPath(path)
  const catalogMatch =
    options.indexed?.find((item) => normalizeSourceKey(item.path) === normalized) ??
    options.suggested?.find((item) => normalizeSourceKey(item.path) === normalized) ??
    options.indexed?.find((item) => sameSourceName(item.label, leaf)) ??
    options.suggested?.find((item) => sameSourceName(item.label, leaf))

  if (catalogMatch) {
    return resolveSourceAppearance(
      catalogMatch.path,
      catalogMatch.label,
      catalogMatch.kind,
      options.overrides,
      platform,
    )
  }

  const identity = resolveSourceIdentity(path, platform)
  return resolveSourceAppearance(path, identity.name, identity.kind, options.overrides, platform)
}

export function isCorporateColor(color: string): boolean {
  const normalized = color.trim().toUpperCase()
  return corporateColors().some((entry) => entry.toUpperCase() === normalized)
}

export function sourceLabelFromPath(path: string): string {
  if (path.includes(':') && !path.includes('/')) {
    const token = path.split(':').pop() ?? path
    return token.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? path
}

export function resolveSourceIdentity(
  path: string,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): { name: string; kind?: SuggestedLocationKind } {
  const catalog = wellKnownSources(platform)
  const tokenMatch = catalog.find((source) => source.token.toLowerCase() === path.toLowerCase())
  if (tokenMatch) return { name: tokenMatch.label, kind: tokenMatch.kind }
  return { name: sourceLabelFromPath(path) }
}

export function canPersistSourceAppearanceColor(
  path: string,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
  hints?: { name?: string; kind?: SuggestedLocationKind },
): boolean {
  const identity = resolveSourceIdentity(path, platform)
  const name = hints?.name ?? identity.name
  const kind = hints?.kind ?? identity.kind
  return defaultSourceAppearance(name, path, kind, platform).customizable
}

export function normalizeSourceAppearanceStore(
  value: unknown,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): Record<string, SourceAppearanceOverride> {
  if (!value || typeof value !== 'object') return {}
  const next: Record<string, SourceAppearanceOverride> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') continue
    const color =
      'color' in raw && typeof raw.color === 'string' && isCorporateColor(raw.color) ? raw.color : undefined
    const iconId =
      'iconId' in raw && typeof raw.iconId === 'string' && isCustomizableIconId(raw.iconId)
        ? raw.iconId
        : undefined
    if (!color && !iconId) continue
    const normalizedKey = normalizeSourceKey(key)
    if (!canPersistSourceAppearanceColor(normalizedKey, platform)) continue
    next[normalizedKey] = {
      ...(color ? { color } : {}),
      ...(iconId ? { iconId } : {}),
    }
  }
  return next
}
