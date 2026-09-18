import * as esbuild from 'esbuild'

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
}

export async function buildElectron({ watch = false, minify = false } = {}) {
  const options = [
    {
      ...shared,
      entryPoints: ['electron/main.ts'],
      outfile: 'dist-electron/main.cjs',
      minify,
      sourcemap: !minify,
    },
    {
      ...shared,
      entryPoints: ['electron/preload.ts'],
      outfile: 'dist-electron/preload.js',
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
