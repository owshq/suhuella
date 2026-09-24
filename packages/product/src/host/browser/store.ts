import type { ActivityRun, SavedPlan, SavedPlanDraft } from "../../types";
import {
  buildSourceActivityRun,
  nextActivityRunNumber,
} from "../../lib/activity-general-events.ts";
import { duplicateSavedPlan, parseSavedPlan, planFromDraft } from "../../lib/saved-plan.ts";
import {
  resolveSourceDisplayName,
  sourceNameNeedsRecovery,
  usableSourceFolderName,
} from "../../lib/source-display-name.ts";
import {
  commitSourceBeforeScan,
  connectTrace,
  mergeLiveSources,
  pendingBrowserSource,
  UNKNOWN_SOURCE_NAME,
} from "./connect-source";
import type { SourcePermissionState } from "../../lib/source-handle.ts";
import { recordHealthObservation, type SourceAvailabilityReason } from "../../lib/source-health.ts";
import { sourceAccessState } from "../../lib/source-host-vocabulary.ts";
import { availabilityReasonForStatus } from "../handle-lifecycle-bridge.ts";
import { browserHandles } from "./handle-registry.ts";
import { requestLocalFolder, scanDirectory, scanFileList, type WellKnownDirectory } from "./fs";
import {
  DEV_DEMO_DISPLAY_NAME,
  DEV_DEMO_HINT,
  DEV_DEMO_SOURCE_ID,
  demoFileDescriptors,
  demoFolderDescriptors,
  isBrowserDevHost,
} from "./dev-host";
import {
  buildDemoFoldersFromVfs,
  devDemoVfsFiles,
  resetDevDemoVfs,
} from "./dev-demo-vfs";
import { idbClear, idbDelete, idbGet, idbGetAll, idbKeys, idbSet, STORE } from "./idb";
import type {
  IndexedFolderEntry,
  WebActivityRun,
  WebIndexedFile,
  WebKnowledgeSource,
  WebSourceStatus,
  WebWorkflow,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type SourceProbeOutcome = {
  status: WebSourceStatus;
  availabilityReason: SourceAvailabilityReason | null;
  permission: SourcePermissionState;
};

function applySourceHealth(
  source: WebKnowledgeSource,
  probe: SourceProbeOutcome,
  name = source.name,
  now = new Date().toISOString(),
): WebKnowledgeSource {
  const statusChanged = source.status !== probe.status;
  const accessState = sourceAccessState(probe.status);
  const health = recordHealthObservation(
    {
      lastIndexedAt: source.lastIndexed,
      lastCheckedAt: source.lastCheckedAt ?? null,
      lastStateChangeAt: source.lastStateChangeAt ?? null,
      availabilityReason: source.availabilityReason ?? null,
    },
    {
      at: now,
      statusChanged,
      availabilityReason:
        probe.availabilityReason ?? availabilityReasonForStatus(accessState, source.availabilityReason),
      stateChangeFallback: source.lastIndexed,
    },
  );
  return {
    ...source,
    status: probe.status,
    name,
    lastCheckedAt: health.lastCheckedAt,
    lastStateChangeAt: health.lastStateChangeAt,
    availabilityReason: health.availabilityReason,
    permission: probe.permission,
  };
}

async function appendGeneralActivityRun(run: ActivityRun): Promise<void> {
  await recordActivityRun(run);
}

async function recordSourceConnected(sourceName: string): Promise<void> {
  const runs = await listActivityRuns();
  await appendGeneralActivityRun(
    buildSourceActivityRun({
      kind: "connected",
      sourceName,
      toStatus: "ready",
      runNumber: nextActivityRunNumber(runs),
    }),
  );
}

async function recordSourceRemoved(sourceName: string): Promise<void> {
  const runs = await listActivityRuns();
  await appendGeneralActivityRun(
    buildSourceActivityRun({
      kind: "removed",
      sourceName,
      runNumber: nextActivityRunNumber(runs),
    }),
  );
}

async function recordSourceTransition(
  previousStatus: WebSourceStatus | undefined,
  nextStatus: WebSourceStatus,
  sourceName: string,
): Promise<void> {
  if (previousStatus === nextStatus) return;
  const runs = await listActivityRuns();
  await appendGeneralActivityRun(
    buildSourceActivityRun({
      kind: "transition",
      sourceName,
      fromStatus: previousStatus ?? null,
      toStatus: nextStatus,
      runNumber: nextActivityRunNumber(runs),
    }),
  );
}

const grantedThisSession = new Set<string>();
let memorySources: WebKnowledgeSource[] | null = null;
let memoryFiles: WebIndexedFile[] | null = null;
let memoryFolders: IndexedFolderEntry[] | null = null;
const sourceChangeListeners = new Set<(sources: WebKnowledgeSource[]) => void>();

const removedSourceIds = new Set<string>();

function reclaimSource(sourceId: string): void {
  removedSourceIds.delete(sourceId);
}

function rememberSource(source: WebKnowledgeSource): void {
  if (removedSourceIds.has(source.id)) return;
  const current = memorySources ?? [];
  memorySources = [...current.filter((item) => item.id !== source.id), source];
}

function forgetSource(sourceId: string): void {
  removedSourceIds.add(sourceId);
  if (!memorySources) {
    memorySources = [];
    return;
  }
  memorySources = memorySources.filter((item) => item.id !== sourceId);
}

function notifySourcesChanged(): void {
  const snapshot = memorySources ?? [];
  for (const listener of sourceChangeListeners) listener(snapshot);
}

export function onBrowserSourcesChanged(listener: (sources: WebKnowledgeSource[]) => void): () => void {
  sourceChangeListeners.add(listener);
  return () => {
    sourceChangeListeners.delete(listener);
  };
}

async function rememberGrantedHandle(sourceId: string, handle: FileSystemDirectoryHandle): Promise<"persistent" | "limited"> {
  const access = await browserHandles.bind(sourceId, handle);
  grantedThisSession.add(sourceId);
  return access;
}

export async function listSources(): Promise<WebKnowledgeSource[]> {
  const persisted = await idbGetAll<WebKnowledgeSource>(STORE.sources);
  memorySources = mergeLiveSources(persisted, memorySources, removedSourceIds);
  return memorySources;
}

export async function listFiles(): Promise<WebIndexedFile[]> {
  const persisted = await idbGetAll<WebIndexedFile>(STORE.files);
  const livePersisted = persisted.filter((file) => !removedSourceIds.has(file.sourceId));
  if (!memoryFiles) {
    memoryFiles = livePersisted;
    return memoryFiles;
  }
  const known = new Set(memoryFiles.map((file) => file.id));
  memoryFiles = [
    ...memoryFiles.filter((file) => !removedSourceIds.has(file.sourceId)),
    ...livePersisted.filter((file) => !known.has(file.id)),
  ];
  return memoryFiles;
}

export async function listFolders(): Promise<IndexedFolderEntry[]> {
  const persisted = await idbGetAll<IndexedFolderEntry>(STORE.folders);
  const livePersisted = persisted.filter((folder) => !removedSourceIds.has(folder.sourceId));
  if (!memoryFolders) {
    memoryFolders = livePersisted;
    return memoryFolders;
  }
  const known = new Set(memoryFolders.map((folder) => folder.id));
  memoryFolders = [
    ...memoryFolders.filter((folder) => !removedSourceIds.has(folder.sourceId)),
    ...livePersisted.filter((folder) => !known.has(folder.id)),
  ];
  return memoryFolders;
}

export async function listActivity(): Promise<WebActivityRun[]> {
  const runs = await idbGetAll<WebActivityRun>(STORE.activity);
  return runs.sort((left, right) => right.completedAt.localeCompare(left.completedAt)).slice(0, 500);
}

export async function listWorkflows(): Promise<WebWorkflow[]> {
  return idbGetAll<WebWorkflow>(STORE.workflows);
}

export async function listSavedPlans(): Promise<SavedPlan[]> {
  const plans = await idbGetAll<unknown>(STORE.plans);
  return plans.map(parseSavedPlan).filter((plan): plan is SavedPlan => plan !== null);
}

export async function saveSavedPlanRecord(draft: SavedPlanDraft): Promise<SavedPlan | null> {
  const existing = draft.id ? parseSavedPlan(await idbGet<unknown>(STORE.plans, draft.id)) : null;
  const next = planFromDraft(draft, new Date().toISOString(), existing);
  if ("code" in next) return null;
  await idbSet(STORE.plans, next.id, next);
  return next;
}

export async function deleteSavedPlanRecord(id: string): Promise<void> {
  await idbDelete(STORE.plans, id);
}

export async function duplicateSavedPlanRecord(id: string): Promise<SavedPlan | null> {
  const current = parseSavedPlan(await idbGet<unknown>(STORE.plans, id));
  if (!current) return null;
  const copy = duplicateSavedPlan(current, new Date().toISOString());
  await idbSet(STORE.plans, copy.id, copy);
  return copy;
}

async function probeSource(sourceId: string): Promise<SourceProbeOutcome> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (source?.access === "limited") {
    return { status: "ready", availabilityReason: null, permission: "granted" };
  }
  if (grantedThisSession.has(sourceId)) {
    return { status: "ready", availabilityReason: null, permission: "granted" };
  }

  const probe = await browserHandles.probe(sourceId);
  if (!probe) {
    return { status: "missing", availabilityReason: "folder_moved", permission: "unknown" };
  }
  if (probe.status === "ready") grantedThisSession.add(sourceId);
  return probe;
}

