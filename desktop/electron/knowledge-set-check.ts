import { readDesktopSource, readProductSource } from './check-source.ts'
import { runActivityChecks } from './activity.ts'
import { runAutopilotChecks } from './autopilot.ts'
import { runByokChecks } from './byok-check.ts'
import { knowledgeSetCheckLicenseContext, runKnowledgeSetChecks } from './knowledge-set.ts'
import { setLicenseContextForTests } from './license-rights.ts'
import { runPlanAssistantChecks } from './plan-assistant.ts'
import { runDeviceMetricsChecks } from './device-metrics.ts'
import { runDocumentStorageChecks } from './document-storage.ts'
import { runSearchChecks } from './search.ts'
import { runSearchTextChecks } from '@suhuella/product/lib/search-text.ts'
import { runStorageChecks } from './storage-manager.ts'
import { runUndoChecks } from './undo.ts'
import { runWorkflowChecks } from './workflow-store.ts'
import { runPlanLibraryChecks } from './plan-store.ts'
import { runSaveAsOverlayChecks } from './save-as-overlay.ts'
import { runOrganiseEmptyChecks, runOrganiseSuggestionChecks } from '@suhuella/product/lib/organise-copy.ts'
import { runPlanExecutionPacingChecks } from '@suhuella/product/lib/plan-execution-pacing-check.ts'
import { runPlanPresentationChecks } from '@suhuella/product/lib/plan-presentation.ts'
import { runActivityWhenChecks } from '@suhuella/product/lib/activity-when-check.ts'
import { runWorkflowCopyChecks } from '@suhuella/product/lib/workflow-copy.ts'
import { runPlanAssistantCopyChecks } from '@suhuella/product/lib/plan-assistant-copy.ts'
import { runIndexerChecks } from './indexer-check.ts'
import './license-status-check.ts'

function readOrganiseSource(relativePath: string): string {
  return readProductSource(relativePath)
}

