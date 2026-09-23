/**
 * HANDLE-LIFECYCLE-BRIDGE — the only authorized translation layer.
 *
 * Only handle-lifecycle-bridge may translate HandleStatus into SourceLifecycle.
 * No other component may do so.
 *
 * Handles never reach Presentation.
 * React must never read HandleStatus or map permissionDenied to UI copy.
 *
 * Handle → HandleStatus → (this module) → Lifecycle → Presentation
 */

import type { SourceAvailabilityReason } from "../lib/source-health.ts";
import type { SourcePermissionState } from "../lib/source-handle.ts";
import type { SourceStatus } from "../lib/source-lifecycle.ts";
import type { HandleStatus } from "./source-handles.ts";

export type HandleLifecycleProbe = {
  status: SourceStatus;
  permission: SourcePermissionState;
  availabilityReason: SourceAvailabilityReason | null;
};

export function handleStatusToLifecycle(status: HandleStatus): HandleLifecycleProbe {
  switch (status) {
    case "unknown":
      return { status: "unavailable", permission: "unknown", availabilityReason: null };
    case "available":
      return { status: "indexed", permission: "granted", availabilityReason: null };
    case "permissionDenied":
      return { status: "permission_required", permission: "denied", availabilityReason: "permission_revoked" };
    case "notFound":
      return { status: "missing", permission: "unknown", availabilityReason: "folder_moved" };
    case "offline":
      return { status: "unavailable", permission: "granted", availabilityReason: "disk_offline" };
    case "busy":
      return { status: "indexing", permission: "granted", availabilityReason: null };
    case "unsupported":
      return { status: "unavailable", permission: "unknown", availabilityReason: "unknown" };
  }
}

/**
 * Host fallback when a probe did not record an availability reason.
 *
 * Host status → lifecycle → health observation.
 * This is not domain Health. Callers resolve it before Presentation.
 */
export function availabilityReasonForStatus(
  status: SourceStatus,
  hint?: SourceAvailabilityReason | null,
): SourceAvailabilityReason | null {
  if (status === "indexed" || status === "indexing") return null;
  if (status === "permission_required") return "permission_revoked";
  if (status === "missing") return hint ?? "folder_moved";
  if (status === "error") return "scan_failed";
  if (status === "unavailable") return hint ?? "unknown";
  return null;
}
