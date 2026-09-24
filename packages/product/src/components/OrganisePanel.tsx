import { useAppLocale } from '../lib/app-locale'
import { Clock3, Mic, Monitor } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { getSuhuellaApi } from '../lib/api'
import {
  analysingCopy,
  completedCounts,
  completedSummary,
  joinFolderFile,
  knowledgeItemsFromDroppedFiles,
  organiseEmptyCopy,
  ORGANISE_TRUST_LINE,
  ORGANISE_OPEN_SOURCES,
  ORGANISE_SAVED_WORKFLOWS,
  ORGANISE_WORKFLOW_PROMISE,
  PLAN_PROMPT_ACTIONS,
} from '../lib/organise-copy'
import {
  recentWorkflows,
  workflowCompletedTitle,
  workflowIntentSummary,
  workflowUsingLabel,
} from '../lib/workflow-copy'
import {
  ORGANISE_EXECUTION_LIMIT,
  ORGANISE_SCREEN_SUBTITLE,
} from '../lib/browser-organise-selection'
import {
  browserCapabilityDialogCopy,
  presentOrganiseLimitation,
  type BrowserCapabilityDialogCopy,
} from '../lib/browser-capability-notice'
import { organisationPlanCapability } from '../lib/generation-capabilities'
import { generationLimitationCopy } from '../lib/generation-rights'
import { BrowserFolderConnectDialog } from './BrowserFolderConnectDialog'
import type { DesktopDownloadOffer } from '../lib/desktop-download-cta'
import {
  consumePendingOrganiseContext,
  pendingContextToKnowledgeItems,
} from '../lib/organise-sources-bridge'
import { hostAccessFor } from '../lib/platform-capabilities'
import { formatDocumentCount } from '../lib/sources-ui'
import { buildSourcePresentation, sourceOrganiseBlockedCopy } from '../lib/source-presentation'
import { DEFAULT_PLAN_ASSISTANT_USING } from '../lib/plan-assistant-copy'
import { detectedLocalModelKey, localModelConnectRequest } from '../lib/local-model-discovery'
import { useLocalModelDiscovery } from '../hooks/useLocalModelDiscovery'
import { PlanLocalModelPicker } from './PlanLocalModelPicker'
import {
  appendVoiceTranscript,
  createPlanSpeechRecognition,
  PLAN_DELETE_RECORD_LABEL,
  PLAN_VOICE_LABEL,
  PLAN_VOICE_STOP_LABEL,
  PLAN_VOICE_UNAVAILABLE,
  PLAN_SCREEN_KEPT,
  PLAN_SCREEN_LABEL,
  PLAN_SCREEN_STOP_LABEL,
  PLAN_SCREEN_UNAVAILABLE,
  PLAN_MODEL_DESKTOP_ONLY,
  type PlanAssistantPreference,
  transcriptFromSpeechEvent,
  PLAN_DUPLICATE_LABEL,
  PLAN_LIBRARY_LABEL,
  PLAN_PREPARE_LABEL,
  PLAN_PROMPT_PLACEHOLDER,
  PLAN_RUN_LABEL,
  PLAN_SCOPE_UNRESOLVED,
} from '../lib/plan-scope'
import { resolvePlanComposerScope, type PlanComposerScope } from '../lib/plan-composer-scope'
import {
  buildCandidatePlanPreview,
  isPlanSourceCandidateItem,
  mergeCandidatesIntoPreview,
  PLAN_SCOPE_SOURCE_DOC_PENDING,
} from '../lib/plan-source-candidate'
import { savedPlanTitleFromNote } from '../lib/saved-plan'
import { isConfirmablePlanItem, parentPath, proposedName, sameFolder } from '../lib/plan-editor-copy'
import {
  asReviewPreview,
  groundedPlanAssistantReply,
  planSummaryLead,
  reanalyseWouldReplaceReview,
  selectionOriginLabel,
} from '../lib/plan-presentation'
import { PlanAssistantAnswer, PlanAssistantBanner, PlanAssistantComposer } from './PlanAssistantPanel'
import { PlanEditor } from './PlanEditor'
import { PlanLiveLog } from './PlanLiveLog'
import {
  planLiveLogLine,
  type PlanExecutionMode,
  type PlanLiveLogLine,
} from '../lib/plan-execution-copy'
import { WorkflowGlyphBadge } from './WorkflowGlyph'
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
  ByokStatus,
  PlanAssistantUsing,
  PlanWorkflowIdea,
  SavedPlan,
  SuggestionPayload,
  Workflow,
} from '../types'

const HEADER_GLASS_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--overlay-bg)]/35 text-[var(--app-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-white/10 backdrop-blur-2xl transition hover:bg-[var(--overlay-bg)]/50 active:scale-[0.96]'

function HeaderGlassButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={HEADER_GLASS_BUTTON}>
      {children}
    </button>
  )
}

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

