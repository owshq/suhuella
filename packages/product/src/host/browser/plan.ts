import { describeLocalFile } from "./descriptors.ts";
import { dedupeIndexedFiles, executeGuardedPlan, foldersForSource, type GuardedPlanDeps } from "./organise-integrity.ts";
import { recommendFolders } from "./recommendations.ts";
import { proposeSafeRename, renameNameConflicts, validateSafeFileName } from "./rename.ts";
import type { IndexedFolderEntry, WebIndexedFile, WebPlanItem } from "./types";

const MIN_MOVE_SCORE = 30;
const READY_SCORE = 50;

function sameFolder(left: string, right: string): boolean {
  return left.replace(/\/+$/, "").toLowerCase() === right.replace(/\/+$/, "").toLowerCase();
}

function joinPath(folder: string, fileName: string): string {
  if (!folder || folder === ".") return fileName;
  return `${folder.replace(/\/+$/, "")}/${fileName}`;
}

function parentPath(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/") || ".";
}

function foldersAt(folders: IndexedFolderEntry[], locator: string): IndexedFolderEntry[] {
  return folders.filter((folder) => sameFolder(folder.absolutePath, locator) || sameFolder(folder.relativePath, locator));
}

export function previewPlan(files: WebIndexedFile[], folders: IndexedFolderEntry[]): WebPlanItem[] {
  return dedupeIndexedFiles(files).map((file) => {
    const scoped = foldersForSource(folders, file.sourceId);
    const descriptor = describeLocalFile(file.name, file.relativePath);
    const recommendations = recommendFolders({ descriptor, folders: scoped });
    const top = recommendations[0];
    const currentDir = file.parentRelative || ".";

    if (!top || top.score < MIN_MOVE_SCORE) {
      return item({
        action: "none",
        currentPath: file.relativePath,
        proposedPath: null,
        fileName: file.name,
        sourceId: file.sourceId,
        destSourceId: file.sourceId,
        explanation: "No confident destination found.",
        reviewGroup: "skipped",
        selected: false,
        score: top?.score ?? null,
        confidenceLabel: top?.confidenceLabel ?? null,
        skipReason: "No confident destination found",
      });
    }

    const matched = foldersAt(scoped, top.folder);
    if (matched.length !== 1) {
      return item({
        action: "none",
        currentPath: file.relativePath,
        proposedPath: null,
        fileName: file.name,
        sourceId: file.sourceId,
        destSourceId: file.sourceId,
        explanation: "The destination folder is ambiguous.",
        reviewGroup: "skipped",
        selected: false,
        score: top.score,
        confidenceLabel: top.confidenceLabel,
        skipReason: "The destination folder is ambiguous.",
      });
    }
    const destination = matched[0];
    if (sameFolder(currentDir, top.folder) || sameFolder(currentDir, destination.relativePath)) {
      const proposal = proposeSafeRename(file.name, destination?.fileNames ?? []);
      if (!proposal) {
        return item({
          action: "none",
          currentPath: file.relativePath,
          proposedPath: null,
          fileName: file.name,
        sourceId: file.sourceId,
        destSourceId: file.sourceId,
        explanation: `Already in ${top.label}.`,
          reviewGroup: "skipped",
          selected: false,
          score: top.score,
          confidenceLabel: top.confidenceLabel,
          skipReason: "Already in the recommended folder",
        });
      }
      const proposedPath = joinPath(currentDir === "." ? "" : currentDir, proposal.name);
      const conflict = renameNameConflicts(proposal.name, file.name, destination?.fileNames ?? []);
      if (conflict) {
        return item({
          action: "rename",
          currentPath: file.relativePath,
          proposedPath,
          fileName: file.name,
          sourceId: file.sourceId,
          destSourceId: file.sourceId,
          explanation: `A file named ${proposal.name} already exists.`,
          renameReasons: proposal.reasons,
          reviewGroup: "skipped",
          selected: false,
          score: top.score,
          confidenceLabel: top.confidenceLabel,
          skipReason: "A file with that name already exists",
        });
      }
      const ready = top.score >= READY_SCORE;
      return item({
        action: "rename",
        currentPath: file.relativePath,
        proposedPath,
        fileName: file.name,
        sourceId: file.sourceId,
        destSourceId: file.sourceId,
        explanation: proposal.explanation,
        renameReasons: proposal.reasons,
        reviewGroup: ready ? "ready" : "review",
        selected: ready,
        score: top.score,
        confidenceLabel: top.confidenceLabel,
        skipReason: null,
      });
    }

    const destRelative = destination.relativePath;
    const proposedPath = joinPath(destRelative === "." ? "" : destRelative, file.name);
    const destFolder = destination;
    if (destFolder?.fileNames.some((name) => name.toLowerCase() === file.name.toLowerCase())) {
      return item({
        action: "none",
        currentPath: file.relativePath,
        proposedPath,
        fileName: file.name,
        sourceId: file.sourceId,
        destSourceId: file.sourceId,
        explanation: top.reasons.join(" · ") || top.label,
        reviewGroup: "skipped",
        selected: false,
        score: top.score,
        confidenceLabel: top.confidenceLabel,
        skipReason: "Target already exists",
      });
    }

    const ready = top.score >= READY_SCORE;
    return item({
      action: "move",
      currentPath: file.relativePath,
      proposedPath,
      fileName: file.name,
      sourceId: file.sourceId,
      destSourceId: file.sourceId,
      explanation: top.reasons.join(" · ") || `Move to ${top.label}.`,
      reviewGroup: ready ? "ready" : "review",
      selected: ready,
      score: top.score,
      confidenceLabel: top.confidenceLabel,
      skipReason: null,
    });
  });
}

