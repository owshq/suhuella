/**
 * Minimal Electron stub for Node-only desktop checks (knowledge-set-check bundle).
 * Real Electron APIs are unavailable outside the packaged app process.
 */
const Module = require('node:module')
const os = require('node:os')
const path = require('node:path')

const mockUserData = path.join(os.tmpdir(), 'suhuella-desktop-check-userdata')

const electronStub = {
  app: {
    getPath(name) {
      if (name === 'userData') return mockUserData
      if (name === 'home') return os.homedir()
      if (name === 'temp') return os.tmpdir()
      if (name === 'appData') return path.join(os.homedir(), 'Library', 'Application Support')
      if (name === 'desktop') return path.join(os.homedir(), 'Desktop')
      if (name === 'documents') return path.join(os.homedir(), 'Documents')
      if (name === 'downloads') return path.join(os.homedir(), 'Downloads')
      return path.join(mockUserData, String(name))
    },
    getVersion() {
      return '0.1.0-pre-rc'
    },
    getName() {
      return 'SuHuella'
    },
    isPackaged: false,
  },
  ipcMain: { handle() {}, on() {} },
  BrowserWindow: class {},
  nativeTheme: { shouldUseDarkColors: false, on() {} },
  shell: { openPath: async () => '', showItemInFolder() {} },
  dialog: {},
  clipboard: { writeText() {} },
}

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (request === 'electron') {
    return electronStub
  }
  return originalLoad(request, parent, isMain)
}
