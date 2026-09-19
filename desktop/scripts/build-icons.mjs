import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import sharp from 'sharp'
import toIco from 'to-ico'

const execFileAsync = promisify(execFile)
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = path.join(desktopRoot, 'assets')
const sitePublicDir = path.join(desktopRoot, '..', 'site', 'public')

const APP_ICON_SIZES = [512, 256, 192, 128, 64, 48, 32, 16]

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function buildAppIcons() {
  const masterSvg = path.join(assetsDir, 'icon.svg')
  const svg = await readFile(masterSvg)

  for (const size of APP_ICON_SIZES) {
    await sharp(svg).resize(size, size).png().toFile(path.join(assetsDir, `icon-${size}.png`))
  }

  await copyFile(path.join(assetsDir, 'icon-512.png'), path.join(assetsDir, 'icon.png'))

  const icoSizes = [256, 128, 64, 48, 32, 16]
  const icoBuffers = await Promise.all(
    icoSizes.map((size) => readFile(path.join(assetsDir, `icon-${size}.png`))),
  )
  await writeFile(path.join(assetsDir, 'icon.ico'), await toIco(icoBuffers))

  if (process.platform === 'darwin') {
    const iconsetDir = path.join(assetsDir, 'icon.iconset')
    await rm(iconsetDir, { recursive: true, force: true })
    await mkdir(iconsetDir, { recursive: true })

    const iconsetMap = [
      ['icon-16.png', 'icon_16x16.png'],
      ['icon-32.png', 'icon_16x16@2x.png'],
      ['icon-32.png', 'icon_32x32.png'],
      ['icon-64.png', 'icon_32x32@2x.png'],
      ['icon-128.png', 'icon_128x128.png'],
      ['icon-256.png', 'icon_128x128@2x.png'],
      ['icon-256.png', 'icon_256x256.png'],
      ['icon-512.png', 'icon_256x256@2x.png'],
      ['icon-512.png', 'icon_512x512.png'],
    ]

    for (const [source, target] of iconsetMap) {
      await copyFile(path.join(assetsDir, source), path.join(iconsetDir, target))
    }

    await execFileAsync('iconutil', [
      '-c',
      'icns',
      iconsetDir,
      '-o',
      path.join(assetsDir, 'icon.icns'),
    ])
    await rm(iconsetDir, { recursive: true, force: true })
  } else {
    console.log('[suhuella] icon.icns skipped — run build:icons on macOS to generate it.')
  }
}

async function buildTrayIcons() {
  const traySvg = path.join(assetsDir, 'trayTemplate.svg')
  const svg = await readFile(traySvg)
  await sharp(svg).resize(18, 18).png().toFile(path.join(assetsDir, 'trayTemplate.png'))
  await sharp(svg).resize(36, 36).png().toFile(path.join(assetsDir, 'trayTemplate@2x.png'))
}

async function syncWebAssets() {
  if (!(await exists(sitePublicDir))) return

  const brandPublicDir = path.join(desktopRoot, '..', 'brands', 'suhuella', 'assets', 'public')
  await mkdir(brandPublicDir, { recursive: true })

  await copyFile(path.join(assetsDir, 'icon-512.png'), path.join(sitePublicDir, 'suhuella-icon-512.png'))
  await copyFile(path.join(assetsDir, 'icon-256.png'), path.join(sitePublicDir, 'suhuella-icon-256.png'))
  await copyFile(path.join(assetsDir, 'icon-192.png'), path.join(sitePublicDir, 'suhuella-icon-192.png'))
  await copyFile(path.join(assetsDir, 'icon.svg'), path.join(sitePublicDir, 'suhuella-app-icon.svg'))

  await copyFile(path.join(assetsDir, 'icon-512.png'), path.join(brandPublicDir, 'suhuella-icon-512.png'))
  await copyFile(path.join(assetsDir, 'icon-256.png'), path.join(brandPublicDir, 'suhuella-icon-256.png'))
  await copyFile(path.join(assetsDir, 'icon-192.png'), path.join(brandPublicDir, 'suhuella-icon-192.png'))
  await copyFile(path.join(assetsDir, 'icon.svg'), path.join(brandPublicDir, 'suhuella-app-icon.svg'))

  const faviconTargets = [
    path.join(sitePublicDir, 'favicon.ico'),
    path.join(desktopRoot, '..', 'site', 'app', 'favicon.ico'),
  ]
  for (const target of faviconTargets) {
    await copyFile(path.join(assetsDir, 'icon.ico'), target)
  }
}

await buildAppIcons()
await buildTrayIcons()
await syncWebAssets()

console.log('[suhuella] build:icons finished — app, tray, and web icon assets updated.')
