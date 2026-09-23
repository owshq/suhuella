/**
 * ORGANISE-INTEGRITY-001
 *
 * Simulated executor and copy-fallback checks. These do not drive a real browser
 * File System Access picker. Desktop knowledge-set checks remain separate.
 */
import {
  AMBIGUOUS_PATH_REASON,
  BUSY_REASON,
  COPY_INCOMPLETE_REASON,
  CROSS_SOURCE_REASON,
  DEST_EXISTS_REASON,
  DEST_PROBE_REASON,
  DUPLICATE_DESTINATION_REASON,
  DUPLICATE_ORIGIN_REASON,
  INTENT_NOTE,
  INTENT_PERSIST_REASON,
  NO_WRITE_SUPPORT_REASON,
  PARTIAL_DELETE_REASON,
  PERMISSION_REASON,
  UNCERTAIN_NOTE,
  executeGuardedPlan,
  isNotFoundError,
  preflightPlanItems,
  resetOrganiseExecutionLock,
  resolveStoredPlanPaths,
  runCopyFallback,
} from "@suhuella/product/host/browser/organise-integrity.ts";
import { previewPlan } from "@suhuella/product/host/browser/plan.ts";
import type { IndexedFolderEntry, WebIndexedFile, WebPlanItem } from "@suhuella/product/host/browser/types.ts";
import type { TransferEffect } from "@suhuella/product/host/browser/organise-integrity.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function folder(partial: Pick<IndexedFolderEntry, "sourceId" | "relativePath" | "folderName" | "fileNames">): IndexedFolderEntry {
  return {
    id: `${partial.sourceId}:${partial.relativePath}`,
    sourceId: partial.sourceId,
    sourceType: "local_folder",
    kind: "folder",
    name: partial.folderName,
    locator: partial.relativePath,
    absolutePath: partial.relativePath,
    relativePath: partial.relativePath,
    folderName: partial.folderName,
    parentTokens: [],
    depth: 1,
    extensions: ["pdf"],
    fileCount: partial.fileNames.length,
    fileNames: partial.fileNames,
    lastModified: null,
  };
}

function file(sourceId: string, relativePath: string): WebIndexedFile {
  const name = relativePath.split("/").at(-1) ?? relativePath;
  return {
    id: `${sourceId}:${relativePath}`,
    sourceId,
    name,
    relativePath,
    parentRelative: relativePath.split("/").slice(0, -1).join("/"),
    size: 4,
    lastModified: null,
  };
}

function planItem(partial: Partial<WebPlanItem> & Pick<WebPlanItem, "currentPath" | "proposedPath" | "sourceId">): WebPlanItem {
  return {
    action: "move",
    fileName: partial.currentPath.split("/").at(-1) ?? "file.pdf",
    explanation: "test",
    renameReasons: [],
    warnings: [],
    reviewGroup: "ready",
    selected: true,
    score: 80,
    confidenceLabel: "Good match",
    skipReason: null,
    status: "preview",
    destSourceId: partial.sourceId,
    ...partial,
  };
}

const applied: TransferEffect = { outcome: "applied", reason: null, createdFolders: [] };

function deps(overrides: Partial<Parameters<typeof executeGuardedPlan>[1]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    options: {
      canWrite: true,
      loadHandle: async (sourceId: string) => ({ sourceId }),
      ensurePermission: async () => true,
      transfer: async (handle: unknown, from: string, to: string) => {
        calls.push(`${(handle as { sourceId: string }).sourceId}:${from}->${to}`);
        return applied;
      },
      onJournal: async () => {},
      ...overrides,
    },
  };
}