export async function probeSourceStatus(sourceId: string): Promise<WebSourceStatus> {
  return (await probeSource(sourceId)).status;
}

async function recoverStoredSourceName(sourceId: string): Promise<string | null> {
  const handle = await browserHandles.grant(sourceId);
  const fromHandle = usableSourceFolderName(handle?.name);
  if (fromHandle) return fromHandle;

  const folders = await listFolders();
  const root = folders.find(
    (folder) => folder.sourceId === sourceId && (folder.relativePath === "." || folder.relativePath === ""),
  );
  if (root) {
    const fromIndex = usableSourceFolderName(root.folderName || root.name);
    if (fromIndex) return fromIndex;
  }
  return null;
}

export async function reconcileSources(): Promise<WebKnowledgeSource[]> {
  const sources = await listSources();
  for (const source of sources) {
    if (removedSourceIds.has(source.id) || source.status === "indexing") continue;
    const probe = await probeSource(source.id);
    const live = memorySources?.find((item) => item.id === source.id);
    if (!live || removedSourceIds.has(source.id) || live.status === "indexing") continue;
    let nextName = live.name;
    if (sourceNameNeedsRecovery(live.name)) {
      const recovered = await recoverStoredSourceName(source.id);
      nextName = recovered ?? UNKNOWN_SOURCE_NAME;
    }
    const previousStatus = live.status;
    const updated = applySourceHealth(live, probe, nextName);
    rememberSource(updated);
    await idbSet(STORE.sources, source.id, updated);
    await recordSourceTransition(previousStatus, probe.status, updated.name);
  }
  return listSources();
}

