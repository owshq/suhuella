/**
 * Source Presentation — the only DTO allowed toward React.
 *
 * See SOURCE-DOMAIN-MODEL-001.md
 *
 * Domain speaks tokens. This layer resolves copy.
 * React never receives Source, Handle, SourceHealth, or SourceLifecycle.
 *
 * Presentation is ephemeral. It is never persisted — not in IndexedDB,
 * not on disk, not in Activity. Hosts may attach it to a host summary
 * for the current render only.
 */

import { sourceRecommendedAction, type SourceRecommendedAction } from "./source-actions.ts";
import type { SourcePermissionState } from "./source-handle.ts";
import type { SourceAvailabilityReason } from "./source-health.ts";
import { sourceAccessState } from "./source-host-vocabulary.ts";
import {
  sourceIsAccessible,
  sourceTransitionKind,
  type SourceStateTransition,
  type SourceStatus,
  type SourceTransitionKind,
} from "./source-lifecycle.ts";
import type { HostAccessCapabilities } from "./platform-capabilities.ts";
import { hostAccessFromLegacyBrowserFlag } from "./platform-capabilities.ts";
import { sourceCapabilities, type SourceCapabilities } from "./source-capabilities.ts";
import { resolveSourceDisplayName } from "./source-display-name.ts";
import type { IndexedLocationStatus } from "../types.ts";

export type SourcePresentationSummary = {
  title: string;
  documentCount: number;
  lastIndexedAt: string | null;
  lastCheckedAt: string | null;
  lastStateChangeAt: string | null;
  lines: string[];
};

export type SourcePresentationStatus = {
  kind: SourceStatus;
  sightLabel: string;
  detail: string;
  accessible: boolean;
};

export type SourcePresentation = {
  id: string;
  summary: SourcePresentationSummary;
  status: SourcePresentationStatus;
  actions: SourceRecommendedAction[];
  capabilities: SourceCapabilities;
};

const ACTION_LABELS: Record<Exclude<SourceRecommendedAction, "none">, string> = {
  restore_permission: "Restore permission",
  locate_folder: "Locate again",
  retry: "Retry",
  remove: "Remove",
};

const TRANSITION_TITLES: Record<SourceTransitionKind, string> = {
  source_connected: "Source connected",
  source_reconnected: "Source reconnected",
  permission_lost: "Permission lost",
  permission_required: "Permission required",
  permission_restored: "Permission restored",
  source_unavailable: "Source unavailable",
  source_updated: "Source updated",
  source_removed: "Source removed",
};

/** Client chrome for a domain action ID. Icons stay in the view. */
export function sourceActionLabel(action: SourceRecommendedAction): string | null {
  if (action === "none") return null;
  return ACTION_LABELS[action];
}

/** @deprecated Use sourceActionLabel(sourceRecommendedAction(status)) */
export function sourceLifecycleActionLabel(
  status: SourceStatus,
  access: boolean | Pick<HostAccessCapabilities, "connectGrant"> = true,
): string | null {
  return sourceActionLabel(sourceRecommendedAction(status, null, typeof access === "boolean" ? { connectGrant: access } : access));
}

/** @deprecated Use sourceActionLabel */
export function sourceRecommendedActionLabel(action: SourceRecommendedAction): string | null {
  return sourceActionLabel(action);
}

function statusDetail(status: SourceStatus, reason: SourceAvailabilityReason | null): string {
  if (status === "indexing") return "Updating…";
  if (status === "permission_required") return "SuHuella needs permission again";
  if (status === "missing") {
    if (reason === "folder_deleted") return "This folder could not be found";
    return "This folder could not be found";
  }
  if (status === "error") return "Indexing failed";
  if (status === "unavailable") {
    if (reason === "disk_offline") return "This folder is not currently available";
    return "This folder is not currently available";
  }
  return "";
}

/** Public Sources badge stays in the frozen vocabulary. */
export function sourcePresentationSightLabel(status: SourceStatus, scanning?: boolean): string {
  if (status === "indexing" || scanning) return "Indexed";
  if (status === "indexed") return "Indexed";
  return "Unavailable";
}

function relativeHealthTime(iso: string | null | undefined, prefix = ""): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const ms = Date.now() - date.getTime();
  const label = prefix ? `${prefix} ` : "";
  if (ms < 45_000) return `${label}just now`.trim();
  if (ms < 3_600_000) {
    const mins = Math.max(1, Math.round(ms / 60_000));
    return `${label}${mins} minute${mins === 1 ? "" : "s"} ago`.trim();
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date >= today) {
    const hours = Math.max(1, Math.round(ms / 3_600_000));
    return `${label}${hours} hour${hours === 1 ? "" : "s"} ago`.trim();
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= yesterday) return `${label}yesterday`.trim();
  const diffDays = Math.floor(ms / 86_400_000);
  if (diffDays < 7) return `${label}${diffDays} days ago`.trim();
  return `${label}${date.toLocaleDateString()}`.trim();
}

