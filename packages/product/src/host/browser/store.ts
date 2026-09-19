import type { ActivityRun } from "../../types";
import {
  commitSourceBeforeScan,
  connectTrace,
  humanFolderName,
  mergeLiveSources,
  pendingBrowserSource,
} from "./connect-source";
import {
  directoryAvailable,
  ensurePermission,
  loadHandle,
  persistHandle,
  queryPermission,
  removeHandle,
  requestLocalFolder,
  scanDirectory,
  scanFileList,
  type WellKnownDirectory,
} from "./fs";
import {
  DEV_DEMO_DISPLAY_NAME,
  DEV_DEMO_HINT,
  DEV_DEMO_SOURCE_ID,
  demoFileDescriptors,
  demoFolderDescriptors,
  isBrowserDevHost,
} from "./dev-host";
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
  try {
    await persistHandle(sourceId, handle);
    grantedThisSession.add(sourceId);
    return "persistent";
  } catch {
    grantedThisSession.add(sourceId);
    return "limited";
  }
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

export async function probeSourceStatus(sourceId: string): Promise<WebSourceStatus> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (source?.access === "limited") return "ready";
  if (grantedThisSession.has(sourceId)) return "ready";

  const handle = await loadHandle(sourceId);
  if (!handle) return source ? "unavailable" : "unavailable";

  const read = await queryPermission(handle, "read");
  if (read === "granted") {
    grantedThisSession.add(sourceId);
    return (await directoryAvailable(handle)) ? "ready" : "unavailable";
  }
  return "needs_permission";
}

export async function reconcileSources(): Promise<WebKnowledgeSource[]> {
  const sources = await listSources();
  for (const source of sources) {
    if (removedSourceIds.has(source.id) || source.status === "indexing") continue;
    const status = await probeSourceStatus(source.id);
    const live = memorySources?.find((item) => item.id === source.id);
    if (!live || removedSourceIds.has(source.id) || live.status === "indexing") continue;
    if (status === live.status) continue;
    const updated = { ...live, status };
    rememberSource(updated);
    await idbSet(STORE.sources, source.id, updated);
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
    const scanned = await scanDirectory(handle, id);
    const displayName = humanFolderName(handle.name, humanFolderName(existing.name, "Folder"));
    const source: WebKnowledgeSource = {
      ...existing,
      ...scanned.source,
      id,
      name: displayName,
      status: "ready",
      access,
      wellKnownToken: existing.wellKnownToken,
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
    const kept: WebKnowledgeSource = {
      ...existing,
      status: "unavailable",
      lastIndexed: existing.lastIndexed,
    };
    rememberSource(kept);
    if (removedSourceIds.has(id)) return;
    await idbSet(STORE.sources, id, kept);
    connectTrace("scan_failed", {
      id,
      error: error instanceof Error ? error.message : "scan_failed",
    });
    notifySourcesChanged();
  }
}

export async function connectDemoSource(): Promise<WebKnowledgeSource> {
  if (!isBrowserDevHost()) {
    throw new Error("Demo sources are only available on localhost.");
  }
  const existing = (await listSources()).find(
    (source) => source.id === DEV_DEMO_SOURCE_ID || source.wellKnownToken === DEV_DEMO_HINT,
  );
  const id = existing?.id ?? DEV_DEMO_SOURCE_ID;
  reclaimSource(id);
  const files = demoFileDescriptors(id);
  const folders = demoFolderDescriptors(id);
  const source: WebKnowledgeSource = {
    id,
    kind: "local",
    type: "local_folder",
    name: DEV_DEMO_DISPLAY_NAME,
    fileCount: files.length,
    folderCount: folders.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    lastIndexed: new Date().toISOString(),
    status: "ready",
    access: "limited",
    wellKnownToken: DEV_DEMO_HINT,
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
    name: humanFolderName(handle.name, "Folder"),
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
  return committed;
}

export async function addSourceFromFiles(files: File[]): Promise<WebKnowledgeSource> {
  if (files.length === 0) {
    throw new DOMException("The user aborted a request.", "AbortError");
  }
  const id = createId("src");
  reclaimSource(id);
  const name =
    files[0]?.webkitRelativePath?.split(/[/\\]/).filter(Boolean)[0] || files[0]?.name || "Folder";
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
          const next: WebKnowledgeSource = {
            ...source,
            ...scanned.source,
            id: source.id,
            name: humanFolderName(scanned.source.name, source.name),
            status: "ready",
            access: "limited",
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
          const kept: WebKnowledgeSource = { ...pending, status: "unavailable" };
          rememberSource(kept);
          if (removedSourceIds.has(source.id)) return;
          await idbSet(STORE.sources, source.id, kept);
          connectTrace("scan_failed", {
            id: source.id,
            error: error instanceof Error ? error.message : "scan_failed",
          });
          notifySourcesChanged();
        });
    },
  });
  notifySourcesChanged();
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