async function finishSourceIndex(
  id: string,
  handle: FileSystemDirectoryHandle,
  access: "persistent" | "limited",
  _wellKnownToken?: string,
): Promise<void> {
  if (removedSourceIds.has(id)) return;
  const existing =
    memorySources?.find((source) => source.id === id) ?? (await idbGet<WebKnowledgeSource>(STORE.sources, id));
  if (!existing || removedSourceIds.has(id)) return;
  try {
    const opened = await browserHandles.open(id);
    if (opened && opened.status !== "ready") {
      throw new Error("source_handle_not_open");
    }
    // Future migration: scanDirectory() will become provider-independent
    // (SyncEngine → Handle.open() → Indexer). No functional change required now.
    const scanned = await scanDirectory(handle, id);
    const displayName = resolveSourceDisplayName(handle.name, existing.name);
    const now = new Date().toISOString();
    const source: WebKnowledgeSource = {
      ...existing,
      ...scanned.source,
      id,
      name: displayName,
      status: "ready",
      access,
      wellKnownToken: existing.wellKnownToken,
      lastIndexed: now,
      lastCheckedAt: now,
      availabilityReason: null,
      permission: "granted",
      lastStateChangeAt: existing.status === "ready" ? existing.lastStateChangeAt ?? now : now,
    };
    if (removedSourceIds.has(id)) return;
    rememberSource(source);
    if (removedSourceIds.has(id)) return;
    await idbSet(STORE.sources, id, source);
    if (removedSourceIds.has(id)) {
      await idbDelete(STORE.sources, id);
      return;
    }
    await replaceSourceKnowledge(id, scanned.folders, scanned.files);
    if (removedSourceIds.has(id)) return;
    connectTrace("scan_complete", { id, files: source.fileCount });
    notifySourcesChanged();
  } catch (error) {
    if (removedSourceIds.has(id)) return;
    const now = new Date().toISOString();
    const previousStatus = existing.status;
    const kept = applySourceHealth(existing, {
      status: "error",
      availabilityReason: "scan_failed",
      permission: existing.permission ?? "unknown",
    }, existing.name, now);
    rememberSource(kept);
    if (removedSourceIds.has(id)) return;
    await idbSet(STORE.sources, id, kept);
    await recordSourceTransition(previousStatus, kept.status, kept.name);
    connectTrace("scan_failed", {
      id,
      error: error instanceof Error ? error.message : "scan_failed",
    });
    notifySourcesChanged();
  }
}