export function sourceHealthDetailLines(presentation: SourcePresentation): string[] {
  return presentation.summary.lines;
}

function buildSummaryLines(
  status: SourceStatus,
  documentCount: number,
  lastIndexedAt: string | null,
  lastCheckedAt: string | null,
  detail: string,
): string[] {
  const lines: string[] = [];
  if (status === "indexed" || status === "indexing") {
    if (documentCount > 0) {
      lines.push(`${documentCount.toLocaleString()} document${documentCount === 1 ? "" : "s"}`);
    }
    const checked = relativeHealthTime(lastCheckedAt);
    if (checked) lines.push(`Last checked ${checked}`);
    const updated = relativeHealthTime(lastIndexedAt, "Last updated");
    if (updated) lines.push(updated);
    return lines.filter(Boolean);
  }
  if (detail) lines.push(detail);
  if (documentCount > 0) {
    lines.push(`${documentCount.toLocaleString()} document${documentCount === 1 ? "" : "s"} remembered`);
  }
  const updated = relativeHealthTime(lastIndexedAt, "Last updated");
  if (updated) lines.push(updated);
  const checked = relativeHealthTime(lastCheckedAt, "Last checked");
  if (checked) lines.push(checked);
  return lines.filter(Boolean);
}

function presentationActions(
  recommended: SourceRecommendedAction,
  accessible: boolean,
): SourceRecommendedAction[] {
  const actions: SourceRecommendedAction[] = [];
  if (recommended !== "none") actions.push(recommended);
  if (!accessible) actions.push("remove");
  return actions;
}

export function buildSourcePresentation(input: {
  id: string;
  displayName: string;
  locationStatus: IndexedLocationStatus | string;
  documentCount: number;
  lastIndexedAt?: string | null;
  lastCheckedAt?: string | null;
  lastStateChangeAt?: string | null;
  availabilityReason?: SourceAvailabilityReason | null;
  permission?: SourcePermissionState;
  access?: HostAccessCapabilities;
  /** @deprecated Use access from hostAccessFor(host) */
  browser?: boolean;
  scanning?: boolean;
}): SourcePresentation {
  const status = sourceAccessState(input.locationStatus);
  const availabilityReason = input.availabilityReason ?? null;
  const access = input.access ?? hostAccessFromLegacyBrowserFlag(input.browser ?? true);
  const recommendedAction = sourceRecommendedAction(status, availabilityReason, access);
  const accessible = sourceIsAccessible(status);
  const detail = statusDetail(status, availabilityReason);
  const lastIndexedAt = input.lastIndexedAt ?? null;
  const lastCheckedAt = input.lastCheckedAt ?? null;
  const lastStateChangeAt = input.lastStateChangeAt ?? null;
  return {
    id: input.id,
    summary: {
      title: resolveSourceDisplayName(input.displayName),
      documentCount: input.documentCount,
      lastIndexedAt,
      lastCheckedAt,
      lastStateChangeAt,
      lines: buildSummaryLines(status, input.documentCount, lastIndexedAt, lastCheckedAt, detail),
    },
    status: {
      kind: status,
      sightLabel: sourcePresentationSightLabel(status, input.scanning),
      detail,
      accessible,
    },
    actions: presentationActions(recommendedAction, accessible),
    capabilities: sourceCapabilities(status, access),
  };
}

export function sourceSearchUnavailableLine(sourceName?: string): string {
  const name = sourceName ? resolveSourceDisplayName(sourceName) : null;
  return name
    ? `Unavailable — Reconnect ${name} to open`
    : "Unavailable — Reconnect source to open";
}

export function sourceOpenBlockedCopy(sourceName: string): string {
  const name = resolveSourceDisplayName(sourceName);
  return `This document belongs to a source that is no longer available. Reconnect "${name}" to open it.`;
}

export function sourceOrganiseBlockedCopy(sourceName: string): string {
  return `Reconnect "${resolveSourceDisplayName(sourceName)}" before creating a Plan.`;
}

export function sourceTransitionTitle(transition: SourceStateTransition): string {
  return TRANSITION_TITLES[sourceTransitionKind(transition)];
}

export function sourceTransitionMessage(transition: SourceStateTransition): string {
  const name = resolveSourceDisplayName(transition.sourceName);
  const kind = sourceTransitionKind(transition);
  switch (kind) {
    case "source_connected":
      return `"${name}" is now visible to SuHuella.`;
    case "source_reconnected":
    case "permission_restored":
      return `"${name}" is available again.`;
    case "permission_lost":
      return `"${name}" needs permission again. Restore or remove it.`;
    case "permission_required":
    case "source_unavailable":
      return `"${name}" could not be found. Reconnect or remove it.`;
    default:
      return `"${name}" changed from ${transition.from ?? "new"} to ${transition.to}.`;
  }
}

export function sourceRemovedActivityTitle(): string {
  return TRANSITION_TITLES.source_removed;
}

export function sourceRemovedActivityMessage(sourceName: string): string {
  return `Removed source: ${resolveSourceDisplayName(sourceName)}`;
}