async function runIntegrityChecks(): Promise<void> {
  const sourceA = "sourceA";
  const sourceB = "sourceB";
  const shared = [
    folder({ sourceId: sourceA, relativePath: "Downloads", folderName: "Downloads", fileNames: ["factura-acme.pdf"] }),
    folder({ sourceId: sourceA, relativePath: "Invoices", folderName: "Invoices", fileNames: ["factura-old.pdf"] }),
    folder({ sourceId: sourceB, relativePath: "Invoices", folderName: "Invoices", fileNames: ["factura-acme.pdf", "factura-beta.pdf", "factura-old.pdf"] }),
  ];
  const preview = previewPlan([file(sourceA, "Downloads/factura-acme.pdf")], shared);
  assert(preview.length === 1, "one file previews once");
  assert(preview[0]?.destSourceId === sourceA, "recommendation stays on the file source");
  assert(preview[0]?.proposedPath?.startsWith("sourceB/") !== true, "preview does not encode the other source");
  assert(!preview.some((item) => item.destSourceId === sourceB), "other source folder is excluded");

  const onlyOther = previewPlan(
    [file(sourceA, "Downloads/factura-acme.pdf")],
    [folder({ sourceId: sourceB, relativePath: "Invoices", folderName: "Invoices", fileNames: ["factura-acme.pdf"] })],
  );
  assert(onlyOther[0]?.destSourceId === sourceA, "a foreign folder cannot become the destination source");
  assert(onlyOther[0]?.action === "none", "no same-source destination means no move");

  const legacy = resolveStoredPlanPaths("sourceA/Downloads/factura-acme.pdf", "sourceA/Invoices/factura-acme.pdf");
  assert(legacy.ok && legacy.destSourceId === sourceA, "older same-source plans still resolve");
  const foreign = resolveStoredPlanPaths("sourceA/Downloads/factura-acme.pdf", "sourceB/Invoices/factura-acme.pdf");
  assert(!foreign.ok && foreign.reason === CROSS_SOURCE_REASON, "stored cross-source paths are rejected");
  const ambiguous = resolveStoredPlanPaths("factura-acme.pdf", "Invoices/factura-acme.pdf");
  assert(!ambiguous.ok && ambiguous.reason === AMBIGUOUS_PATH_REASON, "paths without a source prefix are rejected");

  resetOrganiseExecutionLock();
  const crossed = deps();
  const crossedResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, destSourceId: sourceB, currentPath: "Downloads/factura-acme.pdf", proposedPath: "Invoices/factura-acme.pdf" })],
    crossed.options,
  );
  assert(crossedResult.ok, "cross-source rejection is a completed batch");
  assert(crossedResult.ok && crossedResult.items[0]?.skipReason === CROSS_SOURCE_REASON, "executor rejects the other source");
  assert(crossed.calls.length === 0, "cross-source rejection does not write");

  resetOrganiseExecutionLock();
  const renamed = deps();
  const renameResult = await executeGuardedPlan(
    [planItem({ action: "rename", sourceId: sourceA, currentPath: "Invoices/Factura Acme.pdf", proposedPath: "Invoices/factura-acme.pdf" })],
    renamed.options,
  );
  assert(renameResult.ok && renameResult.items[0]?.status === "applied", "same-folder rename can run");
  assert(renamed.calls[0]?.includes("Invoices/Factura Acme.pdf->Invoices/factura-acme.pdf"), "rename stays in the folder");

  resetOrganiseExecutionLock();
  const moved = deps();
  const moveResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/factura-acme.pdf", proposedPath: "Invoices/factura-acme.pdf" })],
    moved.options,
  );
  assert(moveResult.ok && moveResult.items[0]?.status === "applied", "same-source move can run");
  assert(moved.calls[0]?.startsWith(`${sourceA}:`), "move uses the origin handle");

  resetOrganiseExecutionLock();
  const occupied = deps({
    transfer: async () => ({ outcome: "skipped", reason: DEST_EXISTS_REASON, createdFolders: [] }),
  });
  const occupiedResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/factura-acme.pdf", proposedPath: "Invoices/factura-acme.pdf" })],
    occupied.options,
  );
  assert(occupiedResult.ok && occupiedResult.items[0]?.status === "skipped", "existing destination is not overwritten");
  assert(occupiedResult.ok && occupiedResult.items[0]?.skipReason === DEST_EXISTS_REASON, "overwrite reason is explicit");

  resetOrganiseExecutionLock();
  const probed = deps({
    transfer: async () => ({ outcome: "failed", reason: DEST_PROBE_REASON, createdFolders: [] }),
  });
  const probedResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/factura-acme.pdf", proposedPath: "Invoices/factura-acme.pdf" })],
    probed.options,
  );
  assert(probedResult.ok && probedResult.items[0]?.status === "failed", "destination probe errors fail the item");
  assert(probedResult.ok && probedResult.items[0]?.skipReason === DEST_PROBE_REASON, "probe error is not treated as missing");
  assert(!isNotFoundError(Object.assign(new Error("denied"), { name: "NotAllowedError" })), "permission errors are not NotFound");
  assert(isNotFoundError(Object.assign(new Error("missing"), { name: "NotFoundError" })), "NotFound still means absent");

  resetOrganiseExecutionLock();
  const duplicates = deps();
  const duplicateResult = await executeGuardedPlan(
    [
      planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" }),
      planItem({ sourceId: sourceA, currentPath: "Desktop/b.pdf", proposedPath: "Invoices/a.pdf" }),
    ],
    duplicates.options,
  );
  assert(duplicateResult.ok, "duplicate destinations finish as a batch result");
  assert(
    duplicateResult.ok && duplicateResult.items.every((item) => item.skipReason === DUPLICATE_DESTINATION_REASON),
    "both items report the shared destination",
  );
  assert(duplicates.calls.length === 0, "duplicate destinations do not write in arrival order");

  resetOrganiseExecutionLock();
  const repeated = deps();
  const repeatedResult = await executeGuardedPlan(
    [
      planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" }),
      planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Notes/a.pdf" }),
    ],
    repeated.options,
  );
  assert(
    repeatedResult.ok && repeatedResult.items.every((item) => item.skipReason === DUPLICATE_ORIGIN_REASON),
    "the same file selected twice is rejected",
  );
  assert(repeated.calls.length === 0, "duplicate selections do not write");

  resetOrganiseExecutionLock();
  let permissionChecks = 0;
  const denied = deps({
    ensurePermission: async () => {
      permissionChecks += 1;
      if (permissionChecks === 1) return false;
      if (permissionChecks === 2) return true;
      return false;
    },
  });
  const deniedResult = await executeGuardedPlan(
    [
      planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" }),
      planItem({ sourceId: sourceA, currentPath: "Downloads/b.pdf", proposedPath: "Invoices/b.pdf" }),
    ],
    denied.options,
  );
  assert(deniedResult.ok && deniedResult.items.every((item) => item.skipReason === PERMISSION_REASON), "permission denied before and during the batch");
  assert(denied.calls.length === 0, "denied permission does not transfer");

  const incomplete = await runCopyFallback({
    readOrigin: async () => ({ size: 4 }),
    writeDest: async () => {
      throw new Error("stream closed");
    },
    readDestSize: async () => 4,
    removeOrigin: async () => {
      throw new Error("origin should stay");
    },
  });
  assert(incomplete.outcome === "failed" && incomplete.reason === COPY_INCOMPLETE_REASON, "failed copy leaves the origin");

  let removed = false;
  const partial = await runCopyFallback({
    readOrigin: async () => ({ size: 4 }),
    writeDest: async () => {},
    readDestSize: async () => 4,
    removeOrigin: async () => {
      removed = true;
      throw new Error("remove failed");
    },
  });
  assert(removed && partial.outcome === "partial" && partial.reason === PARTIAL_DELETE_REASON, "finished copy with failed delete is partial");

  resetOrganiseExecutionLock();
  let releaseTransfer: () => void = () => {};
  const transferGate = new Promise<void>((resolve) => {
    releaseTransfer = resolve;
  });
  let progressSeen: Promise<void> | null = null;
  let markProgress: () => void = () => {};
  progressSeen = new Promise<void>((resolve) => {
    markProgress = resolve;
  });
  const first = executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" })],
    {
      ...deps().options,
      onJournal: async (snapshot) => {
        if (snapshot.phase === "progress") markProgress();
      },
      transfer: async () => {
        await transferGate;
        return applied;
      },
    },
  );
  await progressSeen;
  const second = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/b.pdf", proposedPath: "Invoices/b.pdf" })],
    deps().options,
  );
  assert(!second.ok && second.error.message === BUSY_REASON, "a second confirmation does not run beside the first");
  releaseTransfer();
  const firstResult = await first;
  assert(firstResult.ok && firstResult.items[0]?.status === "applied", "the first confirmation still finishes");

  resetOrganiseExecutionLock();
  const unrecorded = deps({
    onJournal: async () => {
      throw new Error("disk full");
    },
  });
  const unrecordedResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" })],
    unrecorded.options,
  );
  assert(!unrecordedResult.ok && unrecordedResult.error.message === INTENT_PERSIST_REASON, "intent persistence failure stops the batch");
  assert(unrecorded.calls.length === 0, "no mutation happens when intent cannot be stored");

  resetOrganiseExecutionLock();
  const journal: string[] = [];
  const interrupted = deps({
    onJournal: async (snapshot) => {
      journal.push(snapshot.phase);
      if (snapshot.phase === "settled" && snapshot.items.some((item) => item.status === "applied")) {
        throw new Error("interrupted");
      }
    },
  });
  const interruptedResult = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" })],
    interrupted.options,
  );
  assert(journal.includes("intent") && journal.includes("progress"), "intent and progress are recorded first");
  assert(interruptedResult.ok && interruptedResult.items[0]?.skipReason === UNCERTAIN_NOTE, "a lost result stays uncertain");
  assert(interruptedResult.ok && interruptedResult.items[0]?.status !== "applied", "uncertain work is not shown as applied");

  resetOrganiseExecutionLock();
  const undo = deps({
    transfer: async () => ({ outcome: "skipped", reason: DEST_EXISTS_REASON, createdFolders: [] }),
  });
  const undoResult = await executeGuardedPlan(
    [planItem({ action: "move", sourceId: sourceA, currentPath: "Invoices/factura-acme.pdf", proposedPath: "Downloads/factura-acme.pdf" })],
    undo.options,
  );
  assert(undoResult.ok && undoResult.items[0]?.status === "skipped", "undo does not overwrite an occupied original");

  resetOrganiseExecutionLock();
  const indexed = deps();
  const indexedResult = await executeGuardedPlan(
    [
      planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" }),
      planItem({ sourceId: sourceB, currentPath: "Downloads/b.pdf", proposedPath: "Invoices/b.pdf", selected: false }),
    ],
    indexed.options,
  );
  assert(indexedResult.ok && indexedResult.affectedSourceIds.join() === sourceA, "only the source that changed is affected");

  resetOrganiseExecutionLock();
  let closedWrites = 0;
  const closed = await executeGuardedPlan(
    [planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf" })],
    {
      ...deps().options,
      canWrite: false,
      transfer: async () => {
        closedWrites += 1;
        return applied;
      },
    },
  );
  assert(!closed.ok && closed.error.message === NO_WRITE_SUPPORT_REASON, "read-only selection closes execution");
  assert(closedWrites === 0, "read-only selection does not transfer");

  const preflight = preflightPlanItems([
    planItem({ sourceId: sourceA, currentPath: "Downloads/a.pdf", proposedPath: "Invoices/a.pdf", selected: false }),
  ]);
  assert(preflight[0]?.status === "skipped" && preflight[0]?.skipReason !== INTENT_NOTE, "removing a plan row does not write");

  console.log("ORGANISE-INTEGRITY-001 simulated executor checks passed");
}

await runIntegrityChecks();
