/**
 * Browser Organise integrity.
 *
 * Recommendations and execution stay on one source. Cross-source browser
 * transfers are rejected before any write.
 *
 * Execution lock covers this page, and other tabs in the same browser profile
 * when the Web Locks API is available. It does not cover other browsers,
 * Desktop, or a second device.
 *
 * File System Access `move` is not atomic across processes. A failed `move`
 * is recorded as uncertain and is not retried with a copy.
 */

import type { IndexedFolderEntry, WebIndexedFile, WebPlanItem } from "./types.ts";

export const CROSS_SOURCE_REASON = "Moves between sources are not available in the browser.";
export const AMBIGUOUS_PATH_REASON = "This action does not identify one source and path.";
export const DUPLICATE_DESTINATION_REASON = "Another selected action uses the same destination.";
export const DUPLICATE_ORIGIN_REASON = "This file is selected more than once.";
export const RENAME_SCOPE_REASON = "Rename must stay in the same folder.";
export const DEST_EXISTS_REASON = "Skipped to avoid overwrite.";
export const DEST_MISSING_REASON = "Destination folder does not exist.";
export const DEST_PROBE_REASON = "Could not check whether the destination already exists.";
export const PERMISSION_REASON = "This folder needs write permission before files can change.";
export const NO_HANDLE_REASON = "This folder is no longer available.";
export const NO_WRITE_SUPPORT_REASON =
  "This browser can prepare a Plan. It cannot rename or move files from this selection.";
export const BUSY_REASON = "Another organisation is already running in this browser.";
export const INTENT_PERSIST_REASON = "Could not record this plan. No files were changed.";
export const PROGRESS_PERSIST_REASON = "Could not record progress. This file was not changed.";
export const INTENT_NOTE = "Recorded intent. Not applied.";
export const UNCERTAIN_NOTE =
  "In progress. Outcome uncertain until this record is updated. It will not run again automatically.";
export const COPY_INCOMPLETE_REASON =
  "Copy did not finish. The original file was left in place. A destination file was not deleted.";
export const COPY_UNVERIFIED_REASON =
  "Copy may have finished but its size could not be checked. The original was not removed.";
export const COPY_MISMATCH_REASON =
  "Copy size does not match the original. The original was not removed.";
export const PARTIAL_DELETE_REASON =
  "Copy finished and the original could not be removed. Both files exist.";
export const MOVE_UNCERTAIN_REASON =
  "The browser reported a move error. The file was not copied again because it may already have moved.";

const LOCK_NAME = "suhuella-organise-execution";

let executionHeld = false;

export function resetOrganiseExecutionLock(): void {
  executionHeld = false;
}

export async function withOrganiseExecution<T>(
  fn: () => Promise<T>,
): Promise<T | { blocked: true }> {
  if (executionHeld) return { blocked: true };
  executionHeld = true;
  try {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (locks?.request) {
      return await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return { blocked: true as const };
        return fn();
      });
    }
    return await fn();
  } finally {
    executionHeld = false;
  }
}

