/**
 * Phase 2B closure monitor — remote D1 HMAC presentations in lookback window.
 *
 *   node scripts/monitor-license-hmac-retirement.mjs
 *   node scripts/monitor-license-hmac-retirement.mjs --lookback-days 30 --json
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lookbackArg = process.argv.find((arg) => arg.startsWith('--lookback-days='))?.split('=')[1]
const lookbackIdx = process.argv.indexOf('--lookback-days')
const lookbackDays = Number.parseInt(
  lookbackArg ?? (lookbackIdx >= 0 ? process.argv[lookbackIdx + 1] : undefined) ?? '30',
  10,
) || 30
const jsonOut = process.argv.includes('--json')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function queryRemote(sql) {
  const wrangler = path.join(root, 'site/node_modules/.bin/wrangler')
  const result = spawnSync(
    wrangler,
    ['d1', 'execute', 'suhuella-license', '--remote', '--json', '--command', sql],
    { cwd: path.join(root, 'site'), encoding: 'utf8', env: process.env },
  )
  if (result.status !== 0) {
    fail(result.stderr || result.stdout || 'wrangler d1 execute failed')
  }
  try {
    const parsed = JSON.parse(result.stdout)
    const row = parsed?.[0]
    return row?.results ?? []
  } catch {
    fail('Could not parse wrangler d1 JSON output')
  }
}

function main() {
  const cutoffIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  const byAlgorithm = queryRemote(
    "SELECT COALESCE(last_presented_token_algorithm, 'unknown') AS algorithm, COUNT(*) AS n FROM license_activation WHERE status = 'active' GROUP BY algorithm ORDER BY algorithm;",
  )

  const hmacRecent = queryRemote(
    `SELECT COUNT(*) AS n FROM license_activation WHERE status = 'active' AND last_presented_token_algorithm = 'legacy-hmac-sha256' AND last_seen >= '${cutoffIso}';`,
  )

  const hmacCount = Number(hmacRecent[0]?.n ?? 0)
  const payload = {
    checkedAt: new Date().toISOString(),
    lookbackDays,
    cutoffIso,
    closureReady: hmacCount === 0,
    hmacPresentationsRemaining: hmacCount,
    activeByAlgorithm: Object.fromEntries(
      byAlgorithm.map((row) => [row.algorithm, Number(row.n ?? 0)]),
    ),
    nextStep:
      hmacCount === 0
        ? 'Operator may schedule LICENSE_SIGNING_SECRET retirement (see LICENSE-HMAC-RETIREMENT-2B.md).'
        : 'Wait for desktop 006+2B adoption; re-run after communication §5.',
  }

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log('LICENSE-HMAC-RETIREMENT-2B monitor')
    console.log(`  lookback: ${lookbackDays} days (since ${cutoffIso})`)
    console.log(`  active by algorithm: ${JSON.stringify(payload.activeByAlgorithm)}`)
    console.log(`  HMAC presentations in window: ${hmacCount}`)
    console.log(`  closure ready: ${payload.closureReady ? 'YES' : 'NO'}`)
    console.log(`  → ${payload.nextStep}`)
  }

  if (!payload.closureReady) process.exit(2)
}

main()
