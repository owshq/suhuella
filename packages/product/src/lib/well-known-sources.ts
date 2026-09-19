import type { SuggestedLocationKind } from '../types.ts'

export type WellKnownGroup = 'computer' | 'cloud' | 'external'

export type WellKnownSource = {
  id: string
  label: string
  group: WellKnownGroup
  token: string
  kind: SuggestedLocationKind
}

export function wellKnownSources(platform: 'darwin' | 'win32' | 'linux' | string): WellKnownSource[] {
  const movies = platform === 'win32'
    ? { id: 'videos', label: 'Videos', token: 'suhuella:videos' }
    : { id: 'movies', label: 'Movies', token: 'suhuella:movies' }

  const computer: WellKnownSource[] = [
    { id: 'desktop', label: 'Desktop', group: 'computer', token: 'suhuella:desktop', kind: 'user_folder' },
    { id: 'documents', label: 'Documents', group: 'computer', token: 'suhuella:documents', kind: 'user_folder' },
    { id: 'downloads', label: 'Downloads', group: 'computer', token: 'suhuella:downloads', kind: 'user_folder' },
    { id: 'pictures', label: 'Pictures', group: 'computer', token: 'suhuella:pictures', kind: 'user_folder' },
    { ...movies, group: 'computer', kind: 'user_folder' },
    { id: 'music', label: 'Music', group: 'computer', token: 'suhuella:music', kind: 'user_folder' },
    { id: 'shared', label: 'Shared', group: 'computer', token: 'suhuella:shared', kind: 'user_folder' },
  ]

  if (platform !== 'win32') {
    computer.push(
      { id: 'developer', label: 'Developer', group: 'computer', token: 'suhuella:developer', kind: 'user_folder' },
      { id: 'applications', label: 'Applications', group: 'computer', token: 'suhuella:applications', kind: 'user_folder' },
    )
  }

  const cloud: WellKnownSource[] = [
    ...(platform === 'darwin'
      ? [{ id: 'icloud', label: 'iCloud Drive', group: 'cloud' as const, token: 'suhuella:icloud', kind: 'cloud_folder' as const }]
      : []),
    { id: 'dropbox', label: 'Dropbox', group: 'cloud', token: 'suhuella:dropbox', kind: 'cloud_folder' },
    { id: 'onedrive', label: 'OneDrive', group: 'cloud', token: 'suhuella:onedrive', kind: 'cloud_folder' },
    { id: 'google_drive', label: 'Google Drive', group: 'cloud', token: 'suhuella:google-drive', kind: 'cloud_folder' },
  ]

  const external: WellKnownSource[] = [
    { id: 'external', label: 'External SSD', group: 'external', token: 'suhuella:external', kind: 'volume' },
    { id: 'usb', label: 'USB', group: 'external', token: 'suhuella:usb', kind: 'volume' },
    { id: 'nas', label: 'NAS', group: 'external', token: 'suhuella:nas', kind: 'volume' },
  ]

  return [...computer, ...cloud, ...external]
}

export function sameSourceName(left: string, right: string): boolean {
  return left.replace(/\s+/g, '').toLowerCase() === right.replace(/\s+/g, '').toLowerCase()
}
