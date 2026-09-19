/**
 * ElectronFileSystem lives in the main process.
 * The renderer never mutates the filesystem; it only calls SuhuellaAPI over IPC.
 */
export const ElectronFileSystem = {
  host: 'electron' as const,
  mutatesFromRenderer: false,
}
