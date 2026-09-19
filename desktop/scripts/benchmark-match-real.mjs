import { spawn } from 'node:child_process'
import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['electron/match-benchmark-real.ts'],
  outfile: 'dist-electron/match-benchmark-real.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'silent',
})

const child = spawn(
  process.execPath,
  ['dist-electron/match-benchmark-real.cjs', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
