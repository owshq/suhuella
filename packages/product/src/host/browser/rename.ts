const ILLEGAL_CHARS = /[\\/:*?"<>|]/g
const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'lpt1',
  'lpt2',
  'lpt3',
])

export type SafeFilenameIssue =
  | 'illegal_characters'
  | 'spaces'
  | 'repeated_spaces'
  | 'trailing_space'
  | 'trailing_dot'
  | 'duplicate_separators'
  | 'too_long'

export type RenameStrategy = 'normalize' | 'shorten' | 'disambiguate' | 'keep_original'

export type RenameProposal = {
  name: string
  explanation: string
  strategy: RenameStrategy
  reasons: string[]
}

function splitFileName(fileName: string): { stem: string; extension: string } {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0) return { stem: fileName, extension: '' }
  return { stem: fileName.slice(0, lastDot), extension: fileName.slice(lastDot) }
}

function nameTokens(stem: string): string[] {
  return stem
    .replace(ILLEGAL_CHARS, ' ')
    .split(/[\s_\-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function siblingUsesUnderscores(siblingNames: string[]): boolean {
  return siblingNames.some((name) => splitFileName(name).stem.includes('_'))
}

export function analyzeFilenameIssues(fileName: string): SafeFilenameIssue[] {
  const { stem } = splitFileName(fileName)
  const issues: SafeFilenameIssue[] = []

  if (ILLEGAL_CHARS.test(stem)) issues.push('illegal_characters')
  if (/\s{2,}/.test(stem)) issues.push('repeated_spaces')
  else if (/\s/.test(stem)) issues.push('spaces')
  if (/\s$/.test(stem)) issues.push('trailing_space')
  if (/\.$/.test(stem)) issues.push('trailing_dot')
  if (/__|--|[_\-.]\s|\s[_\-.]/.test(stem)) issues.push('duplicate_separators')
  if (fileName.length > 255) issues.push('too_long')

  return issues
}

function normalizeStem(stem: string): string {
  const cleaned = stem
    .replace(ILLEGAL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')

  return nameTokens(cleaned).join('_')
}

function shortenToMaxLength(name: string, max = 255): string {
  if (name.length <= max) return name

  const { stem, extension } = splitFileName(name)
  const maxStem = max - extension.length
  if (maxStem <= 0) return name.slice(0, max)

  return `${stem.slice(0, maxStem)}${extension}`
}

function buildRenameReasons(issues: SafeFilenameIssue[], matchStyle: boolean): string[] {
  const reasons: string[] = []

  if (issues.includes('illegal_characters')) {
    reasons.push('Invalid characters removed because Windows does not allow them.')
  }
  if (issues.includes('repeated_spaces') || issues.includes('duplicate_separators')) {
    reasons.push('Repeated spaces and separators collapsed for a cleaner name.')
  }
  if (issues.includes('trailing_space') || issues.includes('trailing_dot')) {
    reasons.push('Trailing spaces or dots removed so the name saves reliably.')
  }
  if (issues.includes('too_long')) {
    reasons.push('Name shortened to stay within the maximum file name length.')
  }
  if (matchStyle) {
    reasons.push('Underscores match your existing naming style in this folder.')
  } else if (issues.includes('spaces') || issues.includes('repeated_spaces')) {
    reasons.push('Spaces replaced with underscores so the name stays easy to find.')
  }

  return reasons.length > 0
    ? reasons
    : ['Filename normalised for safe use on your system.']
}

export function proposeSafeRename(
  fileName: string,
  siblingNames: string[] = [],
): RenameProposal | null {
  const issues = analyzeFilenameIssues(fileName)
  if (issues.length === 0) return null

  const { stem, extension } = splitFileName(fileName)
  const proposedStem = normalizeStem(stem)
  if (!proposedStem) return null
  if (WINDOWS_RESERVED.has(proposedStem.toLowerCase())) return null

  let proposed = shortenToMaxLength(`${proposedStem}${extension}`)
  if (proposed.toLowerCase() === fileName.toLowerCase()) return null

  const matchStyle = siblingUsesUnderscores(siblingNames)
  const reasons = buildRenameReasons(issues, matchStyle)

  return {
    name: proposed,
    explanation: reasons.join(' '),
    strategy: 'normalize',
    reasons,
  }
}

export function validateSafeFileName(fileName: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = fileName.trim()
  if (!trimmed) {
    return { ok: false, reason: 'File name cannot be empty.' }
  }
  if (trimmed !== fileName) {
    return { ok: false, reason: 'File name cannot have leading or trailing spaces.' }
  }
  if (trimmed === '.' || trimmed === '..') {
    return { ok: false, reason: 'That file name is not allowed.' }
  }
  if (ILLEGAL_CHARS.test(trimmed)) {
    return { ok: false, reason: 'File name contains characters your system does not allow.' }
  }
  if (trimmed.length > 255) {
    return { ok: false, reason: 'File name is too long.' }
  }

  const { stem } = splitFileName(trimmed)
  if (/\s$/.test(stem) || /\.$/.test(stem)) {
    return { ok: false, reason: 'File name cannot end with a space or dot.' }
  }
  if (WINDOWS_RESERVED.has(stem.toLowerCase())) {
    return { ok: false, reason: 'That file name is reserved by Windows.' }
  }

  return { ok: true }
}

export function renameNameConflicts(
  proposedName: string,
  currentName: string,
  siblingNames: string[],
): boolean {
  const proposed = proposedName.toLowerCase()
  const current = currentName.toLowerCase()
  if (proposed === current) return false
  return siblingNames.some((name) => name.toLowerCase() === proposed)
}
