import * as esbuild from 'esbuild'
import path from 'node:path'
import { brandBuildDir, desktopRoot, selectedBrandEntry } from './brand-build.mjs'

const brandEntry = selectedBrandEntry()
const outDir = path.join(brandBuildDir(), 'dist-electron')
const buildVersion = process.env.SUHUELLA_BUILD ?? 'local'
const licenseVerifyPublicKeys = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ?? ''

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
  alias: {
    '@suhuella/brand': brandEntry,
    '@suhuella/product': path.join(desktopRoot, '../packages/product/src'),
  },
  define: {
    __SUHUELLA_BUILD__: JSON.stringify(buildVersion),
    'process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS': JSON.stringify(licenseVerifyPublicKeys),
    'process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY': JSON.stringify(
      licenseVerifyPublicKeys.split(',')[0]?.trim() ?? '',
    ),
  },
}

export async function buildElectron({ watch = false, minify = false } = {}) {
  const electronDir = watch ? path.join(desktopRoot, 'dist-electron') : outDir
  const options = [
    {
      ...shared,
      entryPoints: ['electron/main.ts'],
      outfile: path.join(electronDir, 'main.cjs'),
      minify,
      sourcemap: !minify,
    },
    {
      ...shared,
      entryPoints: ['electron/preload.ts'],
      outfile: path.join(electronDir, 'preload.js'),
      minify,
      sourcemap: !minify,
    },
  ]

  if (watch) {
    const contexts = await Promise.all(options.map((item) => esbuild.context(item)))
    await Promise.all(contexts.map((context) => context.watch()))
    return contexts
  }

  await Promise.all(options.map((item) => esbuild.build(item)))
}