function runOrganiseUxSourceChecks(): void {
  const copySource = readOrganiseSource('src/lib/plan-assistant-copy.ts')
  const organise = readOrganiseSource('src/components/OrganisePanel.tsx')
  const planLocalModelPicker = readOrganiseSource('src/components/PlanLocalModelPicker.tsx')
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
  if (
    !/planRecommendationConfidence/.test(editor) ||
    !/planConfidenceLines/.test(editor) ||
    !/sortPlanItemsForReview/.test(editor)
  ) {
    throw new Error('Plan review must surface recommendation confidence for the decision')
  }
  if (/Suggested Rename/.test(editor) || !/planSuggestionLine/.test(editor)) {
    throw new Error('Plan list must show the suggestion, not only a rename')
  }
  if (!/confirmed:\s*true/.test(organise) || !/previewOrganisationPlan/.test(organise)) {
    throw new Error('preview/confirm execution pipeline must stay in Organise')
  }
  if (!/reconnectPlanSource/.test(organise) || !/onReconnectSource/.test(organise)) {
    throw new Error('Plan Mode reconnects unavailable sources per item')
  }
  if (!/planSourceInlineAction/.test(editor)) {
    throw new Error('Plan review shows inline source reconnect actions')
  }
  if (!/PlanLocalModelPicker/.test(organise) || !/PLAN_MODEL_MANUAL_TOGGLE/.test(planLocalModelPicker)) {
    throw new Error('Plan Mode composes local model discovery inline')
  }
  if (!/resolvePlanComposerScope/.test(organise) || !/planCandidateInlineAction/.test(editor)) {
    throw new Error('Plan Mode wires candidate sources without sourceId')
  }
  if (!/organiseEmptyCopy/.test(organise)) {
    throw new Error('empty Organise must use host-aware next-step copy')
  }
  if (!/workflows.length > 0/.test(organise) || !/ORGANISE_SAVED_WORKFLOWS/.test(organise)) {
    throw new Error('saved workflows must appear on Organise only when they exist')
  }
  if (/workflowPickerOpen/.test(organise)) {
    throw new Error('saved workflows must be visible without a picker toggle')
  }
  if (!/recentWorkflows/.test(organise)) {
    throw new Error('saved workflows must be ordered by last use')
  }
  if (!/ORGANISE_USE_WORKFLOW/.test(organise) && !/ORGANISE_USE_WORKFLOW/.test(readOrganiseSource('src/components/WorkflowsList.tsx'))) {
    throw new Error('Use workflow must remain the public verb')
  }
  if (!/workflowUsingLabel/.test(organise) || !/workflowCompletedTitle/.test(organise)) {
    throw new Error('Organise must show the active workflow during review and completion')
  }
  const workflowsList = readOrganiseSource('src/components/WorkflowsList.tsx')
  if (!/workflowIntentSummary/.test(workflowsList) || !/workflowLastRunLabel/.test(workflowsList)) {
    throw new Error('workflow picker must show intent and last run')
  }
  const stale = /Save a plan|Apply accepted changes|Run workflow/
  if (stale.test(assistant) || stale.test(organise) || stale.test(editor)) {
    throw new Error('Plan Mode must not use Apply or Run workflow')
  }
  if (!/PLAN_LIBRARY_LABEL/.test(organise) || !/startFromPrompt/.test(organise) || !/deleteSavedPlan/.test(organise)) {
    throw new Error('Plan Mode keeps a local plan library and a prompt that does not execute')
  }
  if (!/plan\.items\.map/.test(organise) || /await addItems\(plan\.knowledgeSet\.items\)/.test(organise)) {
    throw new Error('saved Plan Run restores stored plan items without re-analysing')
  }
  if (!/executeOrganisationPlan/.test(organise) || /delete_file/.test(organise)) {
    throw new Error('saved-plan delete must not reach the executor')
  }
  if (!/Suggestions/.test(assistant) || !/PLAN_ASSISTANT_CONFIRM_HINT/.test(assistant)) {
    throw new Error('assistant ideas must be suggestions, and execution must say Confirm Plan')
  }
  if (/Use workflow/.test(assistant)) {
    throw new Error('Use workflow must stay on saved workflows, not assistant suggestions')
  }
}

async function main(): Promise<void> {
  setLicenseContextForTests(knowledgeSetCheckLicenseContext())
  try {
    runKnowledgeSetChecks()
    runPlanAssistantChecks()
    runPlanPresentationChecks()
    runPlanExecutionPacingChecks()
    runOrganiseEmptyChecks()
    runOrganiseSuggestionChecks()
    runWorkflowCopyChecks()
    runPlanAssistantCopyChecks()
    runOrganiseUxSourceChecks()
    runActivityWhenChecks()
    runActivityChecks()
    runStorageChecks()
    runDocumentStorageChecks()
    runDeviceMetricsChecks()
    runSearchTextChecks()
    runSearchChecks()
    runUndoChecks()
    setLicenseContextForTests(knowledgeSetCheckLicenseContext())
    runWorkflowChecks()
    runPlanLibraryChecks()
    const planStore = readDesktopSource('electron/plan-store.ts')
    const capabilities = readDesktopSource('electron/capabilities.ts')
    if (planStore.includes('executeOrganisationPlan') || planStore.includes("id: 'delete_file'") || planStore.includes('unlinkSync')) {
      throw new Error('plan library must not execute or delete files')
    }
    if (!/id: 'delete_file'[\s\S]*?safety: 'FORBIDDEN'/.test(capabilities)) {
      throw new Error('delete_file stays forbidden')
    }
    runAutopilotChecks()
    runByokChecks()
    runSaveAsOverlayChecks()
    await runIndexerChecks()
    console.log('knowledge-set checks passed')
  } finally {
    setLicenseContextForTests(null)
  }
}

void main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.stack ?? error.message)
  } else {
    console.error(error)
  }
  process.exit(1)
})
