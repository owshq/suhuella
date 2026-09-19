import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describeKnowledgeItem } from './descriptors.ts'
import { buildFileProfile, buildFolderProfile, rankFolders } from './recommendations.ts'
import { attachLocalSource, sourcesFromLocalLocations } from './knowledge-sources.ts'
import type { FolderIndex, IndexedFolderEntry, KnowledgeSource } from '@suhuella/product/types.ts'

const DEFAULT_CASES_NAME = 'match-benchmark.local.json'
const DEFAULT_RESULTS_NAME = 'match-benchmark-results.local.json'
const INDEX_FILE = 'index.json'
const INDEX_VERSION = 2

type RealBenchmarkCase = {
  inputFilename: string
  expectedFolderPath: string
}

type RealBenchmarkFile = {
  version: number
  name: string
  cases: RealBenchmarkCase[]
}

type CaseResult = {
  inputFilename: string
  expectedFolderPath: string
  top1FolderPath: string | null
  top5FolderPaths: string[]
  top1Correct: boolean
  top3Correct: boolean
  top5Correct: boolean
  confidenceLabel: string | null
  reasons: string[]
  contributions: Array<{ label: string; points: number }>
  failure?: {
    expectedFolder: string
    actualTop1: string | null
    missingSignals: string[]
    dominantWrongScorer: string | null
    genericFolderPenaltyFailed: boolean
    extensionScoreTooStrong: boolean
  }
}

