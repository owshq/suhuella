export const HOST_ACTION_COPY = {
  openFileDesktopOnly: 'Open the desktop app to open this document.',
  revealUnavailable: 'Open the desktop app to show this folder.',
  openFolderUnavailable: 'Open the desktop app to show this folder.',
  chooseFilesUnsupported: 'This browser cannot choose documents.',
  exportUnavailable: 'Export is not available on this platform.',
  launchAtLoginUnavailable: 'Open the desktop app to launch at sign-in.',
  saveAsPreviewOnly: 'This is a preview. Nothing was saved, and Activity does not record it.',
  saveAsPrepared:
    'The recommended folder is ready. Press Save in the other app. Activity records confirmed Plans, not Save As.',
  fileCouldNotOpen: 'That document could not be opened.',
  folderCouldNotReveal: 'That folder could not be shown.',
} as const

export class HostCapabilityError extends Error {
  readonly code = 'unavailable' as const

  constructor(message: string) {
    super(message)
    this.name = 'HostCapabilityError'
  }
}

export function isHostCapabilityError(error: unknown): error is HostCapabilityError {
  return error instanceof HostCapabilityError || (error instanceof Error && error.name === 'HostCapabilityError')
}
