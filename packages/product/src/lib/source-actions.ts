/**
 * Source actions — tokens only.
 *
 * Derived from lifecycle status.
 * A health reason, when the caller passes one, wins.
 * Otherwise a host access flag (`connectGrant`) chooses the recovery token.
 * No button labels. No host kind.
 */

import type { SourceAvailabilityReason } from "./source-health.ts";
import type { SourceStatus } from "./source-lifecycle.ts";

export type SourceRecommendedAction =
  | "restore_permission"
  | "locate_folder"
  | "retry"
  | "remove"
  | "none";

const AVAILABILITY_REASONS = new Set<SourceAvailabilityReason>([
  "disk_offline",
  "permission_revoked",
  "folder_deleted",
  "folder_moved",
  "scan_failed",
  "unknown",
]);

function isAvailabilityReason(value: unknown): value is SourceAvailabilityReason {
  return typeof value === "string" && AVAILABILITY_REASONS.has(value as SourceAvailabilityReason);
}

/** Legacy boolean meant a grant host. Objects ask connectGrant. Default keeps the grant action. */
function connectGrantFrom(hint: unknown): boolean {
  if (typeof hint === "boolean") return hint;
  if (hint && typeof hint === "object" && "connectGrant" in hint) {
    return Boolean((hint as { connectGrant?: boolean }).connectGrant);
  }
  return true;
}

type ActionHint = SourceAvailabilityReason | boolean | { connectGrant?: boolean } | null;

export function sourceRecommendedAction(
  status: SourceStatus,
  hint?: ActionHint,
  access?: { connectGrant?: boolean } | boolean | null,
): SourceRecommendedAction {
  if (status === "indexed" || status === "indexing") return "none";
  if (status === "permission_required") return "restore_permission";
  if (status === "missing") return "locate_folder";
  if (status === "error") return "retry";
  if (status === "unavailable") {
    if (isAvailabilityReason(hint) && hint !== "unknown") {
      if (hint === "folder_moved" || hint === "folder_deleted") return "locate_folder";
      if (hint === "disk_offline" || hint === "scan_failed") return "retry";
      if (hint === "permission_revoked") return "restore_permission";
    }
    const grant = access !== undefined && access !== null ? access : hint;
    return connectGrantFrom(grant) ? "restore_permission" : "retry";
  }
  return "none";
}