export function isSafeRelativePath(value: string): boolean {
  if (!value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function fileIdentityKey(sourceId: string, relativePath: string): string {
  return `${sourceId}\0${relativePath.toLowerCase()}`;
}

export function dedupeIndexedFiles(files: WebIndexedFile[]): WebIndexedFile[] {
  const seen = new Set<string>();
  const unique: WebIndexedFile[] = [];
  for (const file of files) {
    const key = fileIdentityKey(file.sourceId, file.relativePath);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(file);
  }
  return unique;
}

export function foldersForSource(folders: IndexedFolderEntry[], sourceId: string): IndexedFolderEntry[] {
  return folders.filter((folder) => folder.sourceId === sourceId);
}

export function splitKnowledgePath(path: string): { sourceId: string; relativePath: string } | null {
  const slash = path.indexOf("/");
  if (slash <= 0) return null;
  const sourceId = path.slice(0, slash);
  const relativePath = path.slice(slash + 1);
  if (!sourceId || sourceId.startsWith("cloud:") || sourceId.includes("/")) return null;
  if (!isSafeRelativePath(relativePath)) return null;
  return { sourceId, relativePath };
}

/**
 * Existing plans store `sourceId/relativePath` on both sides.
 * A proposed path whose source prefix differs from the origin is rejected.
 * A path that cannot be split is rejected. It is not treated as a local relative path.
 */
export function resolveStoredPlanPaths(
  currentPath: string,
  proposedPath: string | null,
):
  | { ok: true; sourceId: string; currentRelative: string; destSourceId: string; destRelative: string }
  | { ok: false; reason: string } {
  const current = splitKnowledgePath(currentPath);
  if (!current) return { ok: false, reason: AMBIGUOUS_PATH_REASON };
  if (!proposedPath) return { ok: false, reason: AMBIGUOUS_PATH_REASON };
  const proposed = splitKnowledgePath(proposedPath);
  if (!proposed) return { ok: false, reason: AMBIGUOUS_PATH_REASON };
  if (proposed.sourceId !== current.sourceId) return { ok: false, reason: CROSS_SOURCE_REASON };
  return {
    ok: true,
    sourceId: current.sourceId,
    currentRelative: current.relativePath,
    destSourceId: proposed.sourceId,
    destRelative: proposed.relativePath,
  };
}

function parentRelative(relativePath: string): string {
  const parts = relativePath.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/");
}

function allowsCreate(action: WebPlanItem["action"]): boolean {
  return action === "create_folder" || action === "create_structure";
}

export function preflightPlanItems(items: WebPlanItem[]): WebPlanItem[] {
  const prepared = items.map((item) => ({ ...item, warnings: [...item.warnings] }));
  const executable: number[] = [];

  prepared.forEach((item, index) => {
    if (!item.selected || !item.proposedPath) {
      prepared[index] = {
        ...item,
        status: "skipped",
        skipReason: item.skipReason ?? "Not selected",
      };
      return;
    }
    if (item.action !== "move" && item.action !== "rename" && !allowsCreate(item.action)) {
      prepared[index] = {
        ...item,
        status: "skipped",
        skipReason: "Only rename, move, and confirmed folder creation can run.",
      };
      return;
    }
    if (!item.sourceId || item.sourceId.includes("/") || item.sourceId.startsWith("cloud")) {
      prepared[index] = { ...item, status: "failed", skipReason: AMBIGUOUS_PATH_REASON };
      return;
    }
    const destSourceId = item.destSourceId || item.sourceId;
    if (destSourceId !== item.sourceId) {
      prepared[index] = { ...item, status: "failed", skipReason: CROSS_SOURCE_REASON };
      return;
    }
    if (!isSafeRelativePath(item.currentPath) || !isSafeRelativePath(item.proposedPath)) {
      prepared[index] = { ...item, status: "failed", skipReason: AMBIGUOUS_PATH_REASON };
      return;
    }
    const sameParent = parentRelative(item.currentPath) === parentRelative(item.proposedPath);
    if (item.action === "rename" && !sameParent) {
      prepared[index] = { ...item, status: "failed", skipReason: RENAME_SCOPE_REASON };
      return;
    }
    if (item.action === "move" && sameParent && item.currentPath.toLowerCase() !== item.proposedPath.toLowerCase()) {
      prepared[index] = { ...item, status: "failed", skipReason: "Move cannot rename a file. Confirm a rename instead." };
      return;
    }
    if (fileIdentityKey(item.sourceId, item.currentPath) === fileIdentityKey(destSourceId, item.proposedPath)) {
      prepared[index] = { ...item, status: "skipped", skipReason: "Already using that name and folder." };
      return;
    }
    executable.push(index);
  });

  const origins = new Map<string, number[]>();
  const destinations = new Map<string, number[]>();
  for (const index of executable) {
    const item = prepared[index];
    const origin = fileIdentityKey(item.sourceId, item.currentPath);
    const destination = fileIdentityKey(item.destSourceId || item.sourceId, item.proposedPath || "");
    origins.set(origin, [...(origins.get(origin) ?? []), index]);
    destinations.set(destination, [...(destinations.get(destination) ?? []), index]);
  }

  const rejected = new Set<number>();
  for (const indexes of origins.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) rejected.add(index);
    for (const index of indexes) {
      prepared[index] = { ...prepared[index], status: "failed", skipReason: DUPLICATE_ORIGIN_REASON };
    }
  }
  for (const indexes of destinations.values()) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      if (rejected.has(index)) continue;
      prepared[index] = { ...prepared[index], status: "failed", skipReason: DUPLICATE_DESTINATION_REASON };
    }
  }

  return prepared;
}

export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "NotFoundError" || name === "NotFound";
}

export type TransferEffect = {
  outcome: "applied" | "skipped" | "failed" | "partial" | "uncertain";
  reason: string | null;
  createdFolders: string[];
};

export async function runCopyFallback(steps: {
  readOrigin: () => Promise<{ size: number }>;
  writeDest: (size: number) => Promise<void>;
  readDestSize: () => Promise<number>;
  removeOrigin: () => Promise<void>;
}): Promise<TransferEffect> {
  let originSize = 0;
  try {
    originSize = (await steps.readOrigin()).size;
    await steps.writeDest(originSize);
  } catch {
    return { outcome: "failed", reason: COPY_INCOMPLETE_REASON, createdFolders: [] };
  }
  let destSize: number;
  try {
    destSize = await steps.readDestSize();
  } catch {
    return { outcome: "partial", reason: COPY_UNVERIFIED_REASON, createdFolders: [] };
  }
  if (destSize !== originSize) {
    return { outcome: "partial", reason: COPY_MISMATCH_REASON, createdFolders: [] };
  }
  try {
    await steps.removeOrigin();
  } catch {
    return { outcome: "partial", reason: PARTIAL_DELETE_REASON, createdFolders: [] };
  }
  return { outcome: "applied", reason: null, createdFolders: [] };
}