export async function restoreSourceAccess(sourceId: string): Promise<WebKnowledgeSource | null> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (!source) return null;
  if (source.access === "limited") {
    const ready = { ...source, status: "ready" as const };
    await idbSet(STORE.sources, sourceId, ready);
    return ready;
  }
  const handle = await loadHandle(sourceId);
  if (!handle) {
    const missing = { ...source, status: "unavailable" as const };
    await idbSet(STORE.sources, sourceId, missing);
    return missing;
  }
  if (!(await ensurePermission(handle, "read"))) {
    const blocked = { ...source, status: "needs_permission" as const };
    await idbSet(STORE.sources, sourceId, blocked);
    return blocked;
  }
  grantedThisSession.add(sourceId);
  return refreshSource(sourceId);
}

export async function refreshSource(sourceId: string): Promise<WebKnowledgeSource | null> {
  const source = await idbGet<WebKnowledgeSource>(STORE.sources, sourceId);
  if (!source) return null;
  if (source.access === "limited") {
    const limited = { ...source, status: "ready" as const };
    await idbSet(STORE.sources, sourceId, limited);
    return limited;
  }
  const handle = await loadHandle(sourceId);
  if (!handle) {
    const missing = { ...source, status: "unavailable" as const };
    await idbSet(STORE.sources, sourceId, missing);
    return missing;
  }
  if (!(await ensurePermission(handle, "read"))) {
    const blocked = { ...source, status: "needs_permission" as const };
    await idbSet(STORE.sources, sourceId, blocked);
    return blocked;
  }
  if (!(await directoryAvailable(handle))) {
    const missing = { ...source, status: "unavailable" as const };
    await idbSet(STORE.sources, sourceId, missing);
    return missing;
  }
  grantedThisSession.add(sourceId);
  const scanning = { ...source, status: "indexing" as const };
  await idbSet(STORE.sources, sourceId, scanning);
  try {
    const scanned = await scanDirectory(handle, sourceId);
    const next: WebKnowledgeSource = {
      ...source,
      ...scanned.source,
      status: "ready",
      access: "persistent",
    };
    await idbSet(STORE.sources, sourceId, next);
    await replaceSourceKnowledge(sourceId, scanned.folders, scanned.files);
    return next;
  } catch {
    const failed = { ...source, status: "unavailable" as const };
    await idbSet(STORE.sources, sourceId, failed);
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
  grantedThisSession.delete(sourceId);
  forgetSource(sourceId);
  if (memoryFiles) memoryFiles = memoryFiles.filter((file) => !file.id.startsWith(`${sourceId}:`));
  if (memoryFolders) memoryFolders = memoryFolders.filter((folder) => !folder.id.startsWith(`${sourceId}:`));
  notifySourcesChanged();
  await idbDelete(STORE.sources, sourceId);
  await removeHandle(sourceId);
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
  await Promise.all([
    idbClear(STORE.sources),
    idbClear(STORE.folders),
    idbClear(STORE.files),
    idbClear(STORE.activity),
    idbClear(STORE.workflows),
    idbClear(STORE.handles),
  ]);
}

export async function appStorageBytes(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? null;
}
