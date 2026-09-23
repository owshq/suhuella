import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: ['electron/knowledge-set-check.ts'],
  outfile: 'dist-electron/knowledge-set-check.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'silent',
  alias: {
    '@suhuella/brand': path.join(desktopRoot, '../brands/index.ts'), // catalog OK for Node checks
    '@suhuella/product': path.join(desktopRoot, '../packages/product/src'),
  },
})

const electronMock = path.join(desktopRoot, 'electron/test-electron-mock.cjs')

const child = spawn(
  process.execPath,
  ['-r', electronMock, 'dist-electron/knowledge-set-check.cjs'],
  {
    stdio: 'inherit',
    cwd: desktopRoot,
  },
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
