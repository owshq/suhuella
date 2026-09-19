import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runActivityChecks } from './activity.ts'
import { runAutopilotChecks } from './autopilot.ts'
import { runByokChecks } from './byok-check.ts'
import { runKnowledgeSetChecks } from './knowledge-set.ts'
import { runPlanAssistantChecks } from './plan-assistant.ts'
import { runDeviceMetricsChecks } from './device-metrics.ts'
import { runDocumentStorageChecks } from './document-storage.ts'
import { runSearchChecks } from './search.ts'
import { runStorageChecks } from './storage-manager.ts'
import { runUndoChecks } from './undo.ts'
import { runWorkflowChecks } from './workflow-store.ts'
import { runSaveAsOverlayChecks } from './save-as-overlay.ts'
import { runPlanPresentationChecks } from '../src/lib/plan-presentation.ts'
import './license-status-check.ts'

function readOrganiseSource(relativePath: string): string {
  const candidates = [join(process.cwd(), relativePath), join(process.cwd(), 'desktop', relativePath)]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
  }
  throw new Error(`missing source: ${relativePath}`)
}

function runOrganiseUxSourceChecks(): void {
  const copySource = readOrganiseSource('src/lib/plan-assistant-copy.ts')
  const organise = readOrganiseSource('src/components/OrganisePanel.tsx')
  const editor = readOrganiseSource('src/components/PlanEditor.tsx')
  const assistant = readOrganiseSource('src/components/PlanAssistantPanel.tsx')
  if (/Group invoices by year/.test(copySource)) {
    throw new Error('static invoice-year prompt must be removed')
  }
  if (/Save as workflow/.test(organise) || /Save as workflow/.test(editor)) {
    throw new Error('Save as workflow must be removed from Organise')
  }
  if (/saveWorkflow\(/.test(organise)) {
    throw new Error('Organise must not write new workflow instances')
  }
  if (/Select ready|Skip all review/.test(editor)) {
    throw new Error('engine-ready and skip-all-review actions must be removed')
  }
  if (/PLAN_ASSISTANT_PROMPTS/.test(assistant) || /Group invoices by year/.test(assistant)) {
    throw new Error('assistant chips must not use the static invoice prompt list')
  }
  if (!/Reanalyse/.test(editor) && !/Reanalyse/.test(organise)) {
    throw new Error('Reanalyse must be the explicit plan refresh action')
  }
  if (!/confirmed:\s*true/.test(organise) || !/previewOrganisationPlan/.test(organise)) {
    throw new Error('preview/confirm execution pipeline must stay in Organise')
  }
}

runKnowledgeSetChecks()
runPlanAssistantChecks()
runPlanPresentationChecks()
runOrganiseUxSourceChecks()
runActivityChecks()
runStorageChecks()
runDocumentStorageChecks()
runDeviceMetricsChecks()
runSearchChecks()
runUndoChecks()
runWorkflowChecks()
runAutopilotChecks()
runByokChecks()
runSaveAsOverlayChecks()
console.log('knowledge-set checks passed')