export type JournalSnapshot = {
  phase: "intent" | "progress" | "settled";
  items: WebPlanItem[];
};

export type GuardedPlanDeps = {
  canWrite: boolean;
  loadHandle: (sourceId: string) => Promise<unknown | null>;
  ensurePermission: (handle: unknown) => Promise<boolean>;
  transfer: (
    handle: unknown,
    fromRelative: string,
    toRelative: string,
    allowCreateFolders: boolean,
  ) => Promise<TransferEffect>;
  onJournal?: (snapshot: JournalSnapshot) => Promise<void>;
};

export type GuardedPlanResult =
  | {
      ok: true;
      items: WebPlanItem[];
      affectedSourceIds: string[];
    }
  | {
      ok: false;
      error: { code: "invalid_request"; message: string };
    };

function asEffect(item: WebPlanItem, effect: TransferEffect): WebPlanItem {
  if (effect.outcome === "applied") {
    return { ...item, status: "applied", skipReason: null, createdFolders: effect.createdFolders, warnings: item.warnings };
  }
  const status = effect.outcome === "skipped" ? "skipped" : "failed";
  return {
    ...item,
    status,
    skipReason: effect.reason,
    createdFolders: effect.createdFolders,
    warnings: effect.reason ? [...item.warnings, effect.reason] : item.warnings,
  };
}

function intentView(items: WebPlanItem[]): WebPlanItem[] {
  return items.map((item) => {
    if (item.status === "failed" || item.status === "skipped") return item;
    return { ...item, status: "skipped", skipReason: INTENT_NOTE };
  });
}

export async function executeGuardedPlan(items: WebPlanItem[], deps: GuardedPlanDeps): Promise<GuardedPlanResult> {
  const locked = await withOrganiseExecution(async () => {
    if (!deps.canWrite) {
      return { ok: false as const, error: { code: "invalid_request" as const, message: NO_WRITE_SUPPORT_REASON } };
    }
    const planned = preflightPlanItems(items);
    const pending = planned.map((item) =>
      item.status === "preview" ? { ...item, status: "skipped" as const, skipReason: INTENT_NOTE } : item,
    );
    try {
      await deps.onJournal?.({ phase: "intent", items: intentView(pending) });
    } catch {
      return { ok: false as const, error: { code: "invalid_request" as const, message: INTENT_PERSIST_REASON } };
    }

    const results = [...pending];
    const affected = new Set<string>();
    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];
      if (item.skipReason !== INTENT_NOTE || !item.proposedPath) continue;
      const handle = await deps.loadHandle(item.sourceId);
      if (!handle) {
        results[index] = { ...item, status: "failed", skipReason: NO_HANDLE_REASON };
        continue;
      }
      if (!(await deps.ensurePermission(handle))) {
        results[index] = { ...item, status: "failed", skipReason: PERMISSION_REASON };
        continue;
      }
      const uncertain: WebPlanItem = { ...item, status: "failed", skipReason: UNCERTAIN_NOTE };
      results[index] = uncertain;
      try {
        await deps.onJournal?.({ phase: "progress", items: [...results] });
      } catch {
        results[index] = { ...item, status: "failed", skipReason: PROGRESS_PERSIST_REASON };
        continue;
      }
      if (!(await deps.ensurePermission(handle))) {
        results[index] = { ...item, status: "failed", skipReason: PERMISSION_REASON };
        continue;
      }
      let effect: TransferEffect;
      try {
        effect = await deps.transfer(handle, item.currentPath, item.proposedPath, allowsCreate(item.action));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not apply this action.";
        effect = { outcome: "failed", reason: message, createdFolders: [] };
      }
      if (effect.outcome === "applied" || effect.outcome === "partial" || effect.outcome === "uncertain") {
        affected.add(item.sourceId);
      }
      results[index] = asEffect(item, effect);
      try {
        await deps.onJournal?.({ phase: "settled", items: [...results] });
      } catch {
        results[index] = { ...item, status: "failed", skipReason: UNCERTAIN_NOTE, warnings: [...item.warnings, UNCERTAIN_NOTE] };
        affected.add(item.sourceId);
      }
    }
    try {
      await deps.onJournal?.({ phase: "settled", items: results });
    } catch {
      /* The last per-item record remains. Do not run the batch again. */
    }
    return { ok: true as const, items: results, affectedSourceIds: [...affected] };
  });

  if (locked && typeof locked === "object" && "blocked" in locked) {
    return { ok: false, error: { code: "invalid_request", message: BUSY_REASON } };
  }
  return locked as GuardedPlanResult;
}