export async function syncDevDemoSourceFromVfs(): Promise<WebKnowledgeSource | null> {
  if (!isBrowserDevHost()) return null;
  const existing = (await listSources()).find(
    (source) => source.id === DEV_DEMO_SOURCE_ID || source.wellKnownToken === DEV_DEMO_HINT,
  );
  if (!existing) return null;
  const id = existing.id;
  const files = devDemoVfsFiles().map((file) =>
    file.sourceId === id ? file : { ...file, id: `${id}:${file.relativePath}`, sourceId: id },
  );
  const folders = buildDemoFoldersFromVfs(files, id);
  const now = new Date().toISOString();
  const source: WebKnowledgeSource = {
    ...existing,
    fileCount: files.length,
    folderCount: folders.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    lastIndexed: now,
    lastCheckedAt: now,
    lastStateChangeAt: now,
    status: "ready",
    access: "limited",
    permission: "granted",
    availabilityReason: null,
  };
  rememberSource(source);
  await idbSet(STORE.sources, id, source);
  await replaceSourceKnowledge(id, folders, files);
  notifySourcesChanged();
  return source;
}

export async function connectDemoSource(): Promise<WebKnowledgeSource> {
  if (!isBrowserDevHost()) {
    throw new Error("Demo sources are only available on localhost.");
  }
  resetDevDemoVfs();
  const existing = (await listSources()).find(
    (source) => source.id === DEV_DEMO_SOURCE_ID || source.wellKnownToken === DEV_DEMO_HINT,
  );
  const id = existing?.id ?? DEV_DEMO_SOURCE_ID;
  reclaimSource(id);
  const files = demoFileDescriptors(id);
  const folders = demoFolderDescriptors(id);
  const now = new Date().toISOString();
  const source: WebKnowledgeSource = {
    id,
    kind: "local",
    type: "local_folder",
    name: DEV_DEMO_DISPLAY_NAME,
    fileCount: files.length,
    folderCount: folders.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    lastIndexed: now,
    lastCheckedAt: now,
    lastStateChangeAt: now,
    status: "ready",
    access: "limited",
    wellKnownToken: DEV_DEMO_HINT,
    availabilityReason: null,
    permission: "granted",
  };
  rememberSource(source);
  await idbSet(STORE.sources, id, source);
  await replaceSourceKnowledge(id, folders, files);
  connectTrace("scan_complete", { id, files: source.fileCount, kind: "dev-demo" });
  notifySourcesChanged();
  return source;
}

export async function addSourceFromHandle(
  handle: FileSystemDirectoryHandle,
  wellKnownToken?: string,
): Promise<WebKnowledgeSource> {
  const id = createId("src");
  reclaimSource(id);
  connectTrace("source_id_created", { id, name: handle.name, wellKnownToken });
  const access = await rememberGrantedHandle(id, handle);
  const pending = pendingBrowserSource({
    id,
    name: resolveSourceDisplayName(handle.name),
    access,
    wellKnownToken,
  });
  const committed = await commitSourceBeforeScan({
    source: pending,
    persist: async (source) => {
      await idbSet(STORE.sources, source.id, source);
    },
    remember: rememberSource,
    startScan: (source) => {
      void finishSourceIndex(source.id, handle, access, wellKnownToken);
    },
  });
  notifySourcesChanged();
  await recordSourceConnected(committed.name);
  return committed;
}

