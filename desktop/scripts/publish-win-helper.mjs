import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = path.join(desktopRoot, 'native', 'win-save-watcher', 'SuhuellaSaveWatcher.csproj')
const output = path.join(desktopRoot, 'native', 'win-save-watcher', 'publish')
const helperExe = path.join(output, 'SuhuellaSaveWatcher.exe')
const required = process.argv.includes('--required')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: desktopRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}`))
    })
    child.on('error', reject)
  })
}

if (process.platform !== 'win32') {
  if (required) {
    console.error(
      '[suhuella] package:win must be run on Windows so SuhuellaSaveWatcher.exe can be compiled and bundled. Do not compile the net48 helper on macOS.',
    )
    process.exit(1)
  }
  await mkdir(output, { recursive: true })
  await writeFile(
    path.join(output, 'README.txt'),
    'SuhuellaSaveWatcher.exe must be published on Windows:\n\n  npm run publish:win-helper\n',
  )
  console.warn('[suhuella] Windows save-dialog helper is compiled on Windows only. Skipping publish.')
  process.exit(0)
}

await run('dotnet', ['publish', project, '-c', 'Release', '-o', output])
await access(helperExe, constants.F_OK)
console.log(`[suhuella] published Windows save-dialog helper to ${output}`)
