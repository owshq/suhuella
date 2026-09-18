import { spawn } from 'node:child_process'
import { build as viteBuild } from 'vite'
import { buildElectron } from './electron-esbuild.mjs'

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}`))
    })
  })
}

await run('npx', ['tsc', '-b'])
await viteBuild()
await buildElectron({ minify: true })