export async function addSourceFromFiles(files: File[]): Promise<WebKnowledgeSource> {
  if (files.length === 0) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  const id = createId("src");
  reclaimSource(id);
  const name = resolveSourceDisplayName(
    files[0]?.webkitRelativePath?.split(/[/\\]/).filter(Boolean)[0],
    files[0]?.name,
  );
  connectTrace("source_id_created", { id, name, kind: "files" });
  const pending = pendingBrowserSource({ id, name, access: "limited" });
  const committed = await commitSourceBeforeScan({
    source: pending,
    persist: async (source) => {
      await idbSet(STORE.sources, source.id, source);
    },
    remember: rememberSource,
    startScan: (source) => {
      void Promise.resolve()
        .then(() => {
          if (removedSourceIds.has(source.id)) return;
          const scanned = scanFileList(files, source.id);
          const now = new Date().toISOString();
          const next: WebKnowledgeSource = {
            ...source,
            ...scanned.source,
            id: source.id,
            name: resolveSourceDisplayName(scanned.source.name, source.name),
            status: "ready",
            access: "limited",
            lastIndexed: now,
            lastCheckedAt: now,
            availabilityReason: null,
            permission: "granted",
            lastStateChangeAt: now,
          };
          rememberSource(next);
          if (removedSourceIds.has(source.id)) return;
          return Promise.all([
            idbSet(STORE.sources, source.id, next),
            replaceSourceKnowledge(source.id, scanned.folders, scanned.files),
          ]).then(() => {
            if (removedSourceIds.has(source.id)) return;
            connectTrace("scan_complete", { id: source.id, files: next.fileCount });
            notifySourcesChanged();
          });
        })
        .catch(async (error) => {
          if (removedSourceIds.has(source.id)) return;
          const now = new Date().toISOString();
          const kept = applySourceHealth(pending, {
            status: "error",
            availabilityReason: "scan_failed",
            permission: "unknown",
          }, pending.name, now);
          rememberSource(kept);
          if (removedSourceIds.has(source.id)) return;
          await idbSet(STORE.sources, source.id, kept);
          await recordSourceTransition(pending.status, kept.status, kept.name);
          connectTrace("scan_failed", {
            id: source.id,
            error: error instanceof Error ? error.message : "scan_failed",
          });
          notifySourcesChanged();
        });
    },
  });
  notifySourcesChanged();
  await recordSourceConnected(committed.name);
  return committed;
}

export async function connectLocalFolder(
  startIn?: WellKnownDirectory,
  wellKnownToken?: string,
): Promise<WebKnowledgeSource> {
  connectTrace("picker_start", { startIn, wellKnownToken });
  const picked = await requestLocalFolder(startIn);
  connectTrace("handle_returned", { kind: picked.kind });
  if (picked.kind === "handle") return addSourceFromHandle(picked.handle, wellKnownToken);
  return addSourceFromFiles(picked.files);
}

async function replaceSourceKnowledge(
  sourceId: string,
  folders: IndexedFolderEntry[],
  files: WebIndexedFile[],
): Promise<void> {
  if (removedSourceIds.has(sourceId)) return;
  const keptFolders = (memoryFolders ?? []).filter((folder) => !folder.id.startsWith(`${sourceId}:`));
  const keptFiles = (memoryFiles ?? []).filter((file) => !file.id.startsWith(`${sourceId}:`));
  memoryFolders = [...keptFolders, ...folders];
  memoryFiles = [...keptFiles, ...files];
  connectTrace("scan_progress", {
    sourceId,
    filesWritten: files.length,
    foldersWritten: folders.length,
    indexStore: STORE.files,
  });
  const folderKeys = await idbKeys(STORE.folders);
  const fileKeys = await idbKeys(STORE.files);
  await Promise.all(
    folderKeys.filter((key) => key.startsWith(`${sourceId}:`)).map((key) => idbDelete(STORE.folders, key)),
  );
  await Promise.all(
    fileKeys.filter((key) => key.startsWith(`${sourceId}:`)).map((key) => idbDelete(STORE.files, key)),
  );
  if (removedSourceIds.has(sourceId)) return;
  await Promise.all(folders.map((folder) => idbSet(STORE.folders, folder.id, folder)));
  await Promise.all(files.map((file) => idbSet(STORE.files, file.id, file)));
}

/**
 * Restore or re-probe access for an existing Source.
 * Invariant: always mutates the Source keyed by sourceId — never mints a new id.
 * A new Handle may be bound later; identity, index keys and Activity history stay on sourceId.
 */
