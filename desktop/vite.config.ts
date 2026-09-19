import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
// @ts-ignore
import { brandBuildDir, selectedBrandEntry, selectedBrandId } from './scripts/brand-build.mjs'

const brandId = selectedBrandId()

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@suhuella/brand': selectedBrandEntry(),
    },
  },
  publicDir: path.join(brandBuildDir(brandId), 'public'),
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.join(brandBuildDir(brandId), 'dist'),
    emptyOutDir: true,
  },
})
