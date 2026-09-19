import { describeKnowledgeItem } from './descriptors.ts'
import { tokenize, buildFileProfile, buildFolderProfile, rankFolders } from './recommendations.ts'
import type { IndexedFolderEntry } from '../src/types.ts'

const FIXTURE_ROOT = '/suhuella-benchmark'

type BenchmarkCase = {
  id: string
  fileName: string
  expected: string
  notes?: string
}

function fixtureFolder(relativePath: string, fileNames: string[]): IndexedFolderEntry {
  const absolutePath = `${FIXTURE_ROOT}/${relativePath}`
  const segments = relativePath.split('/').filter(Boolean)
  const folderName = segments.at(-1) ?? relativePath
  const extensions = [
    ...new Set(
      fileNames
        .map((name) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '')
        .filter(Boolean),
    ),
  ].sort()

  return {
    id: relativePath,
    sourceId: 'src_benchmark',
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath,
    folderName,
    parentTokens: tokenize(segments.slice(0, -1).join('/')),
    depth: segments.length,
    extensions,
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

const FIXTURE_FOLDERS: IndexedFolderEntry[] = [
  fixtureFolder('Clients', []),
  fixtureFolder('Clients/ACME', ['ACME_overview.docx']),
  fixtureFolder('Clients/ACME/Invoices', [
    'Invoice_ACME_2024.pdf',
    'Factura_ACME_2025.pdf',
    'Invoice_ACME_March.xlsx',
  ]),
  fixtureFolder('Clients/ACME/Contracts', [
    'Contract_ACME_signed.pdf',
    'Contrato_ACME_2025.docx',
  ]),
  fixtureFolder('Finance', []),
  fixtureFolder('Finance/Tax', ['IVA_2025_Q4.pdf', 'Tax_Return_2024.pdf', 'Impostos_2025.pdf']),
  fixtureFolder('Projects', []),
  fixtureFolder('Projects/Yala', ['Yala_notes.docx']),
  fixtureFolder('Projects/Yala/Budget', ['Yala_Hotel_Budget_2025.xlsx', 'Pressupost_Yala_2024.xlsx']),
  fixtureFolder('Projects/Zafiro', ['Zafiro_brief.docx']),
  fixtureFolder('Projects/Zafiro/Grants', [
    'Horizon_Proposal_Zafiro.docx',
    'Proposta_subvencio_Zafiro_2025.docx',
  ]),
  fixtureFolder('Documents', ['Notes.txt', 'Readme.docx']),
  fixtureFolder('Downloads', ['setup.exe', 'Invoice_download.pdf']),
  fixtureFolder('Desktop', ['todo.txt']),
  fixtureFolder('Documents/PDFs', ['scan_001.pdf', 'manual.pdf']),
]

const CASES: BenchmarkCase[] = [
  { id: 'invoice-en', fileName: 'Invoice_ACME_2026.pdf', expected: 'Clients/ACME/Invoices' },
  { id: 'invoice-es', fileName: 'Factura_ACME_2026.pdf', expected: 'Clients/ACME/Invoices' },
  { id: 'invoice-ca', fileName: 'Factura_ACME_setembre.pdf', expected: 'Clients/ACME/Invoices' },
  { id: 'contract-en', fileName: 'Contract_ACME_signed.pdf', expected: 'Clients/ACME/Contracts' },
  { id: 'contract-es', fileName: 'Contrato_ACME_firmado.pdf', expected: 'Clients/ACME/Contracts' },
  { id: 'contract-ca', fileName: 'Contracte_ACME_signat.pdf', expected: 'Clients/ACME/Contracts' },
  { id: 'tax-iva', fileName: 'IVA_2026_Q1.pdf', expected: 'Finance/Tax' },
  { id: 'tax-en', fileName: 'Tax_Return_2026.pdf', expected: 'Finance/Tax' },
  { id: 'tax-ca', fileName: 'Impostos_2026.pdf', expected: 'Finance/Tax' },
  { id: 'budget-en', fileName: 'Yala_Hotel_Budget_2026.xlsx', expected: 'Projects/Yala/Budget' },
  { id: 'budget-es', fileName: 'Presupuesto_Yala_Hotel.xlsx', expected: 'Projects/Yala/Budget' },
  { id: 'budget-ca', fileName: 'Pressupost_Yala_Hotel.xlsx', expected: 'Projects/Yala/Budget' },
  {
    id: 'grant-en',
    fileName: 'Horizon_Europe_Proposal_Draft.docx',
    expected: 'Projects/Zafiro/Grants',
  },
  {
    id: 'grant-es',
    fileName: 'Propuesta_subvencion_Zafiro.docx',
    expected: 'Projects/Zafiro/Grants',
  },
  {
    id: 'grant-ca',
    fileName: 'Proposta_subvencio_Zafiro.docx',
    expected: 'Projects/Zafiro/Grants',
  },
  {
    id: 'generic-should-lose',
    fileName: 'Invoice_ACME_2026.pdf',
    expected: 'Clients/ACME/Invoices',
    notes: 'Documents, Downloads, Desktop, and PDFs must not win',
  },
  {
    id: 'extension-xlsx',
    fileName: 'Invoice_ACME_2026.xlsx',
    expected: 'Clients/ACME/Invoices',
    notes: 'Extension must not dominate',
  },
  {
    id: 'extension-docx',
    fileName: 'Invoice_ACME_2026.docx',
    expected: 'Clients/ACME/Invoices',
    notes: 'Extension must not dominate',
  },
  {
    id: 'extension-pdf',
    fileName: 'Invoice_ACME_2026.pdf',
    expected: 'Clients/ACME/Invoices',
    notes: 'Extension must not dominate',
  },
]

const GENERIC_RELATIVE = new Set(['Documents', 'Downloads', 'Desktop', 'Documents/PDFs'])

function matchesExpected(folderPath: string, expected: string): boolean {
  const normalized = folderPath.replace(/\\/g, '/')
  return normalized === `${FIXTURE_ROOT}/${expected}` || normalized.endsWith(`/${expected}`)
}

function relativeOf(folderPath: string): string {
  return folderPath.replace(/\\/g, '/').replace(`${FIXTURE_ROOT}/`, '')
}

function percent(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 1000) / 10}%`
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
  expected: string,
  ranked: ReturnType<typeof rankFolders>,
): string[] {
  const file = buildFileProfile(fileName)
  const expectedEntry = FIXTURE_FOLDERS.find((folder) => folder.relativePath === expected)
  const expectedProfile = expectedEntry ? buildFolderProfile(expectedEntry) : null
  const top1 = ranked[0]
  const expectedRanked = ranked.find((item) => matchesExpected(item.folder, expected))
  const lines: string[] = []

  lines.push(`  expected: ${expected}`)
  lines.push(`  actual top 1: ${top1 ? relativeOf(top1.folder) : 'none'} (${top1?.score ?? 0})`)
  if (expectedRanked) {
    lines.push(`  expected rank score: ${expectedRanked.score} · ${expectedRanked.confidenceLabel}`)
  } else {
    lines.push('  expected folder was not a candidate or scored out of ranking')
  }

  if (expectedProfile) {
    const haystack = [
      ...expectedProfile.folderNameTokens,
      ...expectedProfile.pathTokens,
      ...expectedProfile.existingFileTokens,
      ...expectedProfile.dominantEntities,
      ...expectedProfile.dominantDocumentHints,
    ]
    const missing = [...file.entities, ...file.documentHints, ...file.strongTokens].filter(
      (token) => !haystack.some((item) => item.includes(token) || token.includes(item)),
    )
    lines.push(
      `  missing signals on expected folder: ${missing.length > 0 ? missing.join(', ') : 'none'}`,
    )
  }

  if (top1) {
    const wrong = dominantScorer(top1.scorers)
    if (wrong) {
      lines.push(`  dominant wrong scorer: ${wrong.scorerId} (${wrong.score})`)
    }
    const extension = top1.scorers.find((item) => item.scorerId === 'extensionScorer')
    const extTooStrong =
      (extension?.score ?? 0) >= 4 && top1.score > 0 && (extension?.score ?? 0) / top1.score >= 0.3
    lines.push(
      `  extension too strong: ${extTooStrong ? 'yes' : 'no'} (${extension?.score ?? 0})`,
    )
    const penalty = top1.scorers.find((item) => item.scorerId === 'genericFolderPenaltyScorer')
    const genericWon = GENERIC_RELATIVE.has(relativeOf(top1.folder))
    lines.push(
      `  generic folder penalty failed: ${genericWon ? 'yes' : 'no'} (penalty ${penalty?.score ?? 0})`,
    )
  }

  return lines
}

function run(): number {
  let top1 = 0
  let top3 = 0
  let top5 = 0
  const failed: BenchmarkCase[] = []

  console.log('SuHuella matching benchmark (synthetic fixture — does not scan this computer)\n')

  for (const testCase of CASES) {
    const ranked = rankFolders({
      descriptor: describeKnowledgeItem({
        origin: 'fixture',
        displayName: testCase.fileName,
      }),
      folders: FIXTURE_FOLDERS,
    })
    const top = ranked.filter((item) => item.score > 0).slice(0, 5)
    const top1Correct = Boolean(top[0] && matchesExpected(top[0].folder, testCase.expected))
    const top3Correct = top.slice(0, 3).some((item) => matchesExpected(item.folder, testCase.expected))
    const top5Correct = top.some((item) => matchesExpected(item.folder, testCase.expected))

    if (top1Correct) top1 += 1
    if (top3Correct) top3 += 1
    if (top5Correct) top5 += 1
    if (!top1Correct) failed.push(testCase)

    const mark = top1Correct ? 'PASS' : top3Correct ? 'TOP3' : top5Correct ? 'TOP5' : 'FAIL'
    console.log(`${mark}  ${testCase.id}`)
    console.log(`  input: ${testCase.fileName}`)
    console.log(`  expected: ${testCase.expected}`)
    console.log(`  top1: ${top[0] ? `${relativeOf(top[0].folder)} · ${top[0].score}% · ${top[0].confidenceLabel}` : 'none'}`)
    console.log(`  top5: ${top.map((item) => relativeOf(item.folder)).join(' | ') || 'none'}`)
    console.log(`  top1Correct=${top1Correct} top3Correct=${top3Correct} top5Correct=${top5Correct}`)
    if (top[0]) {
      console.log(`  reasons: ${top[0].reasons.join('; ') || '—'}`)
      console.log(
        `  contributions: ${top[0].contributions.map((item) => `${item.label} ${item.points}`).join('; ') || '—'}`,
      )
    }
    if (!top1Correct) {
      for (const line of analyzeFailure(testCase.fileName, testCase.expected, ranked)) {
        console.log(line)
      }
    }
    if (testCase.notes) console.log(`  notes: ${testCase.notes}`)
    console.log('')
  }

  const total = CASES.length
  console.log('Summary')
  console.log(`  totalCases: ${total}`)
  console.log(`  top1Accuracy: ${percent(top1, total)} (${top1}/${total})`)
  console.log(`  top3Accuracy: ${percent(top3, total)} (${top3}/${total})`)
  console.log(`  top5Accuracy: ${percent(top5, total)} (${top5}/${total})`)
  console.log(`  failedCases: ${failed.length === 0 ? 'none' : failed.map((item) => item.id).join(', ')}`)

  return failed.length === 0 ? 0 : 1
}

process.exit(run())
