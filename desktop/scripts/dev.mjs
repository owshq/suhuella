import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'
import { createServer } from 'vite'
import { desktopRoot, prepareDesktopPublic, selectedBrandId } from './brand-build.mjs'
import { buildElectron } from './electron-esbuild.mjs'

const brandId = selectedBrandId()
const repoRoot = path.resolve(desktopRoot, '..')
for (const script of ['brands/project-brand.mjs', 'brands/project-site.mjs']) {
  const brandProjection = spawnSync('node', [script], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (brandProjection.status !== 0) process.exit(brandProjection.status ?? 1)
}

await prepareDesktopPublic(brandId)
await buildElectron({ watch: true })

let vite
try {
  vite = await createServer()
  await vite.listen()
} catch (error) {
  if (error instanceof Error && error.message.includes('already in use')) {
    console.error('\nPort 5173 is in use — a previous desktop session is still running.')
    console.error('Run from repo root: npm run desktop:stop\n')
  }
  throw error
}
const urls = vite.resolvedUrls
const devServerUrl = urls?.local[0] ?? 'http://localhost:5173'

console.log(`${brandId} renderer: ${devServerUrl}`)

const child = spawn(String(electronPath), ['.', '--remote-debugging-port=9222'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl,
  },
})

const shutdown = async () => {
  if (!child.killed) child.kill()
  await vite.close()
  process.exit(0)
}

child.on('exit', async (code) => {
  await vite.close()
  process.exit(code ?? 0)
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
