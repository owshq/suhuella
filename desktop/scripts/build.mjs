import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as viteBuild } from 'vite'
import {
  prepareDesktopPackAssets,
  prepareDesktopPublic,
  selectedBrandId,
  writeElectronBuilderConfig,
} from './brand-build.mjs'
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
for (const script of ['brands/run-release-gate.mjs', 'brands/project-brand.mjs']) {
  const step = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
  if (step.status !== 0) {
    process.exit(step.status ?? 1)
  }
}

process.env.SUHUELLA_BUILD ??= new Date().toISOString().slice(0, 10)
const brandId = selectedBrandId()
process.env.BRAND ??= brandId

await prepareDesktopPublic(brandId)
await prepareDesktopPackAssets(brandId)
await writeElectronBuilderConfig(brandId)
await run('npx', ['tsc', '-b'])
await viteBuild()
await buildElectron({ minify: true })
if (process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim()) {
  const inlining = spawnSync(process.execPath, ['scripts/license-build-inlining-check.mjs'], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    stdio: 'inherit',
    env: process.env,
  })
  if (inlining.status !== 0) {
    process.exit(inlining.status ?? 1)
  }
} else {
  console.warn(
    '[brand] SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS unset — offline Ed25519 verify will fail in this build',
  )
}
console.log(`[brand] desktop production build ready for ${brandId}`)
