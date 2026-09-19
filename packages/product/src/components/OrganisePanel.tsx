import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { useEffect, useState, type DragEvent } from 'react'
import { getSuhuellaApi } from '../lib/api'
import {
  analysingCopy,
  completedCounts,
  completedSummary,
  joinFolderFile,
  knowledgeItemsFromDroppedFiles,
  ORGANISE_EMPTY_LEAD,
  ORGANISE_EMPTY_PLAN_PROMISE,
  ORGANISE_SCREEN_TITLE,
} from '../lib/organise-copy'
import {
  ORGANISE_CHOOSE_FILES,
  ORGANISE_CHOOSE_FOLDER,
  ORGANISE_CONNECT_FOLDER,
  ORGANISE_DOCUMENTS_TITLE,
  ORGANISE_EMPTY_BODY,
  ORGANISE_EMPTY_NO_SOURCES,
  ORGANISE_EXECUTION_LIMIT,
  ORGANISE_SCREEN_SUBTITLE,
  ORGANISE_SELECT_FROM_SOURCES,
  organisePickErrorMessage,
} from '../lib/browser-organise-selection'
import { formatDocumentCount, SOURCES_PRIVACY_LINES } from '../lib/sources-ui'
import { DEFAULT_PLAN_ASSISTANT_USING } from '../lib/plan-assistant-copy'
import { isConfirmablePlanItem, parentPath, proposedName, sameFolder } from '../lib/plan-editor-copy'
import {
  asReviewPreview,
  groundedPlanAssistantReply,
  reanalyseWouldReplaceReview,
  selectionOriginLabel,
} from '../lib/plan-presentation'
import { FeaturePromoCard } from './FeaturePromoCard'
import { PlanAssistantAnswer, PlanAssistantBanner, PlanAssistantComposer } from './PlanAssistantPanel'
import { PlanEditor } from './PlanEditor'
import { WorkflowsList } from './WorkflowsList'
import type {
  AppHost,
  IndexedLocationSummary,
  KnowledgeSetItem,
  KnowledgeSetValidationError,
  OrganisationDestinationOption,
  OrganisationExecutionResult,
  OrganisationPlanItem,
  OrganisationPlanPreview,
  ByokConversationMessage,
  PlanAssistantUsing,
  PlanWorkflowIdea,
  SuggestionPayload,
  Workflow,
} from '../types'