const desktopRoot = process.cwd()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function percent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 1000) / 10}%`
}

function normalizeFolderPath(value: string): string {
  const normalized = path.normalize(value.trim()).replace(/[\\/]+$/, '')
  return process.platform === 'linux' ? normalized : normalized.toLowerCase()
}

function pathsMatch(actual: string, expected: string): boolean {
  const actualNorm = normalizeFolderPath(actual)
  const expectedNorm = normalizeFolderPath(expected)
  if (actualNorm === expectedNorm) return true

  const expectedAsPosix = expectedNorm.replace(/\\/g, '/')
  const actualAsPosix = actualNorm.replace(/\\/g, '/')
  return actualAsPosix.endsWith(`/${expectedAsPosix}`)
}

function defaultCasesPath(): string {
  return process.env.SUHUELLA_BENCHMARK?.trim() || path.join(desktopRoot, DEFAULT_CASES_NAME)
}

function defaultResultsPath(casesPath: string): string {
  if (process.env.SUHUELLA_BENCHMARK?.trim()) {
    return path.join(path.dirname(casesPath), DEFAULT_RESULTS_NAME)
  }
  return path.join(desktopRoot, DEFAULT_RESULTS_NAME)
}

function electronUserDataCandidates(): string[] {
  const fromEnv = process.env.SUHUELLA_USER_DATA?.trim()
  const names = ['SuHuella', 'suhuella-desktop']

  if (process.platform === 'darwin') {
    return [
      ...(fromEnv ? [fromEnv] : []),
      ...names.map((name) => path.join(os.homedir(), 'Library', 'Application Support', name)),
    ]
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA?.trim()
    return [
      ...(fromEnv ? [fromEnv] : []),
      ...(appData ? names.map((name) => path.join(appData, name)) : []),
    ]
  }

  const configHome = process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), '.config')
  return [
    ...(fromEnv ? [fromEnv] : []),
    ...names.map((name) => path.join(configHome, name)),
  ]
}

function resolveIndexPath(): string | null {
  const fromEnv = process.env.SUHUELLA_INDEX?.trim()
  if (fromEnv) return fromEnv

  const ranked = electronUserDataCandidates()
    .map((userData) => path.join(userData, INDEX_FILE))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => ({
      filePath,
      mtime: statSync(filePath).mtimeMs,
    }))
    .sort((left, right) => right.mtime - left.mtime)

  return ranked[0]?.filePath ?? null
}

function loadFolderIndex(filePath: string): FolderIndex {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  if (!isRecord(parsed) || !Array.isArray(parsed.folders)) {
    throw new Error(`Knowledge Index at ${filePath} is not a valid index.json`)
  }

  const indexedAt =
    typeof parsed.indexedAt === 'string'
      ? parsed.indexedAt
      : typeof parsed.generatedAt === 'string'
        ? parsed.generatedAt
        : null
  const locations = Array.isArray(parsed.locations)
    ? parsed.locations.filter((item): item is string => typeof item === 'string')
    : []
  const declaredSources = Array.isArray(parsed.sources)
    ? parsed.sources.filter((item): item is KnowledgeSource => {
        return (
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.type === 'string' &&
          typeof item.rootLocator === 'string'
        )
      })
    : []
  const sources =
    declaredSources.length > 0
      ? declaredSources
      : sourcesFromLocalLocations(locations, { lastIndexed: indexedAt })
  const folders = parsed.folders
    .filter((item): item is IndexedFolderEntry => isRecord(item) && typeof item.absolutePath === 'string')
    .map((folder) => attachLocalSource(folder, sources))

  return {
    version: typeof parsed.version === 'number' ? parsed.version : INDEX_VERSION,
    indexVersion: typeof parsed.indexVersion === 'number' ? parsed.indexVersion : INDEX_VERSION,
    generatedAt: indexedAt,
    indexedAt,
    locations,
    sources,
    folders,
    files: [],
  }
}

function loadBenchmarkCases(filePath: string): RealBenchmarkFile {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  if (!isRecord(parsed) || !Array.isArray(parsed.cases)) {
    throw new Error(`Benchmark file must be JSON with a cases array: ${filePath}`)
  }

  const cases = parsed.cases
    .map((item): RealBenchmarkCase | null => {
      if (!isRecord(item)) return null
      const inputFilename =
        typeof item.inputFilename === 'string'
          ? item.inputFilename.trim()
          : typeof item.fileName === 'string'
            ? item.fileName.trim()
            : ''
      const expectedFolderPath =
        typeof item.expectedFolderPath === 'string' ? item.expectedFolderPath.trim() : ''
      if (!inputFilename || !expectedFolderPath) return null
      return { inputFilename, expectedFolderPath }
    })
    .filter((item): item is RealBenchmarkCase => item !== null)

  return {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    name: typeof parsed.name === 'string' ? parsed.name : 'Local real benchmark',
    cases,
  }
}

function sampleBenchmark(): RealBenchmarkFile {
  const unix = process.platform !== 'win32'
  return {
    version: 1,
    name: 'Local real benchmark',
    cases: [
      {
        inputFilename: 'Invoice_ACME_2026.pdf',
        expectedFolderPath: unix
          ? '/absolute/path/to/Clients/ACME/Invoices'
          : 'C:\\absolute\\path\\to\\Clients\\ACME\\Invoices',
      },
      {
        inputFilename: 'Yala_Hotel_Budget_2026.xlsx',
        expectedFolderPath: unix
          ? '/absolute/path/to/Projects/Yala/Budget'
          : 'C:\\absolute\\path\\to\\Projects\\Yala\\Budget',
      },
    ],
  }
}

function findExpectedFolder(
  folders: IndexedFolderEntry[],
  expectedFolderPath: string,
): IndexedFolderEntry | undefined {
  return folders.find(
    (folder) =>
      pathsMatch(folder.absolutePath, expectedFolderPath) ||
      pathsMatch(folder.relativePath, expectedFolderPath),
  )
}

function dominantScorer(
  scorers: Array<{ scorerId: string; score: number }>,
): { scorerId: string; score: number } | null {
  const ranked = [...scorers]
    .filter((item) => item.scorerId !== 'genericFolderPenaltyScorer')
    .sort((a, b) => b.score - a.score)
  return ranked[0] ?? null
}

function analyzeFailure(
  fileName: string,
  expectedFolderPath: string,
  folders: IndexedFolderEntry[],
  ranked: ReturnType<typeof rankFolders>,
): NonNullable<CaseResult['failure']> {
  const file = buildFileProfile(fileName)
  const expectedEntry = findExpectedFolder(folders, expectedFolderPath)
  const top1 = ranked[0]
  const missingSignals: string[] = []

  if (!expectedEntry) {
    missingSignals.push('expected folder is not in the Knowledge Index')
  } else {
    const expectedProfile = buildFolderProfile(expectedEntry)
    const haystack = [
      ...expectedProfile.folderNameTokens,
      ...expectedProfile.pathTokens,
      ...expectedProfile.existingFileTokens,
      ...expectedProfile.dominantEntities,
      ...expectedProfile.dominantDocumentHints,
    ]
    missingSignals.push(
      ...[...file.entities, ...file.documentHints, ...file.strongTokens].filter(
        (token) => !haystack.some((item) => item.includes(token) || token.includes(item)),
      ),
    )
  }

  const extension = top1?.scorers.find((item) => item.scorerId === 'extensionScorer')
  const extTooStrong =
    Boolean(top1) &&
    (extension?.score ?? 0) >= 4 &&
    (top1?.score ?? 0) > 0 &&
    (extension?.score ?? 0) / (top1?.score ?? 1) >= 0.3
  const wrong = top1 ? dominantScorer(top1.scorers) : null
  const genericNames = new Set([
    'downloads',
    'desktop',
    'documents',
    'documentos',
    'docs',
    'misc',
    'general',
    'temp',
    'tmp',
    'old',
    'archive',
    'backup',
    'screenshots',
    'files',
    'pdfs',
  ])
  const genericWon = Boolean(
    top1 && genericNames.has(path.basename(top1.folder).toLowerCase()),
  )

  return {
    expectedFolder: expectedEntry?.absolutePath ?? expectedFolderPath,
    actualTop1: top1?.folder ?? null,
    missingSignals,
    dominantWrongScorer: wrong ? `${wrong.scorerId} (${wrong.score})` : null,
    genericFolderPenaltyFailed: genericWon,
    extensionScoreTooStrong: extTooStrong,
  }
}

function printMissingBenchmarkHelp(casesPath: string): void {
  console.error('No local benchmark file found.')
  console.error('')
  console.error('This command does not scan the disk. Create a private JSON file with cases, then rerun.')
  console.error('')
  console.error(`Expected file:`)
  console.error(`  ${casesPath}`)
  console.error('')
  console.error('Generate placeholders:')
  console.error('  npm run benchmark:match:sample')
  console.error('')
  console.error('Example:')
  console.error(
    JSON.stringify(
      {
        version: 1,
        name: 'Local real benchmark',
        cases: [
          {
            inputFilename: 'Invoice_ACME_2026.pdf',
            expectedFolderPath: '/absolute/path/to/Clients/ACME/Invoices',
          },
        ],
      },
      null,
      2,
    ),
  )
  console.error('')
  console.error('The file may contain personal paths. It is gitignored. Do not commit it.')
}

function printMissingIndexHelp(tried: string[]): void {
  console.error('No local Knowledge Index found.')
  console.error('')
  console.error('Open SuHuella, finish onboarding, and index learning locations first.')
  console.error('This command uses the current userData index.json. It does not scan the disk.')
  console.error('')
  console.error('Looked for:')
  for (const filePath of tried) {
    console.error(`  ${filePath}`)
  }
  console.error('')
  console.error('Override if needed:')
  console.error('  SUHUELLA_INDEX=/path/to/index.json npm run benchmark:match:real')
}

function writeSample(): number {
  const casesPath = defaultCasesPath()
  if (existsSync(casesPath)) {
    console.error(`A local benchmark file already exists:`)
    console.error(`  ${casesPath}`)
    console.error('')
    console.error('Edit that file. This command will not overwrite a private benchmark.')
    return 1
  }

  mkdirSync(path.dirname(casesPath), { recursive: true })
  writeFileSync(casesPath, `${JSON.stringify(sampleBenchmark(), null, 2)}\n`, 'utf8')
  console.log('Wrote placeholder benchmark file:')
  console.log(`  ${casesPath}`)
  console.log('')
  console.log('Replace the placeholder paths with folders that exist in your Knowledge Index.')
  console.log('The file is gitignored. Do not commit personal paths.')
  return 0
}

function runRealBenchmark(): number {
  const casesPath = defaultCasesPath()
  if (!existsSync(casesPath)) {
    printMissingBenchmarkHelp(casesPath)
    return 1
  }

  const indexPath = resolveIndexPath()
  if (!indexPath) {
    printMissingIndexHelp(
      electronUserDataCandidates().map((userData) => path.join(userData, INDEX_FILE)),
    )
    return 1
  }

  const index = loadFolderIndex(indexPath)
  if (index.folders.length === 0) {
    console.error(`Knowledge Index has no folders:`)
    console.error(`  ${indexPath}`)
    console.error('')
    console.error('Index learning locations in SuHuella first. This command does not scan the disk.')
    return 1
  }

  const benchmark = loadBenchmarkCases(casesPath)
  if (benchmark.cases.length === 0) {
    console.error(`Benchmark file has no valid cases:`)
    console.error(`  ${casesPath}`)
    console.error('Each case needs inputFilename and expectedFolderPath.')
    return 1
  }

  console.log('SuHuella matching benchmark (local real Knowledge Index — nothing is uploaded)\n')
  console.log(`  name: ${benchmark.name}`)
  console.log(`  cases: ${casesPath}`)
  console.log(`  index: ${indexPath}`)
  console.log(`  indexedFolders: ${index.folders.length}`)
  console.log(`  lastIndexed: ${index.indexedAt ?? 'unknown'}`)
  console.log('')

  let top1 = 0
  let top3 = 0
  let top5 = 0
  const results: CaseResult[] = []

  for (const testCase of benchmark.cases) {
    const ranked = rankFolders({
      descriptor: describeKnowledgeItem({
        origin: 'fixture',
        displayName: testCase.inputFilename,
      }),
      folders: index.folders,
    })
    const top = ranked.filter((item) => item.score > 0).slice(0, 5)
    const top1Correct = Boolean(
      top[0] && pathsMatch(top[0].folder, testCase.expectedFolderPath),
    )
    const top3Correct = top
      .slice(0, 3)
      .some((item) => pathsMatch(item.folder, testCase.expectedFolderPath))
    const top5Correct = top.some((item) => pathsMatch(item.folder, testCase.expectedFolderPath))

    if (top1Correct) top1 += 1
    if (top3Correct) top3 += 1
    if (top5Correct) top5 += 1

    const result: CaseResult = {
      inputFilename: testCase.inputFilename,
      expectedFolderPath: testCase.expectedFolderPath,
      top1FolderPath: top[0]?.folder ?? null,
      top5FolderPaths: top.map((item) => item.folder),
      top1Correct,
      top3Correct,
      top5Correct,
      confidenceLabel: top[0]?.confidenceLabel ?? null,
      reasons: top[0]?.reasons ?? [],
      contributions: top[0]?.contributions ?? [],
    }

    if (!top1Correct) {
      result.failure = analyzeFailure(
        testCase.inputFilename,
        testCase.expectedFolderPath,
        index.folders,
        ranked,
      )
    }

    results.push(result)

    const mark = top1Correct ? 'PASS' : top3Correct ? 'TOP3' : top5Correct ? 'TOP5' : 'FAIL'
    console.log(`${mark}  ${testCase.inputFilename}`)
    console.log(`  inputFilename: ${result.inputFilename}`)
    console.log(`  expectedFolderPath: ${result.expectedFolderPath}`)
    console.log(`  top1FolderPath: ${result.top1FolderPath ?? 'none'}`)
    console.log(`  top5FolderPaths: ${result.top5FolderPaths.join(' | ') || 'none'}`)
    console.log(
      `  top1Correct=${result.top1Correct} top3Correct=${result.top3Correct} top5Correct=${result.top5Correct}`,
    )
    console.log(`  confidenceLabel: ${result.confidenceLabel ?? 'none'}`)
    console.log(`  reasons: ${result.reasons.join('; ') || '—'}`)
    console.log(
      `  contributions: ${
        result.contributions.map((item) => `${item.label} ${item.points}`).join('; ') || '—'
      }`,
    )
    if (result.failure) {
      console.log(`  expected folder: ${result.failure.expectedFolder}`)
      console.log(`  actual top1: ${result.failure.actualTop1 ?? 'none'}`)
      console.log(
        `  missing signals: ${
          result.failure.missingSignals.length > 0
            ? result.failure.missingSignals.join(', ')
            : 'none'
        }`,
      )
      console.log(`  dominant wrong scorer: ${result.failure.dominantWrongScorer ?? 'none'}`)
      console.log(
        `  generic folder penalty failed: ${result.failure.genericFolderPenaltyFailed ? 'yes' : 'no'}`,
      )
      console.log(
        `  extension score too strong: ${result.failure.extensionScoreTooStrong ? 'yes' : 'no'}`,
      )
    }
    console.log('')
  }

  const total = benchmark.cases.length
  const summary = {
    totalCases: total,
    top1Accuracy: percent(top1, total),
    top3Accuracy: percent(top3, total),
    top5Accuracy: percent(top5, total),
    top1Count: top1,
    top3Count: top3,
    top5Count: top5,
    failedCases: results.filter((item) => !item.top1Correct).length,
  }

  console.log('Summary')
  console.log(`  totalCases: ${summary.totalCases}`)
  console.log(`  top1Accuracy: ${summary.top1Accuracy} (${summary.top1Count}/${total})`)
  console.log(`  top3Accuracy: ${summary.top3Accuracy} (${summary.top3Count}/${total})`)
  console.log(`  top5Accuracy: ${summary.top5Accuracy} (${summary.top5Count}/${total})`)
  console.log(`  failedCases: ${summary.failedCases}`)

  const resultsPath = defaultResultsPath(casesPath)
  writeFileSync(
    resultsPath,
    `${JSON.stringify(
      {
        version: 1,
        name: benchmark.name,
        generatedAt: new Date().toISOString(),
        indexPath,
        indexedFolders: index.folders.length,
        lastIndexed: index.indexedAt,
        summary,
        cases: results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(`  results: ${resultsPath}`)
  console.log('')
  console.log('Evaluation only. Weights, the Knowledge Index, and product behaviour were not changed.')
  return 0
}

const writeSampleMode = process.argv.includes('--sample')
process.exit(writeSampleMode ? writeSample() : runRealBenchmark())
