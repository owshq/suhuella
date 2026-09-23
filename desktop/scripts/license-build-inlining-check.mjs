import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandBuildDir, selectedBrandId } from './brand-build.mjs'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandId = selectedBrandId()
const mainPath = path.join(brandBuildDir(brandId), 'dist-electron', 'main.cjs')
const publicKeys = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? ''

if (!publicKeys) {
  console.error(
    '[license-build-inlining] SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS is required for production desktop builds',
  )
  process.exit(1)
}

let bundle = ''
try {
  bundle = readFileSync(mainPath, 'utf8')
} catch {
  console.error(`[license-build-inlining] missing bundled main at ${mainPath} — run npm run build first`)
  process.exit(1)
}

for (const key of publicKeys.split(',').map((value) => value.trim()).filter(Boolean)) {
  if (!bundle.includes(key)) {
    console.error(
      '[license-build-inlining] bundled main.cjs does not contain embedded public key — esbuild define may be missing',
    )
    process.exit(1)
  }
}

console.log('[license-build-inlining] public keys are embedded in dist-electron/main.cjs')
