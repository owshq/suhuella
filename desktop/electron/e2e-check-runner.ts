type CjsModuleRef = {
  main: NodeModule | undefined
  self: NodeModule
}

function readCjsModuleRef(): CjsModuleRef | null {
  const req = (globalThis as { require?: NodeRequire }).require
  const mod = (globalThis as { module?: NodeModule }).module
  if (req && mod) return { main: req.main, self: mod }
  return null
}

/** True when this bundle is the process entry (not imported by main.cjs). */
export function isDirectE2eCheckEntry(marker: string): boolean {
  const cjs = readCjsModuleRef()
  if (cjs && cjs.main !== cjs.self) return false

  const entry = process.argv.slice(1).join('\0')
  return entry.includes(marker)
}

function hasElectronRuntime(): boolean {
  return Boolean(process.versions.electron)
}

async function exitElectron(code: number): Promise<void> {
  if (!hasElectronRuntime()) {
    process.exit(code)
    return
  }
  const { app } = await import('electron')
  if (app.isReady()) {
    app.exit(code)
    return
  }
  void app.whenReady().then(() => app.exit(code))
}

/**
 * Runs a desktop E2E check only when invoked directly with LICENSE_E2E_SIGNED_CONTEXT.
 * Inert when bundled artifacts are accidentally opened — no main-process crash dialog.
 */
export function runDesktopE2eCheckWhenInvoked(input: {
  marker: string
  run: () => void
  passLabel: string
}): void {
  if (!isDirectE2eCheckEntry(input.marker)) return

  const raw = process.env.LICENSE_E2E_SIGNED_CONTEXT?.trim() ?? ''
  if (!raw) {
    console.error(
      `${input.passLabel}: not a desktop entry — run npm run dev, or invoke this bundle from the LICENSE-VERSION-FINAL-E2E harness with LICENSE_E2E_SIGNED_CONTEXT set.`,
    )
    void exitElectron(1)
    return
  }

  const execute = async () => {
    try {
      input.run()
      const runtime = hasElectronRuntime() ? 'real-electron' : 'electron-mock'
      console.log(`${input.passLabel}: PASS (${runtime})`)
      await exitElectron(0)
    } catch (error) {
      console.error(error)
      await exitElectron(1)
    }
  }

  if (hasElectronRuntime()) {
    void import('electron').then(({ app }) => {
      void app.whenReady().then(() => {
        void execute()
      })
    })
  } else {
    void execute()
  }
}