export async function restoreSourceAccess(sourceId: string): Promise<WebKnowledgeSource | null> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (!source) return null;
  if (source.access === "limited") {
    const previousStatus = source.status;
    const ready = applySourceHealth(source, {
      status: "ready",
      availabilityReason: null,
      permission: "granted",
    });
    rememberSource(ready);
    await idbSet(STORE.sources, sourceId, ready);
    await recordSourceTransition(previousStatus, ready.status, ready.name);
    notifySourcesChanged();
    return ready;
  }
  const access = await browserHandles.requestAccess(sourceId);
  if (!access) {
    const previousStatus = source.status;
    const missing = applySourceHealth(source, {
      status: "missing",
      availabilityReason: "folder_moved",
      permission: "unknown",
    });
    rememberSource(missing);
    await idbSet(STORE.sources, sourceId, missing);
    await recordSourceTransition(previousStatus, missing.status, missing.name);
    notifySourcesChanged();
    return missing;
  }
  if (access.status !== "ready") {
    const previousStatus = source.status;
    const blocked = applySourceHealth(source, access);
    rememberSource(blocked);
    await idbSet(STORE.sources, sourceId, blocked);
    await recordSourceTransition(previousStatus, blocked.status, blocked.name);
    notifySourcesChanged();
    return blocked;
  }
  grantedThisSession.add(sourceId);
  return refreshSource(sourceId);
}

export async function refreshSource(sourceId: string): Promise<WebKnowledgeSource | null> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (!source) return null;
  if (source.access === "limited") {
    if (source.id === DEV_DEMO_SOURCE_ID || source.wellKnownToken === DEV_DEMO_HINT) {
      return syncDevDemoSourceFromVfs();
    }
    const limited = applySourceHealth(source, {
      status: "ready",
      availabilityReason: null,
      permission: "granted",
    });
    rememberSource(limited);
    await idbSet(STORE.sources, sourceId, limited);
    return limited;
  }
  const access = await browserHandles.requestAccess(sourceId);
  if (!access || access.status !== "ready") {
    const previousStatus = source.status;
    const next = applySourceHealth(
      source,
      access ?? { status: "missing", availabilityReason: "folder_moved", permission: "unknown" },
    );
    rememberSource(next);
    await idbSet(STORE.sources, sourceId, next);
    await recordSourceTransition(previousStatus, next.status, next.name);
    notifySourcesChanged();
    return next;
  }
  const handle = await browserHandles.grant(sourceId);
  if (!handle) {
    const previousStatus = source.status;
    const missing = applySourceHealth(source, {
      status: "missing",
      availabilityReason: "folder_moved",
      permission: "unknown",
    });
    rememberSource(missing);
    await idbSet(STORE.sources, sourceId, missing);
    await recordSourceTransition(previousStatus, missing.status, missing.name);
    notifySourcesChanged();
    return missing;
  }
  grantedThisSession.add(sourceId);
  const previousStatus = source.status;
  const scanning = applySourceHealth(source, {
    status: "indexing",
    availabilityReason: null,
    permission: "granted",
  });
  rememberSource(scanning);
  await idbSet(STORE.sources, sourceId, scanning);
  notifySourcesChanged();
  try {
    const opened = await browserHandles.open(sourceId);
    if (opened && opened.status !== "ready") {
      throw new Error("source_handle_not_open");
    }
    // Future migration: scanDirectory() will become provider-independent
    // (SyncEngine → Handle.open() → Indexer). No functional change required now.
    const scanned = await scanDirectory(handle, sourceId);
    const now = new Date().toISOString();
    const next: WebKnowledgeSource = {
      ...source,
      ...scanned.source,
      name: resolveSourceDisplayName(handle.name, source.name),
      status: "ready",
      access: "persistent",
      lastIndexed: now,
      lastCheckedAt: now,
      availabilityReason: null,
      permission: "granted",
      lastStateChangeAt: source.status === "ready" ? source.lastStateChangeAt ?? now : now,
    };
    rememberSource(next);
    await idbSet(STORE.sources, sourceId, next);
    await replaceSourceKnowledge(sourceId, scanned.folders, scanned.files);
    await recordSourceTransition(previousStatus, next.status, next.name);
    notifySourcesChanged();
    return next;
  } catch {
    const failed = applySourceHealth(source, {
      status: "error",
      availabilityReason: "scan_failed",
      permission: source.permission ?? "granted",
    });
    rememberSource(failed);
    await idbSet(STORE.sources, sourceId, failed);
    await recordSourceTransition(previousStatus, failed.status, failed.name);
    notifySourcesChanged();
    return failed;
  }
}

