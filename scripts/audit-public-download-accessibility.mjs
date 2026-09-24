/**
 * Read-only audit: what is publicly reachable vs release.json manifest (no mutations).
 *
 *   node scripts/audit-public-download-accessibility.mjs
 *   node scripts/audit-public-download-accessibility.mjs --write-report
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandIdentity, resolveBrandId } from '../brands/select.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const writeReport = process.argv.includes('--write-report')
const brandId = resolveBrandId()
const identity = brandIdentity(brandId)
const manifest = JSON.parse(readFileSync(path.join(root, 'brands/suhuella/release.json'), 'utf8'))
const version = manifest.version
const tag = version.startsWith('v') ? version : `v${version}`
const REPO = process.env.GITHUB_REPO ?? 'owshq/suhuella'

const ALIASES = {
  mac: 'https://download.suhuella.com/latest/mac',
  win: 'https://download.suhuella.com/latest/win',
  macSha: 'https://download.suhuella.com/latest/mac.sha256',
  winSha: 'https://download.suhuella.com/latest/win.sha256',
  apiRelease: 'https://suhuella.com/api/release',
}

async function headRedirect(url) {
  const res = await fetch(url, { redirect: 'manual' })
  return {
    url,
    status: res.status,
    location: res.headers.get('location') ?? null,
  }
}

async function headFinal(url) {
  const res = await fetch(url, { redirect: 'follow', method: 'HEAD' })
  const length = res.headers.get('content-length')
  return {
    finalUrl: res.url,
    status: res.status,
    size: length ? Number.parseInt(length, 10) : null,
  }
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  return { url: res.url, status: res.status, text: await res.text() }
}

function parseSha256Sidecar(text) {
  const match = text.trim().match(/^([a-f0-9]{64})\s+/i)
  return match?.[1]?.toLowerCase() ?? null
}

async function githubReleaseAssets() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!res.ok) return { ok: false, status: res.status, assets: [] }
  const release = await res.json()
  return {
    ok: true,
    assets: (release.assets ?? []).map((asset) => ({
      name: asset.name,
      size: asset.size,
      url: asset.browser_download_url,
    })),
  }
}

function compareField(label, manifestValue, observedValue) {
  const match =
    manifestValue == null || observedValue == null
      ? null
      : String(manifestValue).toLowerCase() === String(observedValue).toLowerCase()
  return { label, manifest: manifestValue ?? null, observed: observedValue ?? null, match }
}

async function main() {
  console.log('Public download accessibility audit (read-only)')
  console.log(`Version: ${version}`)
  console.log('')

  const [macHead, winHead, apiRelease, ghRelease] = await Promise.all([
    headRedirect(ALIASES.mac),
    headRedirect(ALIASES.win),
    fetch(ALIASES.apiRelease).then(async (res) => ({ status: res.status, body: await res.json() })),
    githubReleaseAssets(),
  ])

  console.log('Alias redirects (302 expected):')
  console.log(`  ${ALIASES.mac} → ${macHead.location ?? '(none)'} [${macHead.status}]`)
  console.log(`  ${ALIASES.win} → ${winHead.location ?? '(none)'} [${winHead.status}]`)
  console.log('')

  const winAsset =
    ghRelease.assets?.find((a) => a.name === `${identity.desktopProductName}-${version}.exe`) ??
    ghRelease.assets?.find((a) => a.name.startsWith(`${identity.desktopProductName}-`) && a.name.endsWith('.exe'))
  const winSidecar = winAsset
    ? ghRelease.assets?.find((a) => a.name === `${winAsset.name}.sha256`)
    : null

  let winSidecarSha = null
  if (winSidecar?.url) {
    const sidecar = await fetchText(winSidecar.url)
    winSidecarSha = parseSha256Sidecar(sidecar.text)
  }

  let aliasWinSize = null
  let aliasFinalUrl = null
  if (winHead.location) {
    const probe = await headFinal(winHead.location)
    aliasWinSize = probe.size
    aliasFinalUrl = probe.finalUrl
    console.log('Alias-resolved Windows artifact (HEAD only — no download):')
    console.log(`  Final URL: ${probe.finalUrl}`)
    console.log(`  Size: ${probe.size ?? '(unknown)'} bytes`)
    console.log(`  SHA256: use GitHub sidecar or manifest (this audit does not download the installer)`)
    console.log('')
  }

  const manifestWin = manifest.downloads?.windows ?? {}
  const apiWin = apiRelease.body?.release?.downloads?.windows ?? apiRelease.body?.downloads?.windows ?? {}

  const observedSha = winSidecarSha
  const observedSize = winAsset?.size ?? aliasWinSize
  const comparisons = [
    compareField('windows.sha256', manifestWin.sha256, observedSha),
    compareField('windows.size', manifestWin.size, observedSize),
    compareField('api.windows.sha256', apiWin.sha256, observedSha),
  ]

  console.log('Manifest vs publicly served Windows artifact:')
  for (const row of comparisons) {
    const flag = row.match === true ? 'MATCH' : row.match === false ? 'MISMATCH' : 'UNKNOWN'
    console.log(`  ${row.label}: manifest=${row.manifest} observed=${row.observed} → ${flag}`)
  }
  console.log('')

  const publiclyReachable = winHead.status === 302 && Boolean(winHead.location)
  const manifestStale = comparisons.some((row) => row.match === false)

  console.log('Findings:')
  console.log(
    `  • download.suhuella.com/latest/win is ${publiclyReachable ? 'PUBLICLY REACHABLE' : 'NOT REACHABLE'} (redirects to GitHub Release asset, not gated by release.json)`,
  )
  if (manifestStale) {
    console.log(
      '  • release.json /api/release SHA256 may NOT match the file served by the download alias — alias follows Wrangler WIN_LATEST_URL, not manifest alone',
    )
  }
  if (ghRelease.ok && winAsset) {
    console.log(`  • GitHub Release ${tag} exposes ${winAsset.name} (${winAsset.size} bytes) without authentication`)
  }
  console.log(
    '  • Ephemeral-key CI builds must NOT clobber GitHub Release assets — see desktop-windows-build.yml guard',
  )
  console.log('')

  const report = {
    auditedAt: new Date().toISOString(),
    version,
    aliases: ALIASES,
    redirects: { mac: macHead, win: winHead },
    manifestWindows: manifestWin,
    apiReleaseWindows: apiWin,
    githubRelease: ghRelease.ok
      ? {
          tag,
          winAsset: winAsset ?? null,
          winSidecarSha256: winSidecarSha,
        }
      : { tag, error: ghRelease.status },
    aliasResolvedWindows: aliasWinSize ? { finalUrl: aliasFinalUrl, size: aliasWinSize } : null,
    comparisons,
    publiclyReachable,
    manifestStale,
    notes: [
      'Alias redirects are public even when release.json was not updated by publish:*',
      'PreRcReleaseValidation PASS does not imply production license compatibility',
    ],
  }

  if (writeReport) {
    const outDir = path.join(root, 'desktop/.build', brandId)
    mkdirSync(outDir, { recursive: true })
    const reportPath = path.join(outDir, 'PUBLIC-DOWNLOAD-AUDIT.json')
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`Report written: ${reportPath}`)
  }

  if (manifestStale) process.exitCode = 2
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