function mergeKnowledgeItems(current: KnowledgeSetItem[], nextItems: KnowledgeSetItem[]): KnowledgeSetItem[] {
  const seen = new Set(current.map((item) => item.path.toLowerCase()))
  const merged = [...current]
  for (const item of nextItems) {
    const key = item.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

function itemLabel(item: KnowledgeSetItem): string {
  const parts = item.path.split(/[/\\]/)
  return parts[parts.length - 1] || item.path
}

type PendingConfirm =
  | { kind: 'bulk' }
  | { kind: 'item'; currentPath: string }

export function OrganisePanel({
  onCompleted,
  nextRunNumber = 1,
  initialWorkflowId = null,
  onInitialWorkflowConsumed,
  host = 'electron',
  canOrganise = true,
  folderAccess = true,
  locations = [],
  onConnectFolder,
  onViewActivity,
  onUndo,
}: {
  onCompleted?: (result: OrganisationExecutionResult) => void
  nextRunNumber?: number
  initialWorkflowId?: string | null
  onInitialWorkflowConsumed?: () => void
  host?: AppHost
  canOrganise?: boolean
  folderAccess?: boolean
  locations?: IndexedLocationSummary[]
  onConnectFolder?: () => void
  onViewActivity?: (runId: string) => void
  onUndo?: (request: { runId: string }) => Promise<{ ok: true } | { ok: false; message: string }>
}) {
  const { t } = useAppLocale()
  const isWeb = host === 'browser'
  const [items, setItems] = useState<KnowledgeSetItem[]>([])
  const [preview, setPreview] = useState<OrganisationPlanPreview | null>(null)
  const [execution, setExecution] = useState<OrganisationExecutionResult | null>(null)
  const [error, setError] = useState<KnowledgeSetValidationError | null>(null)
  const [busy, setBusy] = useState(false)
  const [changingPath, setChangingPath] = useState<string | null>(null)
  const [editingRenamePath, setEditingRenamePath] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [reanalysePending, setReanalysePending] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [workflowPickerOpen, setWorkflowPickerOpen] = useState(false)
  const [assistantNote, setAssistantNote] = useState('')
  const [assistantWorkflows, setAssistantWorkflows] = useState<PlanWorkflowIdea[]>([])
  const [assistantUsing, setAssistantUsing] = useState<PlanAssistantUsing>(DEFAULT_PLAN_ASSISTANT_USING)
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null)
  const [assistantConversation, setAssistantConversation] = useState<ByokConversationMessage[]>([])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [saveAsSuggestion, setSaveAsSuggestion] = useState<SuggestionPayload | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [undone, setUndone] = useState(false)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [activeSourcePath, setActiveSourcePath] = useState<string | null>(null)
  const [sourceFiles, setSourceFiles] = useState<Array<{ path: string; name: string }>>([])
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<string[]>([])

  const planItems = preview?.items ?? []
  const selectedCount = planItems.filter((item) => item.selected && isConfirmablePlanItem(item)).length
  const originLabel = selectionOriginLabel(items.length > 0 ? items : planItems)
  const drafting = busy && items.length > 0 && !preview && !execution
  const draftCopy = analysingCopy(items)
  const doneCounts = execution ? completedCounts(execution.items) : null
  const saveAsAvailable = Boolean(
    !isWeb && saveAsSuggestion?.fileName && saveAsSuggestion.currentFolder,
  )

  function resetPlanUi() {
    setPreview(null)
    setExecution(null)
    setError(null)
    setChangingPath(null)
    setPendingConfirm(null)
    setReanalysePending(false)
    setActionNotice(null)
    setAssistantWorkflows([])
    setAssistantAnswer(null)
    setUndone(false)
  }

  async function addItems(nextItems: KnowledgeSetItem[]) {
    if (nextItems.length === 0) return
    const merged = mergeKnowledgeItems(items, nextItems)
    setItems(merged)
    resetPlanUi()
    await analyseItems(merged)
  }

  async function pickFiles() {
    try {
      const picked = await getSuhuellaApi().pickKnowledgeSetFiles()
      if (picked.length === 0) return
      await addItems(picked)
    } catch (error) {
      const message = organisePickErrorMessage(error)
      if (message) setActionNotice(message)
    }
  }

  async function pickFolders() {
    try {
      const picked = await getSuhuellaApi().pickKnowledgeSetFolders()
      if (picked.length === 0) return
      await addItems(picked)
    } catch (error) {
      const message = organisePickErrorMessage(error)
      if (message) setActionNotice(message)
    }
  }

  async function openSourcePicker(location?: IndexedLocationSummary) {
    setActionNotice(null)
    const target = location ?? (locations.length === 1 ? locations[0] : null)
    if (!target) {
      setSourcePickerOpen(true)
      setActiveSourcePath(null)
      setSourceFiles([])
      setSelectedSourceFiles([])
      return
    }
    setSourcePickerOpen(true)
    setActiveSourcePath(target.path)
    setSelectedSourceFiles([])
    try {
      const browse = await getSuhuellaApi().getIndexBrowse()
      const files = browse.files.filter(
        (file) => file.path === target.path || file.path.startsWith(`${target.path}/`),
      )
      setSourceFiles(files.map((file) => ({ path: file.path, name: file.name })))
    } catch {
      setSourceFiles([])
    }
  }

  async function addSelectedSourceDocuments() {
    const picked = sourceFiles
      .filter((file) => selectedSourceFiles.includes(file.path))
      .map((file) => ({ path: file.path, kind: 'file' as const }))
    if (picked.length === 0) return
    setSourcePickerOpen(false)
    setActiveSourcePath(null)
    await addItems(picked)
  }

  async function applySaveAsContext() {
    if (!saveAsSuggestion?.fileName || !saveAsSuggestion.currentFolder) return
    await addItems([
      {
        path: joinFolderFile(saveAsSuggestion.currentFolder, saveAsSuggestion.fileName),
        kind: 'file',
      },
    ])
  }

  function clearKnowledgeSet() {
    setItems([])
    resetPlanUi()
    setActiveWorkflowId(null)
    setWorkflowPickerOpen(false)
  }

  async function refreshWorkflows() {
    try {
      setWorkflows(await getSuhuellaApi().listWorkflows())
    } catch {
      setWorkflows([])
    }
  }

  async function analyseItems(nextItems: KnowledgeSetItem[]) {
    if (nextItems.length === 0) return
    setBusy(true)
    setExecution(null)
    setError(null)
    setChangingPath(null)
    setPendingConfirm(null)
    setActionNotice(null)
    try {
      const result = await getSuhuellaApi().previewOrganisationPlan({ items: nextItems })
      if (result.ok) {
        setAssistantWorkflows([])
        setAssistantAnswer(null)
        setPreview(asReviewPreview(result.preview))
      } else {
        setPreview(null)
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function runWorkflow(workflow: Workflow) {
    setBusy(true)
    setWorkflowPickerOpen(false)
    try {
      const loaded = await getSuhuellaApi().loadWorkflowForRun(workflow.id)
      if (!loaded.ok) {
        setError(loaded.error)
        return
      }
      setActiveWorkflowId(loaded.workflow.id)
      setItems(loaded.knowledgeSet.items)
      resetPlanUi()
      await analyseItems(loaded.knowledgeSet.items)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refreshWorkflows()
    void getSuhuellaApi()
      .getPlanAssistantStatus()
      .then((status) => setAssistantUsing(status.using))
      .catch(() => setAssistantUsing(DEFAULT_PLAN_ASSISTANT_USING))
    void getSuhuellaApi()
      .getByokConversation()
      .then(setAssistantConversation)
      .catch(() => setAssistantConversation([]))
    void getSuhuellaApi()
      .getSuggestion()
      .then(setSaveAsSuggestion)
      .catch(() => setSaveAsSuggestion(null))
  }, [])

  useEffect(() => {
    if (!initialWorkflowId) return
    const workflow = workflows.find((item) => item.id === initialWorkflowId)
    if (!workflow) return
    onInitialWorkflowConsumed?.()
    void runWorkflow(workflow)
  }, [initialWorkflowId, workflows])

  async function proposeWithAssistant() {
    setBusy(true)
    setError(null)
    setChangingPath(null)
    setPendingConfirm(null)
    setActionNotice(null)
    setAssistantAnswer(null)
    try {
      const grounded = groundedPlanAssistantReply(assistantNote, planItems)
      if (grounded) {
        setAssistantAnswer(grounded)
        return
      }
      const result = await getSuhuellaApi().proposeOrganisationPlan({ items }, assistantNote, {
        workflowNames: workflows.map((workflow) => workflow.name),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.kind === 'answer') {
        setAssistantUsing(result.using)
        setAssistantAnswer(result.text)
      } else {
        setAssistantUsing(result.proposal.using)
        setPreview(asReviewPreview(result.proposal.preview))
        setAssistantWorkflows(result.proposal.workflows)
        setExecution(null)
      }
      const conversation = await getSuhuellaApi().getByokConversation().catch(() => [])
      setAssistantConversation(conversation)
    } finally {
      setBusy(false)
    }
  }

  async function clearAssistantConversation() {
    try {
      setAssistantConversation(await getSuhuellaApi().clearByokConversation())
    } catch {
      setAssistantConversation([])
    }
  }

  function updatePlanItem(currentPath: string, patch: Partial<OrganisationPlanItem>) {
    setPreview((current) => {
      if (!current) return current
      return {
        ...current,
        items: current.items.map((item) =>
          item.currentPath === currentPath ? { ...item, ...patch } : item,
        ),
      }
    })
  }

  function skipItem(item: OrganisationPlanItem) {
    updatePlanItem(item.currentPath, {
      action: 'none',
      selected: false,
      reviewGroup: 'skipped',
      skipReason: 'Skipped by you',
      createdFolders: undefined,
    })
    setChangingPath(null)
    setEditingRenamePath(null)
    setPendingConfirm(null)
  }

  function startRenameEdit(item: OrganisationPlanItem) {
    setChangingPath(null)
    setEditingRenamePath(item.currentPath)
    setRenameDraft(proposedName(item) ?? item.fileName)
  }

  function applyRenameEdit(item: OrganisationPlanItem) {
    const trimmed = renameDraft.trim()
    if (!trimmed) return

    const dir = parentPath(item.proposedPath || item.currentPath)
    const separator = item.currentPath.includes('\\') ? '\\' : '/'
    updatePlanItem(item.currentPath, {
      proposedPath: `${dir.replace(/[/\\]+$/, '')}${separator}${trimmed}`,
      selected: true,
      reviewGroup: 'ready',
      warnings: [],
    })
    setEditingRenamePath(null)
    setRenameDraft('')
  }

  function cancelRenameEdit() {
    setEditingRenamePath(null)
    setRenameDraft('')
  }

  function acceptItem(item: OrganisationPlanItem) {
    if (!isConfirmablePlanItem(item)) return
    updatePlanItem(item.currentPath, { selected: !item.selected })
    setPendingConfirm(null)
  }

  function requestReanalyse() {
    if (reanalyseWouldReplaceReview(planItems)) {
      setReanalysePending(true)
      return
    }
    void analyseItems(items)
  }

  function confirmReanalyse() {
    setReanalysePending(false)
    void analyseItems(items)
  }

  function reviewSuggestions() {
    document.getElementById('plan-first-suggested')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function chooseDestination(item: OrganisationPlanItem, option: OrganisationDestinationOption) {
    const currentDir = parentPath(item.currentPath)
    if (sameFolder(option.folder, currentDir)) {
      updatePlanItem(item.currentPath, {
        action: 'none',
        selected: false,
        proposedPath: null,
        reviewGroup: 'skipped',
        skipReason: 'Already in the recommended folder',
        explanation: `Already in ${option.label}.`,
        warnings: [],
      })
      setChangingPath(null)
      return
    }

    const fileName = item.fileName || item.currentPath.split(/[/\\]/).pop() || item.currentPath
    const separator = item.currentPath.includes('\\') ? '\\' : '/'
    const createdFolders = option.createdFolders ?? []
    const action =
      createdFolders.length > 1 ? 'create_structure' : createdFolders.length === 1 ? 'create_folder' : 'move'
    updatePlanItem(item.currentPath, {
      action,
      selected: true,
      proposedPath: `${option.folder.replace(/[/\\]+$/, '')}${separator}${fileName}`,
      explanation: option.reasons.join(' · ') || option.label,
      score: option.score,
      confidenceLabel: option.confidenceLabel,
      reviewGroup: 'ready',
      skipReason: null,
      warnings:
        createdFolders.length > 1
          ? ['Creates the destination folders, then moves the document.']
          : createdFolders.length === 1
            ? ['Creates the destination folder, then moves the document.']
            : [],
      createdFolders: createdFolders.length > 0 ? createdFolders : undefined,
    })
    setChangingPath(null)
  }

  function rememberMovedPaths(result: OrganisationExecutionResult) {
    setItems((current) =>
      current.map((item) => {
        const applied = result.items.find(
          (planItem) =>
            planItem.currentPath === item.path &&
            planItem.status === 'applied' &&
            planItem.proposedPath,
        )
        return applied?.proposedPath ? { ...item, path: applied.proposedPath } : item
      }),
    )
  }

  async function executePlanItems(planItemsToRun: OrganisationPlanItem[]) {
    if (!preview || planItemsToRun.length === 0) return

    setBusy(true)
    setError(null)
    try {
      const result = await getSuhuellaApi().executeOrganisationPlan({
        plan: {
          knowledgeSet: {
            items: planItemsToRun.map((item) => ({
              path: item.currentPath,
              kind: 'file' as const,
            })),
          },
          items: planItemsToRun,
        },
        confirmed: true,
        runNumber: nextRunNumber,
        trigger: activeWorkflowId ? 'workflow' : 'organise_documents',
        workflowId: activeWorkflowId ?? undefined,
      })
      if (result.ok) {
        onCompleted?.(result.result)
        if (activeWorkflowId) void refreshWorkflows()
        rememberMovedPaths(result.result)
        setChangingPath(null)
        setPendingConfirm(null)
        setExecution(result.result)
        setPreview(null)
        setActionNotice(null)
        setUndone(false)
      } else {
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  function selectedExecutableItems() {
    return planItems.filter((item) => item.selected && isConfirmablePlanItem(item))
  }

  function requestBulkConfirm() {
    if (selectedCount === 0) return
    if (!canOrganise) {
      setActionNotice(ORGANISE_EXECUTION_LIMIT)
      return
    }
    setPendingConfirm({ kind: 'bulk' })
  }

  async function confirmPending() {
    if (pendingConfirm?.kind === 'item') {
      const item = planItems.find((entry) => entry.currentPath === pendingConfirm.currentPath)
      if (!item) return
      await executePlanItems([{ ...item, selected: true }])
      return
    }
    await executePlanItems(selectedExecutableItems())
  }

  async function undoCompleted() {
    if (!execution || !onUndo) return
    setBusy(true)
    try {
      const result = await onUndo({ runId: execution.runId })
      if (result.ok) {
        setUndone(true)
        setActionNotice(null)
      } else {
        setActionNotice(result.message)
      }
    } finally {
      setBusy(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDropActive(false)
    const dropped = knowledgeItemsFromDroppedFiles(Array.from(event.dataTransfer.files), (file) =>
      getSuhuellaApi().droppedFilePath(file),
    )
    if (dropped.length === 0) {
      setActionNotice(
        isWeb
          ? 'Choose files, choose a folder, or select documents from a connected source.'
          : 'Those documents could not be added. Select documents or a folder instead.',
      )
      return
    }
    void addItems(dropped)
  }

  const selectFilesLabel = 'Select documents'
  const selectFolderLabel = 'Select folder'

  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-5"
      onDragEnter={(event) => {
        event.preventDefault()
        setDropActive(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDropActive(false)
      }}
      onDrop={handleDrop}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.organise}</h1>
          <p className="mt-2 text-[15px] text-[var(--app-fg)] opacity-60">
            {preview || execution
              ? productCopy('What should SuHuella do with these documents?')
              : ORGANISE_SCREEN_SUBTITLE}
          </p>
        </div>
        {preview && (
          <div className="flex items-center gap-1 rounded-lg border border-[var(--sidebar-line)] bg-[var(--overlay-row)] p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${viewMode === 'list' ? 'bg-[var(--app-bg)] text-[var(--app-fg)] shadow-sm' : 'text-[var(--app-fg)] opacity-60 hover:opacity-100'}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${viewMode === 'grid' ? 'bg-[var(--app-bg)] text-[var(--app-fg)] shadow-sm' : 'text-[var(--app-fg)] opacity-60 hover:opacity-100'}`}
            >
              Grid
            </button>
          </div>
        )}
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800">
          {error.message}
        </div>
      ) : null}

      {actionNotice && !execution ? (
        <div
          className={
            /could not|cannot|permission|failed|error|not granted|not available/i.test(actionNotice)
              ? 'rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-800'
              : 'rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900'
          }
        >
          {actionNotice}
        </div>
      ) : null}

      {drafting ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[17px] font-bold text-slate-900">{draftCopy.title}</p>
          <p className="mt-2 text-[15px] text-slate-600">{draftCopy.body}</p>
          <p className="mt-1 text-[15px] text-slate-500">{draftCopy.reassurance}</p>
        </div>
      ) : null}

      {!preview && !execution && !drafting ? (
        <div className="space-y-4">
          <FeaturePromoCard
            title={isWeb ? ORGANISE_DOCUMENTS_TITLE : ORGANISE_SCREEN_TITLE}
            description={
              isWeb
                ? locations.length === 0
                  ? ORGANISE_EMPTY_NO_SOURCES
                  : ORGANISE_EMPTY_BODY
                : ORGANISE_EMPTY_LEAD
            }
            hint={`${ORGANISE_EMPTY_PLAN_PROMISE} ${SOURCES_PRIVACY_LINES[0]}`}
            dropActive={dropActive}
            primary={
              isWeb
                ? locations.length > 0
                  ? {
                      label: ORGANISE_SELECT_FROM_SOURCES,
                      disabled: busy,
                      onClick: () => void openSourcePicker(),
                    }
                  : {
                      label: ORGANISE_CONNECT_FOLDER,
                      disabled: busy,
                      onClick: () => onConnectFolder?.(),
                    }
                : {
                    label: selectFilesLabel,
                    disabled: busy,
                    onClick: () => void pickFiles(),
                  }
            }
            secondary={{
              label: isWeb ? ORGANISE_CHOOSE_FILES : selectFolderLabel,
              disabled: busy,
              onClick: () => void (isWeb ? pickFiles() : pickFolders()),
            }}
            extra={
              isWeb
                ? {
                    label: ORGANISE_CHOOSE_FOLDER,
                    disabled: busy || !folderAccess,
                    onClick: () => void pickFolders(),
                  }
                : undefined
            }
          />

          {isWeb && locations.length > 0 ? (
            <ul className="space-y-2">
              {locations.map((location) => (
                <li key={location.path}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openSourcePicker(location)}
                    className="flex w-full items-center justify-between rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-3 text-left transition hover:bg-[var(--overlay-bg)] disabled:opacity-50"
                  >
                    <span className="truncate text-[15px] font-semibold text-[var(--app-fg)]">{location.name}</span>
                    <span className="text-[13px] text-[var(--app-fg)] opacity-55">
                      {formatDocumentCount(location.fileCount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isWeb && sourcePickerOpen ? (
            <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] p-4">
              {!activeSourcePath ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-[var(--app-fg)] opacity-60">Select a source</p>
                  {locations.map((location) => (
                    <button
                      key={location.path}
                      type="button"
                      onClick={() => void openSourcePicker(location)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[var(--overlay-bg)]"
                    >
                      <span className="font-semibold">{location.name}</span>
                      <span className="text-[13px] opacity-55">{formatDocumentCount(location.fileCount)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold text-[var(--app-fg)]">
                      {locations.find((location) => location.path === activeSourcePath)?.name ?? 'Source'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSourcePath(null)
                        if (locations.length <= 1) setSourcePickerOpen(false)
                      }}
                      className="text-[13px] font-semibold opacity-60 hover:opacity-100"
                    >
                      Back
                    </button>
                  </div>
                  {sourceFiles.length === 0 ? (
                    <p className="text-[14px] text-[var(--app-fg)] opacity-55">Nothing indexed in this source yet.</p>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-auto">
                      {sourceFiles.map((file) => {
                        const checked = selectedSourceFiles.includes(file.path)
                        return (
                          <li key={file.path}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--overlay-bg)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedSourceFiles((current) =>
                                    checked
                                      ? current.filter((path) => path !== file.path)
                                      : [...current, file.path],
                                  )
                                }}
                              />
                              <span className="truncate text-[14px]">{file.name}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={busy || selectedSourceFiles.length === 0}
                    onClick={() => void addSelectedSourceDocuments()}
                    className="rounded-full bg-[var(--app-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--app-bg)] disabled:opacity-40"
                  >
                    Add to Plan
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {saveAsAvailable || workflows.length > 0 || items.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-[13px] font-semibold text-[var(--app-fg)] opacity-60">
              {saveAsAvailable ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applySaveAsContext()}
                  className="hover:opacity-100 disabled:opacity-40"
                >
                  Use Save As context
                </button>
              ) : null}
              {workflows.length > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setWorkflowPickerOpen((open) => !open)}
                  className="hover:opacity-100 disabled:opacity-40"
                >
                  Use workflow
                </button>
              ) : null}
              {items.length > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearKnowledgeSet}
                  className="hover:text-rose-600 disabled:opacity-40"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {workflowPickerOpen ? (
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--app-fg)] opacity-60">A workflow always produces a Plan.</p>
              <WorkflowsList
                workflows={workflows}
                busy={busy}
                activeId={activeWorkflowId}
                onRun={(workflow) => void runWorkflow(workflow)}
              />
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {items.map((item) => (
                <div
                  key={item.path}
                  title={item.path}
                  className={`relative aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br shadow-md ${
                    item.kind === 'folder' ? 'from-[var(--brand-accent)] to-[var(--brand-accent-hover)]' : 'from-[var(--sidebar-line)] to-[var(--overlay-row)]'
                  }`}
                >
                  <span className="absolute bottom-3 left-3 right-3 truncate text-[12px] font-bold drop-shadow">
                    {itemLabel(item)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-4">
            {isWeb && !canOrganise ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {ORGANISE_EXECUTION_LIMIT}
              </div>
            ) : null}
            {preview.proposedBy === 'assistant' ? (
              <PlanAssistantBanner
                using={assistantUsing}
                workflows={assistantWorkflows}
                busy={busy}
                onReanalyse={requestReanalyse}
              />
            ) : null}
            {assistantAnswer && assistantUsing.backend !== 'byok' ? (
              <PlanAssistantAnswer using={assistantUsing} text={assistantAnswer} />
            ) : null}
            <PlanEditor
              items={planItems}
              originLabel={originLabel}
              viewMode={viewMode}
              busy={busy}
              changingPath={changingPath}
              editingRenamePath={editingRenamePath}
              renameDraft={renameDraft}
              pendingConfirm={pendingConfirm}
              reanalysePending={reanalysePending}
              onAddFiles={() => void pickFiles()}
              onAddFolder={() => void pickFolders()}
              onReanalyse={requestReanalyse}
              onConfirmReanalyse={confirmReanalyse}
              onCancelReanalyse={() => setReanalysePending(false)}
              onAccept={acceptItem}
              onKeepOriginal={skipItem}
              onChangeDestination={(item) => {
                setEditingRenamePath(null)
                setChangingPath(changingPath === item.currentPath ? null : item.currentPath)
              }}
              onEditRename={startRenameEdit}
              onRenameDraftChange={setRenameDraft}
              onApplyRenameEdit={applyRenameEdit}
              onCancelRenameEdit={cancelRenameEdit}
              onChoose={chooseDestination}
              onRequestConfirm={requestBulkConfirm}
              onConfirmPending={() => void confirmPending()}
              onCancelPending={() => setPendingConfirm(null)}
              onReviewSuggestions={reviewSuggestions}
            />
          </div>
          <div className="mt-4 lg:mt-0">
            {assistantOpen ? (
              <PlanAssistantComposer
                note={assistantNote}
                using={assistantUsing}
                busy={busy}
                disabled={items.length === 0}
                items={planItems}
                conversation={assistantConversation}
                onNoteChange={setAssistantNote}
                onPropose={() => void proposeWithAssistant()}
                onClearConversation={() => void clearAssistantConversation()}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ask about this Plan
              </button>
            )}
          </div>
        </div>
      ) : null}

      {execution ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6">
          <p className="text-[17px] font-bold text-emerald-950">
            {undone ? 'Plan undone' : 'Plan completed'}
          </p>
          {doneCounts && !undone ? (
            <p className="mt-2 whitespace-pre-line text-[15px] text-emerald-900">
              {completedSummary(doneCounts) || execution.message}
            </p>
          ) : null}
          <p className="mt-3 text-[13px] text-emerald-800">
            {undone ? 'Files were moved back. History stays in Activity.' : 'Undo available'}
          </p>
          {actionNotice ? <p className="mt-2 text-sm text-rose-700">{actionNotice}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            {onViewActivity ? (
              <button
                type="button"
                onClick={() => onViewActivity(execution.runId)}
                className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                View Activity
              </button>
            ) : null}
            {!undone && onUndo ? (
              <button
                type="button"
                onClick={() => void undoCompleted()}
                disabled={busy}
                className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-60"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearKnowledgeSet}
              className="rounded-full px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Organise more
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
