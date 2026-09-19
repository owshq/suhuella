import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
// @ts-ignore
import { brandBuildDir, selectedBrandEntry, selectedBrandId } from './scripts/brand-build.mjs'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const productRoot = path.join(desktopRoot, '../packages/product')
const brandId = selectedBrandId()

export default defineConfig({
  root: productRoot,
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@suhuella/brand': selectedBrandEntry(),
      '@suhuella/product': path.join(productRoot, 'src'),
    },
  },
  publicDir: path.join(brandBuildDir(brandId), 'public'),
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [desktopRoot, productRoot, path.join(desktopRoot, '../brands')],
    },
  },
  build: {
    outDir: path.join(brandBuildDir(brandId), 'dist'),
    emptyOutDir: true,
  },
})
