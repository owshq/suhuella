import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ADR = 'ADR-005'
const ADR_NOTE =
  `${ADR}: watch mode is a progress log, not a throttle — Plan executors must not add artificial pacing.`

/** Inline opt-out for infra timeouts that are not execution pacing (requires review + reason). */
const ALLOW_TAG = 'adr-005-pacing-allow'

type PlanExecutionSource = {
  id: string
  relativePath: string
}

const PLAN_EXECUTION_SOURCES: PlanExecutionSource[] = [
  { id: 'desktop', relativePath: 'desktop/electron/knowledge-set.ts' },
  { id: 'browser-host', relativePath: 'packages/product/src/host/install-browser-host.ts' },
  { id: 'browser-integrity', relativePath: 'packages/product/src/host/browser/organise-integrity.ts' },
]

const PACING_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: 'setTimeout', regex: /\bsetTimeout\s*\(/ },
  { id: 'setInterval', regex: /\bsetInterval\s*\(/ },
  { id: 'clearInterval', regex: /\bclearInterval\s*\(/ },
  { id: 'sleep-call', regex: /\b(?:sleep|delay|pause|idle|waitMs|waitForMs)\s*\(/i },
  { id: 'bun-sleep', regex: /\bBun\.sleep\b/ },
  { id: 'atomics-wait', regex: /\bAtomics\.wait\b/ },
  { id: 'await-sleep', regex: /\bawait\s+(?:sleep|delay)\s*\(/i },
  { id: 'promise-setTimeout', regex: /new\s+Promise[\s\S]{0,120}setTimeout/ },
]

function repoRoot(): string {
  const candidates: string[] = []
  if (typeof import.meta.url === 'string' && import.meta.url.length > 0) {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), '../../../..'))
  }
  candidates.push(process.cwd(), join(process.cwd(), '..'))
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'desktop/electron/knowledge-set.ts'))) return candidate
  }
  throw new Error(`${ADR_NOTE} Could not locate repo root for Plan execution pacing check.`)
}

function readSource(relativePath: string): string {
  const absolutePath = join(repoRoot(), relativePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`${ADR_NOTE} Missing Plan execution source: ${relativePath}`)
  }
  return readFileSync(absolutePath, 'utf8')
}

function lineAllowed(line: string): boolean {
  return line.includes(ALLOW_TAG)
}

function scanSource(source: PlanExecutionSource): string[] {
  const text = readSource(source.relativePath)
  const violations: string[] = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (lineAllowed(line)) continue
    for (const pattern of PACING_PATTERNS) {
      if (!pattern.regex.test(line)) continue
      violations.push(
        `${source.relativePath}:${index + 1} — ${pattern.id} (${source.id} Plan executor)`,
      )
      break
    }
  }
  return violations
}

export function runPlanExecutionPacingChecks(): void {
  const violations = PLAN_EXECUTION_SOURCES.flatMap((source) => scanSource(source))
  if (violations.length > 0) {
    throw new Error(`${ADR_NOTE}\n${violations.join('\n')}`)
  }
}

const selfUrl = typeof import.meta.url === 'string' ? import.meta.url : ''
if (selfUrl && process.argv[1] && fileURLToPath(selfUrl) === process.argv[1]) {
  runPlanExecutionPacingChecks()
  console.log('plan execution pacing checks passed')
}