function item(
  partial: Omit<WebPlanItem, "status" | "warnings" | "renameReasons"> & {
    warnings?: string[];
    renameReasons?: string[];
  },
): WebPlanItem {
  return {
    status: "preview",
    warnings: partial.warnings ?? [],
    renameReasons: partial.renameReasons ?? [],
    ...partial,
  };
}

export function canConfirm(item: WebPlanItem): boolean {
  return (
    item.selected &&
    Boolean(item.proposedPath) &&
    (item.action === "move" || item.action === "rename" || item.action === "create_folder" || item.action === "create_structure")
  );
}

export function validateEditedName(name: string): string | null {
  const result = validateSafeFileName(name);
  return result.ok ? null : result.reason;
}

export function applyNameEdit(item: WebPlanItem, nextName: string): WebPlanItem {
  const trimmed = nextName.trim();
  const invalid = validateEditedName(trimmed);
  if (invalid) {
    return { ...item, warnings: [invalid], reviewGroup: "review" };
  }
  return {
    ...item,
    proposedPath: joinPath(parentPath(item.proposedPath || item.currentPath), trimmed),
    selected: true,
    reviewGroup: "ready",
    warnings: [],
  };
}

export function inverseItem(item: WebPlanItem): WebPlanItem | null {
  if (!item.proposedPath || (item.action !== "move" && item.action !== "rename")) return null;
  return {
    ...item,
    currentPath: item.proposedPath,
    proposedPath: item.currentPath,
    fileName: item.proposedPath.split("/").at(-1) ?? item.fileName,
    status: "preview",
    selected: true,
    reviewGroup: "ready",
  };
}

export async function executePlanItems(
  items: WebPlanItem[],
  deps?: Pick<GuardedPlanDeps, "loadHandle" | "ensurePermission" | "transfer" | "onJournal" | "canWrite">,
): Promise<WebPlanItem[]> {
  const result = await executeGuardedPlan(items, {
    canWrite: deps?.canWrite ?? true,
    loadHandle: deps?.loadHandle ?? (async () => null),
    ensurePermission: deps?.ensurePermission ?? (async () => false),
    transfer: deps?.transfer ?? (async () => ({ outcome: "failed", reason: "File transfer is not available.", createdFolders: [] })),
    onJournal: deps?.onJournal,
  });
  if (!result.ok) {
    return items.map((item) => ({
      ...item,
      status: "failed",
      skipReason: result.error.message,
      warnings: [...item.warnings, result.error.message],
    }));
  }
  return result.items;
}
