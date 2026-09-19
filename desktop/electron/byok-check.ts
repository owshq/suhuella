import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describeKnowledgeItem } from './descriptors.ts'
import {
  appendByokConversation,
  clearByokConversation,
  listByokConversation,
} from './byok-conversation.ts'
import { addByokPreference, listByokPreferences } from './byok-preferences-store.ts'
import { runByokContractChecks } from './byok.ts'
import { recommendFolders } from './recommendations.ts'
import type { IndexedFolderEntry } from '@suhuella/product/types.ts'

function desktopRoot(): string {
  const cwd = process.cwd()
  if (existsSync(path.join(cwd, 'electron/recommendations.ts'))) return cwd
  if (existsSync(path.join(cwd, 'desktop/electron/recommendations.ts'))) {
    return path.join(cwd, 'desktop')
  }
  return cwd
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function source(relativePath: string): string {
  return readFileSync(path.join(desktopRoot(), relativePath), 'utf8')
}

function assertNotImported(file: string, needle: string, message: string): void {
  const contents = source(file)
  assert(!contents.includes(needle), message)
}

function fixtureFolder(): IndexedFolderEntry {
  return {
    id: 'folder_invoices',
    sourceId: 'src_local_docs',
    sourceType: 'local_folder',
    kind: 'folder',
    name: 'Invoices',
    locator: '/docs/Clients/ACME/Invoices',
    absolutePath: '/docs/Clients/ACME/Invoices',
    relativePath: 'Clients/ACME/Invoices',
    folderName: 'Invoices',
    parentTokens: ['clients', 'acme'],
    depth: 3,
    extensions: ['pdf'],
    fileCount: 2,
    fileNames: ['Invoice_ACME_2024.pdf', 'Factura_ACME_2025.pdf'],
    lastModified: null,
  }
}

export function runByokChecks(): void {
  runByokContractChecks()

  assertNotImported(
    'electron/recommendations.ts',
    "from './byok",
    'Recommendation Engine must never import BYOK',
  )
  assertNotImported(
    'electron/local-intelligence.ts',
    "from './byok",
    'Local Intelligence must never import BYOK',
  )
  assertNotImported(
    'electron/knowledge-set.ts',
    "from './byok",
    'Organisation plans must be built without BYOK',
  )
  assertNotImported(
    'electron/plan-assistant.ts',
    "from './byok",
    'Local plan assistant must never import BYOK',
  )
  assertNotImported(
    'electron/plan-assistant-router.ts',
    'recommendFolders',
    'Plan Assistant router must never rank',
  )
  assertNotImported(
    'electron/plan-assistant-router.ts',
    'executeOrganisationPlan',
    'Plan Assistant router must never execute',
  )
  assertNotImported(
    'electron/recommendations.ts',
    'plan-assistant',
    'Recommendation Engine must never import the plan assistant',
  )
  assertNotImported(
    'electron/workflow-store.ts',
    "from './byok",
    'Workflows must never import BYOK',
  )
  assertNotImported(
    'electron/autopilot.ts',
    "from './byok",
    'Autopilot must never import BYOK',
  )
  assertNotImported('electron/byok.ts', 'recommendFolders', 'BYOK must never call recommendFolders')
  assertNotImported('electron/byok.ts', 'rankFolders', 'BYOK must never call rankFolders')
  assertNotImported(
    'electron/byok.ts',
    'executeOrganisationPlan',
    'BYOK must never execute organisation',
  )
  assertNotImported('electron/byok-client.ts', 'recommendFolders', 'BYOK client must never rank')
  assertNotImported(
    'electron/byok-client.ts',
    'executeOrganisationPlan',
    'BYOK client must never execute',
  )
  assertNotImported(
    'electron/byok-client.ts',
    "from './workflow-store",
    'BYOK must never create or run workflows',
  )
  assertNotImported(
    'electron/byok-conversation.ts',
    'writeFile',
    'AI conversation must never be written to disk',
  )
  assertNotImported(
    'electron/byok-conversation.ts',
    "from 'node:fs'",
    'AI conversation must stay in memory',
  )
  assertNotImported(
    'electron/activity-store.ts',
    "from './byok-conversation",
    'Activity must never store AI conversation',
  )
  assertNotImported(
    'electron/index-store.ts',
    "from './byok-conversation",
    'Knowledge Index must never store AI conversation',
  )
  assertNotImported(
    'electron/workflow-store.ts',
    "from './byok-conversation",
    'Workflows must never store AI conversation',
  )
  assertNotImported(
    'src/components/ByokAssistCard.tsx',
    "'Remember'",
    'BYOK must not use Remember — that promises teaching',
  )
  assertNotImported(
    'src/windows/SuggestionWindow.tsx',
    'teach SuHuella',
    'BYOK copy must not say teach SuHuella',
  )
  assertNotImported(
    'src/components/ActivityPanel.tsx',
    'teach SuHuella',
    'BYOK copy must not say teach SuHuella',
  )

  const settingsStore = source('electron/settings-store.ts')
  assert(
    settingsStore.includes("'byok_ai' in parsed.knowledgeSourcesEnabled"),
    'settings must keep stripping byok_ai from knowledge sources',
  )

  const descriptor = describeKnowledgeItem({
    origin: 'fixture',
    displayName: 'Invoice_ACME_2026.pdf',
  })
  const input = { descriptor, folders: [fixtureFolder()] }
  const first = recommendFolders(input)
  const second = recommendFolders(input)
  assert(first.length > 0, 'fixture invoice must still match')
  assert(
    JSON.stringify(first) === JSON.stringify(second),
    'matching must be deterministic without BYOK',
  )
  assert(
    !JSON.stringify(first).toLowerCase().includes('byok'),
    'recommendations must not mention BYOK',
  )

  const prefsRoot = mkdtempSync(path.join(tmpdir(), 'suhuella-byok-prefs-'))
  try {
    assert(listByokPreferences(prefsRoot).length === 0, 'preferences start empty')
    addByokPreference(prefsRoot, 'Invoices from ACME usually belong in Clients/ACME/Invoices.')
    assert(listByokPreferences(prefsRoot).length === 1, 'AI preference is stored locally')
  } finally {
    rmSync(prefsRoot, { recursive: true, force: true })
  }

  clearByokConversation()
  assert(listByokConversation().length === 0, 'AI conversation starts empty')
  appendByokConversation('Ignore screenshots.', 'OK.')
  appendByokConversation('Also rename invoices.', 'Done.')
  const conversation = listByokConversation()
  assert(conversation.length === 4, 'AI conversation keeps follow-up turns')
  assert(conversation[0]?.text === 'Ignore screenshots.', 'AI conversation remembers the first turn')
  assert(conversation[3]?.text === 'Done.', 'AI conversation remembers the later answer')
  clearByokConversation()
  assert(listByokConversation().length === 0, 'Clear conversation discards the assistant chat')
}
