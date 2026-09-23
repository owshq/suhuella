/**
 * Source health — observations only.
 *
 * Timestamps and availability reasons are recorded here.
 * This module does not decide status, actions, or transitions.
 */

export type SourceAvailabilityReason =
  | "disk_offline"
  | "permission_revoked"
  | "folder_deleted"
  | "folder_moved"
  | "scan_failed"
  | "unknown";

export type SourceHealth = {
  lastIndexedAt: string | null;
  lastCheckedAt: string | null;
  lastStateChangeAt: string | null;
  availabilityReason: SourceAvailabilityReason | null;
};

export function emptySourceHealth(): SourceHealth {
  return {
    lastIndexedAt: null,
    lastCheckedAt: null,
    lastStateChangeAt: null,
    availabilityReason: null,
  };
}

/** Write an observation. Does not infer a reason from status. */
export function recordHealthObservation(
  previous: SourceHealth,
  observation: {
    at: string;
    statusChanged: boolean;
    availabilityReason: SourceAvailabilityReason | null;
    indexedAt?: string | null;
    stateChangeFallback?: string | null;
  },
): SourceHealth {
  return {
    lastIndexedAt:
      observation.indexedAt !== undefined ? observation.indexedAt : previous.lastIndexedAt,
    lastCheckedAt: observation.at,
    lastStateChangeAt: observation.statusChanged
      ? observation.at
      : previous.lastStateChangeAt ?? observation.stateChangeFallback ?? observation.at,
    availabilityReason: observation.availabilityReason,
  };
}
