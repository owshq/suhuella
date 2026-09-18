import { spawn } from 'node:child_process'
import electronPath from 'electron'
import { createServer } from 'vite'
import { buildElectron } from './electron-esbuild.mjs'

await buildElectron()

const vite = await createServer()
await vite.listen()
const urls = vite.resolvedUrls
const devServerUrl = urls?.local[0] ?? 'http://localhost:5173'

console.log(`SuHuella renderer: ${devServerUrl}`)

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
