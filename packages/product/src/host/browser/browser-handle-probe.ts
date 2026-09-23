/**
 * Host record words from HandleStatus.
 * Translation goes only through handle-lifecycle-bridge.
 */

import type { SourcePermissionState } from "../../lib/source-handle.ts";
import type { SourceAvailabilityReason } from "../../lib/source-health.ts";
import type { SourceStatus } from "../../lib/source-lifecycle.ts";
import { handleStatusToLifecycle } from "../handle-lifecycle-bridge.ts";
import type { HandleStatus } from "../source-handles.ts";
import type { WebSourceStatus } from "./types.ts";

export type BrowserHandleProbe = {
  status: WebSourceStatus;
  availabilityReason: SourceAvailabilityReason | null;
  permission: SourcePermissionState;
};

function webStatusFromLifecycle(status: SourceStatus): WebSourceStatus {
  if (status === "indexed") return "ready";
  if (status === "indexing") return "indexing";
  if (status === "permission_required") return "needs_permission";
  if (status === "missing") return "missing";
  if (status === "error") return "error";
  return "unavailable";
}

export function browserStoreProbeFromHandleStatus(status: HandleStatus): BrowserHandleProbe {
  const probe = handleStatusToLifecycle(status);
  return {
    status: webStatusFromLifecycle(probe.status),
    availabilityReason: probe.availabilityReason,
    permission: probe.permission,
  };
}