/**
 * Invariant: a persisted browser source must never be deleted only because
 * permission is currently missing. Permission loss changes state. It does
 * not delete knowledge. Call this only for an explicit Remove or a full
 * local-knowledge clear.
 */
export async function removeSource(sourceId: string): Promise<void> {
  const existing =
    memorySources?.find((source) => source.id === sourceId) ??
    (await idbGet<WebKnowledgeSource>(STORE.sources, sourceId));
  if (existing) await recordSourceRemoved(existing.name);
  grantedThisSession.delete(sourceId);
  forgetSource(sourceId);
  if (memoryFiles) memoryFiles = memoryFiles.filter((file) => !file.id.startsWith(`${sourceId}:`));
  if (memoryFolders) memoryFolders = memoryFolders.filter((folder) => !folder.id.startsWith(`${sourceId}:`));
  notifySourcesChanged();
  await idbDelete(STORE.sources, sourceId);
  await browserHandles.unbind(sourceId);
  const folderKeys = await idbKeys(STORE.folders);
  const fileKeys = await idbKeys(STORE.files);
  await Promise.all(
    folderKeys.filter((key) => key.startsWith(`${sourceId}:`)).map((key) => idbDelete(STORE.folders, key)),
  );
  await Promise.all(
    fileKeys.filter((key) => key.startsWith(`${sourceId}:`)).map((key) => idbDelete(STORE.files, key)),
  );
}

export async function recordActivity(run: WebActivityRun): Promise<void> {
  await idbSet(STORE.activity, run.id, run);
}

export async function listActivityRuns(): Promise<ActivityRun[]> {
  const runs = await idbGetAll<ActivityRun | WebActivityRun>(STORE.activity);
  const seenRunIds = new Set<string>();
  return runs
    .map((run) => {
      if ("runId" in run && run.runId) return run;
      const legacy = run as WebActivityRun;
      return {
        runId: legacy.id,
        runNumber: 1,
        startedAt: legacy.completedAt,
        completedAt: legacy.completedAt,
        trigger: "organise_documents" as const,
        summary: {
          moved: legacy.items.filter((item) => item.status === "applied").length,
          skipped: legacy.items.filter((item) => item.status === "skipped").length,
          failed: legacy.items.filter((item) => item.status === "failed").length,
        },
        items: legacy.items.map((item) => ({
          sourcePath: item.currentPath,
          targetPath: item.proposedPath,
          fileName: item.fileName,
          action: item.action === "none" ? "ignore" : item.action,
          status:
            item.status === "applied" ? ("moved" as const) : item.status === "failed" ? ("failed" as const) : ("skipped" as const),
          reason: item.skipReason || item.explanation,
          confidence: item.score,
          undoAvailable: item.status === "applied" && (item.action === "move" || item.action === "rename"),
        })),
      } satisfies ActivityRun;
    })
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .filter((run) => {
      if (seenRunIds.has(run.runId)) return false
      seenRunIds.add(run.runId)
      return true
    })
    .slice(0, 500);
}

export async function recordActivityRun(run: ActivityRun): Promise<void> {
  await idbSet(STORE.activity, run.runId, run);
}

export async function clearActivityRuns(): Promise<void> {
  await idbClear(STORE.activity);
}

export async function saveWorkflow(name: string, fileIds: string[]): Promise<WebWorkflow> {
  const workflow: WebWorkflow = {
    id: createId("wf"),
    name: name.trim() || "Untitled plan",
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    fileIds,
  };
  await idbSet(STORE.workflows, workflow.id, workflow);
  return workflow;
}

export async function markWorkflowRan(id: string): Promise<void> {
  const workflow = await idbGet<WebWorkflow>(STORE.workflows, id);
  if (!workflow) return;
  await idbSet(STORE.workflows, id, { ...workflow, lastRunAt: new Date().toISOString() });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await idbDelete(STORE.workflows, id);
}

export async function clearLocalKnowledge(): Promise<void> {
  memorySources = [];
  memoryFiles = [];
  memoryFolders = [];
  notifySourcesChanged();
  await browserHandles.dispose();
  await Promise.all([
    idbClear(STORE.sources),
    idbClear(STORE.folders),
    idbClear(STORE.files),
    idbClear(STORE.activity),
    idbClear(STORE.workflows),
    idbClear(STORE.plans),
    idbClear(STORE.handles),
  ]);
}

export async function appStorageBytes(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? null;
}
