import { spawn } from 'node:child_process'
import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['electron/match-benchmark.ts'],
  outfile: 'dist-electron/match-benchmark.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'silent',
})

const child = spawn(process.execPath, ['dist-electron/match-benchmark.cjs'], {
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
