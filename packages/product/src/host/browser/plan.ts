import { describeLocalFile } from "./descriptors";
import { ensurePermission, loadHandle, moveOrRenameFile } from "./fs";
import { recommendFolders } from "./recommendations";
import { proposeSafeRename, renameNameConflicts, validateSafeFileName } from "./rename";
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

function folderAt(folders: IndexedFolderEntry[], locator: string): IndexedFolderEntry | undefined {
  return folders.find((folder) => sameFolder(folder.absolutePath, locator) || sameFolder(folder.relativePath, locator));
}

export function previewPlan(files: WebIndexedFile[], folders: IndexedFolderEntry[]): WebPlanItem[] {
  return files.map((file) => {
    const descriptor = describeLocalFile(file.name, file.relativePath);
    const recommendations = recommendFolders({ descriptor, folders });
    const top = recommendations[0];
    const currentDir = file.parentRelative || ".";

    if (!top || top.score < MIN_MOVE_SCORE) {
      return item({
        action: "none",
        currentPath: file.relativePath,
        proposedPath: null,
        fileName: file.name,
        sourceId: file.sourceId,
        explanation: "No confident destination found.",
        reviewGroup: "skipped",
        selected: false,
        score: top?.score ?? null,
        confidenceLabel: top?.confidenceLabel ?? null,
        skipReason: "No confident destination found",
      });
    }

    if (sameFolder(currentDir, top.folder) || sameFolder(currentDir, folderAt(folders, top.folder)?.relativePath ?? "")) {
      const destination = folderAt(folders, top.folder);
      const proposal = proposeSafeRename(file.name, destination?.fileNames ?? []);
      if (!proposal) {
        return item({
          action: "none",
          currentPath: file.relativePath,
          proposedPath: null,
          fileName: file.name,
          sourceId: file.sourceId,
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
        explanation: proposal.explanation,
        renameReasons: proposal.reasons,
        reviewGroup: ready ? "ready" : "review",
        selected: ready,
        score: top.score,
        confidenceLabel: top.confidenceLabel,
        skipReason: null,
      });
    }

    const destRelative = folderAt(folders, top.folder)?.relativePath ?? top.folder;
    const proposedPath = joinPath(destRelative === "." ? "" : destRelative, file.name);
    const destFolder = folderAt(folders, destRelative);
    if (destFolder?.fileNames.some((name) => name.toLowerCase() === file.name.toLowerCase())) {
      return item({
        action: "none",
        currentPath: file.relativePath,
        proposedPath,
        fileName: file.name,
        sourceId: file.sourceId,
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

export async function executePlanItems(items: WebPlanItem[]): Promise<WebPlanItem[]> {
  const results: WebPlanItem[] = [];
  for (const item of items) {
    if (!canConfirm(item) || !item.proposedPath) {
      results.push({ ...item, status: "skipped", skipReason: item.skipReason ?? "Not selected" });
      continue;
    }
    const handle = await loadHandle(item.sourceId);
    if (!handle) {
      results.push({ ...item, status: "failed", skipReason: "This folder is no longer available." });
      continue;
    }
    if (!(await ensurePermission(handle, "readwrite"))) {
      results.push({ ...item, status: "failed", skipReason: "This folder needs permission." });
      continue;
    }
    try {
      await moveOrRenameFile(handle, item.currentPath, item.proposedPath);
      results.push({ ...item, status: "applied" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply this action.";
      results.push({
        ...item,
        status: message.includes("overwrite") ? "skipped" : "failed",
        skipReason: message,
        warnings: [...item.warnings, message],
      });
    }
  }
  return results;
}