function executionRecoveryLines(items: OrganisationPlanItem[]): string[] {
  const lines: string[] = []
  for (const item of items) {
    if (item.status !== 'failed' && item.status !== 'skipped') continue
    if (item.skipReason) lines.push(item.skipReason)
    for (const warning of item.warnings ?? []) {
      if (warning && warning !== item.skipReason) lines.push(warning)
    }
  }
  return [...new Set(lines)]
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
  folderAccess: _folderAccess = true,
  locations = [],
  onConnectFolder,
  onOpenSources,
  onOpenActivity,
  onOpenSettings: _onOpenSettings,
  onViewActivity,
  onUndo,
  downloadOffer = null,
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
  onOpenSources?: () => void
  onOpenActivity?: () => void
  onOpenSettings?: () => void
  onViewActivity?: (runId: string) => void
  onUndo?: (request: { runId: string }) => Promise<{ ok: true } | { ok: false; message: string }>
  downloadOffer?: DesktopDownloadOffer | null
}) {
  const { locale, t } = useAppLocale()
  const access = hostAccessFor(host)
  const fromSources = access.organiseFromIndexedSources
  const emptyCopy = organiseEmptyCopy(access, { hasSources: locations.length > 0 })
  const [items, setItems] = useState<KnowledgeSetItem[]>([])
  const [preview, setPreview] = useState<OrganisationPlanPreview | null>(null)
  const [execution, setExecution] = useState<OrganisationExecutionResult | null>(null)
  const [error, setError] = useState<KnowledgeSetValidationError | null>(null)
  const [busy, setBusy] = useState(false)
  const [changingPath, setChangingPath] = useState<string | null>(null)
  const [editingRenamePath, setEditingRenamePath] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [executionMode, setExecutionMode] = useState<PlanExecutionMode>('background')
  const [liveLog, setLiveLog] = useState<PlanLiveLogLine[]>([])
  const [liveLogComplete, setLiveLogComplete] = useState(false)
  const [reanalysePending, setReanalysePending] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [capabilityNotice, setCapabilityNotice] = useState<BrowserCapabilityDialogCopy | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [recordingScreen, setRecordingScreen] = useState(false)
  const [byokStatus, setByokStatus] = useState<ByokStatus | null>(null)
  const [assistantPreference, setAssistantPreference] = useState<PlanAssistantPreference>('on_device')
  const [localConnectBusy, setLocalConnectBusy] = useState(false)
  const [planModelChoice, setPlanModelChoice] = useState<
    'builtin' | `local:${string}` | `local:connected:${string}`
  >('builtin')
  const [platform, setPlatform] = useState<'darwin' | 'win32' | 'linux'>('darwin')
  const {
    models: detectedLocalModels,
    probing: localModelsProbing,
    refresh: refreshLocalModels,
  } = useLocalModelDiscovery(true)
  const [scopeNotice, setScopeNotice] = useState<string | null>(null)
  const voiceRef = useRef<ReturnType<typeof createPlanSpeechRecognition>>(null)
  const voiceBaseRef = useRef('')
  const screenRecorderRef = useRef<MediaRecorder | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenChunksRef = useRef<Blob[]>([])
  const screenRecordingRef = useRef<Blob | null>(null)
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [assistantNote, setAssistantNote] = useState('')
  const [assistantWorkflows, setAssistantWorkflows] = useState<PlanWorkflowIdea[]>([])
  const [assistantUsing, setAssistantUsing] = useState<PlanAssistantUsing>(DEFAULT_PLAN_ASSISTANT_USING)
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null)
  const [assistantConversation, setAssistantConversation] = useState<ByokConversationMessage[]>([])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [saveAsSuggestion, setSaveAsSuggestion] = useState<SuggestionPayload | null>(null)
  const [_dropActive, setDropActive] = useState(false)
  const [undone, setUndone] = useState(false)
  const [organiseCapabilityAllowed, setOrganiseCapabilityAllowed] = useState(true)
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [activeSourcePath, setActiveSourcePath] = useState<string | null>(null)
  const [sourceFiles, setSourceFiles] = useState<Array<{ path: string; name: string }>>([])
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<string[]>([])
  const bridgeLoaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    void getSuhuellaApi()
      .getLicense()
      .then((license) => {
        if (cancelled) return
        setOrganiseCapabilityAllowed(
          license.effectiveCapabilities.includes(organisationPlanCapability()),
        )
      })
      .catch(() => {
        if (!cancelled) setOrganiseCapabilityAllowed(true)
      })
    return () => {
      cancelled = true
      voiceRef.current?.stop()
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stopVoice() {
    const session = voiceRef.current
    voiceRef.current = null
    try {
      session?.stop()
    } catch {
      // The session may already have ended.
    }
    setListening(false)
  }

  function toggleVoice() {
    if (listening) {
      stopVoice()
      return
    }
    const session = createPlanSpeechRecognition(locale === 'es' ? 'es-ES' : 'en-US')
    if (!session) {
      setScopeNotice(PLAN_VOICE_UNAVAILABLE)
      return
    }
    voiceBaseRef.current = promptDraft
    session.onresult = (event) => {
      const transcript = transcriptFromSpeechEvent(event)
      setPromptDraft(appendVoiceTranscript(voiceBaseRef.current, transcript))
    }
    session.onerror = () => {
      voiceRef.current = null
      setListening(false)
    }
    session.onend = () => {
      voiceRef.current = null
      setListening(false)
    }
    voiceRef.current = session
    try {
      session.start()
      setListening(true)
      setScopeNotice(null)
    } catch {
      voiceRef.current = null
      setListening(false)
      setScopeNotice(PLAN_VOICE_UNAVAILABLE)
    }
  }

  function stopScreenRecording() {
    const recorder = screenRecorderRef.current
    screenRecorderRef.current = null
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } catch {
      // The capture may already have ended.
    }
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setRecordingScreen(false)
  }

  async function toggleScreenRecording() {
    if (recordingScreen) {
      stopScreenRecording()
      setScopeNotice(PLAN_SCREEN_KEPT)
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setScopeNotice(PLAN_SCREEN_UNAVAILABLE)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const recorder = new MediaRecorder(stream)
      screenChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) screenChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        if (screenChunksRef.current.length > 0) {
          screenRecordingRef.current = new Blob(screenChunksRef.current, { type: recorder.mimeType || 'video/webm' })
        }
        screenChunksRef.current = []
        setScopeNotice(PLAN_SCREEN_KEPT)
      }
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenRecording()
        setScopeNotice(PLAN_SCREEN_KEPT)
      })
      recorder.start()
      screenRecorderRef.current = recorder
      screenStreamRef.current = stream
      setRecordingScreen(true)
      setScopeNotice(null)
    } catch {
      stopScreenRecording()
      setScopeNotice(PLAN_SCREEN_UNAVAILABLE)
    }
  }

  async function refreshByokStatus() {
    try {
      const status = await getSuhuellaApi().getByokStatus()
      setByokStatus(status)
      if (status.connected && status.assistant === 'local_server' && status.model) {
        setAssistantPreference('local')
        const match = detectedLocalModels.find((entry) => entry.model === status.model)
        setPlanModelChoice(
          match ? `local:${detectedLocalModelKey(match)}` : `local:ollama:${status.model}`,
        )
      }
    } catch {
      setByokStatus(null)
    }
  }

  async function selectPlanModel(value: string) {
    if (value === 'builtin') {
      setPlanModelChoice('builtin')
      setAssistantPreference('on_device')
      setScopeNotice(null)
      return
    }
    if (value.startsWith('local:connected:')) {
      setPlanModelChoice(value as `local:connected:${string}`)
      setAssistantPreference('local')
      setScopeNotice(null)
      return
    }
    const detected = detectedLocalModels.find((model) => `local:${detectedLocalModelKey(model)}` === value)
    if (!detected) {
      setScopeNotice(null)
      return
    }
    setLocalConnectBusy(true)
    setScopeNotice(null)
    try {
      const result = await getSuhuellaApi().connectByok(localModelConnectRequest(detected))
      if (!result.ok) {
        setScopeNotice(result.error === 'not_available' ? PLAN_MODEL_DESKTOP_ONLY : result.error)
        return
      }
      setByokStatus(result.status)
      setAssistantPreference('local')
      setPlanModelChoice(`local:${detectedLocalModelKey(detected)}`)
      void refreshLocalModels()
    } catch {
      setScopeNotice(PLAN_MODEL_DESKTOP_ONLY)
    } finally {
      setLocalConnectBusy(false)
    }
  }

  const planItems = preview?.items ?? []
  const selectedCount = planItems.filter((item) => item.selected && isConfirmablePlanItem(item)).length
  const originLabel = selectionOriginLabel(items.length > 0 ? items : planItems)
  const drafting = busy && items.length > 0 && !preview && !execution
  const draftCopy = analysingCopy(items)
  const doneCounts = execution ? completedCounts(execution.items) : null
  const saveAsAvailable = Boolean(
    access.saveAsOverlay && saveAsSuggestion?.fileName && saveAsSuggestion.currentFolder,
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

  async function openSourcePicker(location?: IndexedLocationSummary) {
    setActionNotice(null)
    if (location) {
      const presentation =
        location.presentation ??
        buildSourcePresentation({
          id: location.path,
          displayName: location.name,
          locationStatus: location.status,
          documentCount: location.fileCount,
          lastIndexedAt: location.lastIndexed,
          lastCheckedAt: location.lastCheckedAt,
          access,
        })
      if (!presentation.capabilities.organisable) {
        setActionNotice(sourceOrganiseBlockedCopy(presentation.summary.title))
        return
      }
    }
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

  async function useSourceScope(location: IndexedLocationSummary) {
    setActionNotice(null)
    const presentation =
      location.presentation ??
      buildSourcePresentation({
        id: location.path,
        displayName: location.name,
        locationStatus: location.status,
        documentCount: location.fileCount,
        lastIndexedAt: location.lastIndexed,
        lastCheckedAt: location.lastCheckedAt,
        access,
      })
    if (!presentation.capabilities.organisable) {
      setActionNotice(sourceOrganiseBlockedCopy(presentation.summary.title))
      return
    }
    setSourcePickerOpen(false)
    setActiveSourcePath(null)
    await addItems([{ path: location.path, kind: 'folder' }])
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
    setActiveWorkflow(null)
    setSavedPlanId(null)
  }

  async function refreshSavedPlans() {
    try {
      setSavedPlans(await getSuhuellaApi().listSavedPlans())
    } catch {
      setSavedPlans([])
    }
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

  async function resolveComposerScope(note: string): Promise<PlanComposerScope> {
    const suggested = await getSuhuellaApi().getSuggestedLocations().catch(() => [])
    return resolvePlanComposerScope(
      note,
      async (query) => {
        const results = await getSuhuellaApi().searchDocuments({ text: query, filter: 'all' })
        return results.hits
      },
      { suggested, indexed: locations, host, platform },
    )
  }

  async function continuePlanAfterScope(note: string, scope: PlanComposerScope): Promise<void> {
    if (scope.items.length === 0 && scope.candidates.length > 0) {
      setItems([])
      setPreview(
        asReviewPreview(
          buildCandidatePlanPreview(scope.candidates, {
            documentHintPending: scope.strictSourceDocumentPending,
          }),
        ),
      )
      setAssistantNote(note)
      if (scope.strictSourceDocumentPending) {
        setScopeNotice(PLAN_SCOPE_SOURCE_DOC_PENDING)
      }
      return
    }
    if (scope.items.length === 0) {
      setScopeNotice(PLAN_SCOPE_UNRESOLVED)
      return
    }

    setItems(scope.items)
    setAssistantNote(note)
    const previewResult = await getSuhuellaApi().previewOrganisationPlan({ items: scope.items })
    if (!previewResult.ok) {
      setPreview(null)
      setError(previewResult.error)
      return
    }
    let nextPreview = asReviewPreview(previewResult.preview)
    if (scope.candidates.length > 0) {
      nextPreview = asReviewPreview(mergeCandidatesIntoPreview(nextPreview, scope.candidates))
    }
    setPreview(nextPreview)

    const proposed = await getSuhuellaApi().proposeOrganisationPlan({ items: scope.items }, note, {
      workflowNames: workflows.map((workflow) => workflow.name),
      assistantPreference,
    })
    if (proposed.ok && proposed.kind === 'proposal') {
      setAssistantUsing(proposed.proposal.using)
      let proposalPreview = asReviewPreview(proposed.proposal.preview)
      if (scope.candidates.length > 0) {
        proposalPreview = asReviewPreview(mergeCandidatesIntoPreview(proposalPreview, scope.candidates))
      }
      setPreview(proposalPreview)
      setAssistantWorkflows(proposed.proposal.workflows)
    } else if (proposed.ok && proposed.kind === 'answer') {
      setAssistantUsing(proposed.using)
      setAssistantAnswer(proposed.text)
    } else if (!proposed.ok) {
      setError(proposed.error)
    }
  }

  async function grantPlanCandidateSource(item: OrganisationPlanItem) {
    const hint = item.candidateSourceGrantHint?.trim()
    const folderPath = item.candidateSourcePath?.trim()
    if (!hint && !folderPath) return

    setActionNotice(null)
    setBusy(true)
    try {
      const grantTarget = hint || folderPath
      if (grantTarget) {
        await getSuhuellaApi().addIndexedLocation(grantTarget)
      } else if (onConnectFolder) {
        onConnectFolder()
        return
      } else if (onOpenSources) {
        onOpenSources()
        return
      }

      setPreview(null)
      setItems([])
      const note = promptDraft.trim()
      if (!note) return
      await continuePlanAfterScope(note, await resolveComposerScope(note))
    } catch {
      setActionNotice('Could not connect that source. Open Sources to try again.')
    } finally {
      setBusy(false)
    }
  }

  async function reconnectPlanSource(item: OrganisationPlanItem) {
    if (isPlanSourceCandidateItem(item)) {
      await grantPlanCandidateSource(item)
      return
    }
    setActionNotice(null)
    setBusy(true)
    try {
      if (fromSources && item.sourceId && access.connectGrant) {
        await getSuhuellaApi().restoreSourceAccess(item.sourceId)
      } else if (onOpenSources) {
        onOpenSources()
        return
      } else if (onConnectFolder) {
        onConnectFolder()
        return
      }
      const scope = items.length > 0 ? items : preview?.knowledgeSet.items ?? []
      if (scope.length > 0) {
        await analyseItems(scope)
      }
    } catch {
      setActionNotice('Could not restore source access. Open Sources to try again.')
    } finally {
      setBusy(false)
    }
  }

  async function runWorkflow(workflow: Workflow) {
    setBusy(true)
    try {
      const loaded = await getSuhuellaApi().loadWorkflowForRun(workflow.id)
      if (!loaded.ok) {
        setError(loaded.error)
        return
      }
      setActiveWorkflow(loaded.workflow)
      setItems(loaded.knowledgeSet.items)
      resetPlanUi()
      await analyseItems(loaded.knowledgeSet.items)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (bridgeLoaded.current) return
    bridgeLoaded.current = true
    const pending = consumePendingOrganiseContext()
    if (!pending) return
    const nextItems = pendingContextToKnowledgeItems(pending)
    if (nextItems.length === 0) return
    void addItems(nextItems)
  }, [])

  useEffect(() => {
    void refreshWorkflows()
    void refreshSavedPlans()
    void getSuhuellaApi()
      .getPlanAssistantStatus()
      .then((status) => setAssistantUsing(status.using))
      .catch(() => setAssistantUsing(DEFAULT_PLAN_ASSISTANT_USING))
    void refreshByokStatus()
    void getSuhuellaApi()
      .getByokConversation()
      .then(setAssistantConversation)
      .catch(() => setAssistantConversation([]))
    void getSuhuellaApi()
      .getSuggestion()
      .then(setSaveAsSuggestion)
      .catch(() => setSaveAsSuggestion(null))
    void getSuhuellaApi()
      .getAppInfo()
      .then((info) => {
        if (info.platform === 'darwin' || info.platform === 'win32' || info.platform === 'linux') {
          setPlatform(info.platform)
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!initialWorkflowId) return
    const workflow = workflows.find((item) => item.id === initialWorkflowId)
    if (!workflow) return
    onInitialWorkflowConsumed?.()
    void runWorkflow(workflow)
  }, [initialWorkflowId, workflows])

  async function startFromPrompt() {
    const note = promptDraft.trim()
    if (!note) return
    stopVoice()
    stopScreenRecording()
    setBusy(true)
    setError(null)
    setScopeNotice(null)
    setActionNotice(null)
    setAssistantAnswer(null)
    try {
      if (items.length === 0) {
        await continuePlanAfterScope(note, await resolveComposerScope(note))
        return
      }
      const nextItems = items
      setAssistantNote(note)
      const previewResult = await getSuhuellaApi().previewOrganisationPlan({ items: nextItems })
      if (!previewResult.ok) {
        setPreview(null)
        setError(previewResult.error)
        return
      }
      setPreview(asReviewPreview(previewResult.preview))
      const proposed = await getSuhuellaApi().proposeOrganisationPlan({ items: nextItems }, note, {
        workflowNames: workflows.map((workflow) => workflow.name),
        assistantPreference,
      })
      if (proposed.ok && proposed.kind === 'proposal') {
        setAssistantUsing(proposed.proposal.using)
        setPreview(asReviewPreview(proposed.proposal.preview))
        setAssistantWorkflows(proposed.proposal.workflows)
      } else if (proposed.ok && proposed.kind === 'answer') {
        setAssistantUsing(proposed.using)
        setAssistantAnswer(proposed.text)
      } else if (!proposed.ok) {
        setError(proposed.error)
      }
    } finally {
      setBusy(false)
    }
  }

  function openSavedPlan(plan: SavedPlan) {
    setSavedPlanId(plan.id)
    setPromptDraft(plan.title)
    setExecution(null)
    setError(null)
    setPendingConfirm(null)
    setScopeNotice(null)
    setActionNotice(null)
    setAssistantNote(plan.title)
    setAssistantAnswer(null)
    setAssistantWorkflows([])
    setChangingPath(null)
    setItems(plan.knowledgeSet.items)
    setPreview(
      asReviewPreview({
        simulated: true,
        message: plan.title,
        knowledgeSet: plan.knowledgeSet,
        items: plan.items.map((item) => ({ ...item, status: 'preview' as const })),
        proposedBy: 'assistant',
      }),
    )
  }

  async function saveCurrentPlan() {
    if (!preview || preview.items.length === 0) return
    setBusy(true)
    try {
      const stored = savedPlans.find((plan) => plan.id === savedPlanId)
      const result = await getSuhuellaApi().saveSavedPlan({
        id: savedPlanId ?? undefined,
        title: stored?.title || savedPlanTitleFromNote(assistantNote || promptDraft || preview.message),
        knowledgeSet: preview.knowledgeSet,
        items: preview.items,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSavedPlanId(result.plan.id)
      setActionNotice('Plan saved on this device.')
      await refreshSavedPlans()
    } finally {
      setBusy(false)
    }
  }

  async function removeSavedPlan(planId: string) {
    const result = await getSuhuellaApi().deleteSavedPlan(planId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (savedPlanId === planId) setSavedPlanId(null)
    setSavedPlans(result.plans)
  }

  async function copySavedPlan(planId: string) {
    const result = await getSuhuellaApi().duplicateSavedPlan(planId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refreshSavedPlans()
    openSavedPlan(result.plan)
  }

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
    const watchRun = executionMode === 'watch'
    if (watchRun) {
      setLiveLog([])
      setLiveLogComplete(false)
    }
    const unsubscribe =
      watchRun && getSuhuellaApi().onPlanExecutionProgress
        ? getSuhuellaApi().onPlanExecutionProgress((event) => {
            setLiveLog((current) => {
              const line = planLiveLogLine(event.item, event.index)
              const existing = current.findIndex((entry) => entry.id === line.id)
              if (existing >= 0) {
                const next = [...current]
                next[existing] = line
                return next
              }
              return [...current, line]
            })
          })
        : null
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
        trigger: activeWorkflow ? 'workflow' : 'organise_documents',
        workflowId: activeWorkflow?.id,
        ...(watchRun ? { executionMode: 'watch' as const } : {}),
      })
      if (result.ok) {
        const presentation = presentOrganiseLimitation({
          host,
          locale,
          skipReasons: result.result.items.map((item) => item.skipReason),
        })
        const nothingApplied = result.result.appliedCount === 0
        if (presentation.kind === 'desktop_dialog' && nothingApplied) {
          setPendingConfirm(null)
          setCapabilityNotice(presentation.notice)
          return
        }
        if (presentation.kind === 'inline' && nothingApplied) {
          setPendingConfirm(null)
          setActionNotice(presentation.message)
          return
        }
        onCompleted?.(result.result)
        if (activeWorkflow) void refreshWorkflows()
        rememberMovedPaths(result.result)
        setChangingPath(null)
        setPendingConfirm(null)
        setExecution(result.result)
        setPreview(null)
        setActionNotice(null)
        setUndone(false)
        if (watchRun) {
          setLiveLog(result.result.items.map((item, index) => planLiveLogLine(item, index)))
        }
      } else if (result.error.code === 'generation_required') {
        const copy = generationLimitationCopy(locale, organisationPlanCapability())
        setPendingConfirm(null)
        setActionNotice(`${copy.title} ${copy.actionable}`)
      } else {
        const presentation = presentOrganiseLimitation({
          host,
          locale,
          canWrite: result.error.message === ORGANISE_EXECUTION_LIMIT ? false : undefined,
          errorMessage: result.error.message,
        })
        if (presentation.kind === 'desktop_dialog') {
          setPendingConfirm(null)
          setCapabilityNotice(presentation.notice)
          return
        }
        if (presentation.kind === 'inline') {
          setPendingConfirm(null)
          setActionNotice(presentation.message)
          return
        }
        setError(result.error)
      }
    } finally {
      if (watchRun) setLiveLogComplete(true)
      unsubscribe?.()
      setBusy(false)
    }
  }

  function selectedExecutableItems() {
    return planItems.filter((item) => item.selected && isConfirmablePlanItem(item))
  }

  function requestBulkConfirm() {
    if (selectedCount === 0) return
    if (!organiseCapabilityAllowed) {
      const copy = generationLimitationCopy(locale, organisationPlanCapability())
      setActionNotice(`${copy.title} ${copy.actionable}`)
      return
    }
    if (host === 'browser' && !canOrganise) {
      setCapabilityNotice(browserCapabilityDialogCopy('no_write_support', locale))
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
        fromSources
          ? 'Open Sources to choose scope.'
          : 'Those files could not be added. Open Sources instead.',
      )
      return
    }
    void addItems(dropped)
  }

  const savedPlanList =
    savedPlans.length === 0 ? null : (
      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-[var(--app-fg)] opacity-60">{PLAN_LIBRARY_LABEL}</p>
        <ul className="space-y-2">
          {savedPlans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-3"
            >
              <span className="min-w-0 truncate text-[14px] font-semibold text-[var(--app-fg)]">{plan.title}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openSavedPlan(plan)}
                  className="text-[13px] font-semibold text-[var(--app-fg)]"
                >
                  {PLAN_RUN_LABEL}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void copySavedPlan(plan.id)}
                  className="text-[13px] font-semibold text-[var(--app-fg)] opacity-70"
                >
                  {PLAN_DUPLICATE_LABEL}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeSavedPlan(plan.id)}
                  className="text-[13px] font-semibold text-rose-700"
                >
                  {PLAN_DELETE_RECORD_LABEL}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
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
            {ORGANISE_SCREEN_SUBTITLE}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenActivity ? (
            <HeaderGlassButton label={t.activity} onClick={onOpenActivity}>
              <Clock3 className="h-4 w-4 opacity-90" strokeWidth={2.25} />
            </HeaderGlassButton>
          ) : null}
          {preview ? (
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
          ) : null}
        </div>
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
          {activeWorkflow ? (
            <p className="text-[13px] font-semibold text-slate-500">{workflowUsingLabel(activeWorkflow.name)}</p>
          ) : null}
          <p className={`text-[17px] font-bold text-slate-900 ${activeWorkflow ? 'mt-1' : ''}`}>
            {draftCopy.title}
          </p>
          <p className="mt-2 text-[15px] text-slate-600">{draftCopy.body}</p>
          <p className="mt-1 text-[15px] text-slate-500">{draftCopy.reassurance}</p>
        </div>
      ) : null}

      {!preview && !execution && !drafting ? (
        <div className="space-y-4">
          <form
            className="space-y-3 rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void startFromPrompt()
            }}
          >
            <label className="block">
              <span className="sr-only">{PLAN_PREPARE_LABEL}</span>
              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                disabled={busy}
                rows={3}
                placeholder={PLAN_PROMPT_PLACEHOLDER}
                className="w-full resize-none rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)] outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLAN_PROMPT_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={busy}
                  aria-label={`${PLAN_PREPARE_LABEL}: ${action.label}`}
                  title={action.prompt}
                  onClick={() => setPromptDraft(action.prompt)}
                  className="rounded-full border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--app-fg)] opacity-70 transition hover:border-[var(--brand-accent)] hover:opacity-100 disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label={listening ? PLAN_VOICE_STOP_LABEL : PLAN_VOICE_LABEL}
                aria-pressed={listening}
                disabled={busy}
                onClick={toggleVoice}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sidebar-line)] text-[var(--app-fg)] disabled:opacity-50 ${listening ? 'bg-rose-600 text-white' : 'bg-[var(--app-bg)]'}`}
              >
                <Mic className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                aria-label={recordingScreen ? PLAN_SCREEN_STOP_LABEL : PLAN_SCREEN_LABEL}
                aria-pressed={recordingScreen}
                disabled={busy}
                onClick={() => void toggleScreenRecording()}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sidebar-line)] text-[var(--app-fg)] disabled:opacity-50 ${recordingScreen ? 'bg-rose-600 text-white' : 'bg-[var(--app-bg)]'}`}
              >
                <Monitor className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <PlanLocalModelPicker
                host={host}
                busy={busy}
                connectBusy={localConnectBusy}
                probing={localModelsProbing}
                models={detectedLocalModels}
                onRefresh={refreshLocalModels}
                byokStatus={byokStatus}
                selectValue={
                  assistantPreference === 'local' && byokStatus?.model
                    ? planModelChoice.startsWith('local:')
                      ? planModelChoice
                      : `local:connected:${byokStatus.model}`
                    : planModelChoice
                }
                onChange={selectPlanModel}
                onConnected={(status) => {
                  setByokStatus(status)
                  setAssistantPreference('local')
                  setPlanModelChoice(`local:connected:${status.model ?? 'local'}`)
                }}
                onNotice={setScopeNotice}
              />
              <button
                type="submit"
                disabled={busy || promptDraft.trim().length === 0}
                className="rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {PLAN_PREPARE_LABEL}
              </button>
            </div>
            {scopeNotice ? <p className="text-[13px] text-[var(--app-fg)] opacity-70">{scopeNotice}</p> : null}
          </form>
          {savedPlanList}
          {onOpenSources ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenSources()}
              className="px-1 text-[13px] font-semibold text-[var(--app-fg)] opacity-50 transition hover:opacity-80"
            >
              {ORGANISE_OPEN_SOURCES}
            </button>
          ) : null}
          {locations.length === 0 && emptyCopy.primaryKind === 'add_source' && onConnectFolder ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConnectFolder()}
              className="px-1 text-[13px] font-semibold text-[var(--app-fg)] opacity-50 transition hover:opacity-80"
            >
              {emptyCopy.primaryLabel}
            </button>
          ) : null}
          {locations.length === 0 && emptyCopy.primaryKind === 'select_from_sources' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void openSourcePicker()}
              className="px-1 text-[13px] font-semibold text-[var(--app-fg)] opacity-50 transition hover:opacity-80"
            >
              {emptyCopy.primaryLabel}
            </button>
          ) : null}

          {fromSources && locations.length > 0 ? (
            <ul className="space-y-2">
              {locations.map((location) => (
                <li key={location.path}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void useSourceScope(location)}
                    className="flex w-full items-center justify-between rounded-2xl border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-4 py-3 text-left transition hover:bg-[var(--overlay-bg)] disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-[var(--app-fg)]">
                        {location.name}
                      </span>
                      <span className="block text-[13px] text-[var(--app-fg)] opacity-55">
                        {formatDocumentCount(location.fileCount)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--app-fg)] opacity-70">
                      Plan
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {fromSources && locations.length > 0 && onOpenSources ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenSources()}
              className="px-1 text-[13px] font-semibold text-[var(--app-fg)] opacity-50 transition hover:opacity-80"
            >
              {ORGANISE_OPEN_SOURCES}
            </button>
          ) : null}

          {fromSources && sourcePickerOpen ? (
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
                    Use this source
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {saveAsAvailable || items.length > 0 ? (
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

          {workflows.length > 0 ? (
            <div className="space-y-2">
              <div>
                <p className="text-[13px] font-semibold text-[var(--app-fg)] opacity-60">{ORGANISE_SAVED_WORKFLOWS}</p>
                <p className="text-[13px] text-[var(--app-fg)] opacity-50">{ORGANISE_WORKFLOW_PROMISE}</p>
              </div>
              <WorkflowsList
                workflows={recentWorkflows(workflows, workflows.length)}
                busy={busy}
                activeId={activeWorkflow?.id}
                onRun={(workflow) => void runWorkflow(workflow)}
              />
            </div>
          ) : null}

          {items.length > 0 ? (
            <p className="px-1 text-[14px] font-medium text-[var(--app-fg)]">
              {planSummaryLead(items.filter((item) => item.kind === 'file').length || items.length, originLabel)}
              . {ORGANISE_TRUST_LINE}
            </p>
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
            {activeWorkflow ? (
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <WorkflowGlyphBadge name={activeWorkflow.name} category={activeWorkflow.category} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-slate-900">
                    {workflowUsingLabel(activeWorkflow.name)}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {workflowIntentSummary(activeWorkflow)}
                  </p>
                </div>
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
            {savedPlanList}
            {executionMode === 'watch' && (liveLog.length > 0 || liveLogComplete) ? (
              <PlanLiveLog lines={liveLog} complete={liveLogComplete} />
            ) : null}
            <PlanEditor
              items={planItems}
              onSave={() => void saveCurrentPlan()}
              originLabel={originLabel}
              viewMode={viewMode}
              busy={busy}
              changingPath={changingPath}
              editingRenamePath={editingRenamePath}
              renameDraft={renameDraft}
              pendingConfirm={pendingConfirm}
              reanalysePending={reanalysePending}
              onOpenSources={() => onOpenSources?.()}
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
              onReconnectSource={(item) => void reconnectPlanSource(item)}
              executionMode={executionMode}
              onExecutionModeChange={setExecutionMode}
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
        <div
          className={`rounded-2xl border p-6 ${
            execution.appliedCount === 0 && execution.failedCount > 0
              ? 'border-amber-200 bg-amber-50/90'
              : 'border-emerald-200 bg-emerald-50/90'
          }`}
        >
          <p className="text-[17px] font-bold text-emerald-950">
            {execution.appliedCount === 0 && execution.failedCount > 0
              ? execution.message
              : workflowCompletedTitle(activeWorkflow?.name, undone)}
          </p>
          {doneCounts && !undone && execution.appliedCount > 0 ? (
            <p className="mt-2 whitespace-pre-line text-[15px] text-emerald-900">
              {completedSummary(doneCounts) || execution.message}
            </p>
          ) : null}
          {executionRecoveryLines(execution.items).length > 0 ? (
            <ul className="mt-3 space-y-1 text-[14px] text-slate-800">
              {executionRecoveryLines(execution.items).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {undone || execution.appliedCount > 0 ? (
            <p className="mt-3 text-[13px] text-emerald-800">
              {undone ? 'Files were moved back. History stays in Activity.' : 'Undo available'}
            </p>
          ) : null}
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
            {!undone && onUndo && execution.appliedCount > 0 ? (
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
              New plan
            </button>
          </div>
        </div>
      ) : null}
      {host === 'browser' && capabilityNotice ? (
        <BrowserFolderConnectDialog
          downloadOffer={downloadOffer}
          notice={capabilityNotice}
          onPick={() => setCapabilityNotice(null)}
          onClose={() => setCapabilityNotice(null)}
        />
      ) : null}
    </section>
  )
}
