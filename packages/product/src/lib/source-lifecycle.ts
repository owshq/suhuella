/**
 * Source lifecycle — transitions only.
 *
 * See SOURCE-DOMAIN-MODEL-001.md and SOURCE-LIFECYCLE-MODEL-001.md
 *
 * Status tokens and Activity transition rules live here.
 * Identity, Handle, Health, actions, and host vocabulary do not.
 */

export type SourceStatus =
  | "indexed"
  | "indexing"
  | "permission_required"
  | "missing"
  | "unavailable"
  | "error";

export type SourceTransitionKind =
  | "source_connected"
  | "source_reconnected"
  | "permission_lost"
  | "permission_required"
  | "permission_restored"
  | "source_unavailable"
  | "source_updated"
  | "source_removed";

export type SourceStateTransition = {
  from: SourceStatus | null;
  to: SourceStatus;
  sourceName: string;
};

/** Used only to classify a transition. Not a capability. */
export function sourceIsAccessible(status: SourceStatus): boolean {
  return status === "indexed" || status === "indexing";
}

/** Activity records transitions, not repeated probes on the same state. */
export function shouldRecordSourceTransition(
  from: SourceStatus | null,
  to: SourceStatus,
): boolean {
  if (from === to) return false;
  if (from === "indexing" && to === "indexed") return false;
  return true;
}

export function sourceTransitionKind(transition: SourceStateTransition): SourceTransitionKind {
  const { from, to } = transition;
  if (from === null && to === "indexed") return "source_connected";
  if (to === "indexed" && from === "permission_required") return "permission_restored";
  if (to === "indexed" && from && !sourceIsAccessible(from)) return "source_reconnected";
  if (from === "indexed" && to === "permission_required") return "permission_lost";
  if (to === "permission_required") return "permission_required";
  if (!sourceIsAccessible(to) && from && sourceIsAccessible(from)) return "source_unavailable";
  return "source_updated";
}

/** @deprecated Use shouldRecordSourceTransition */
export function shouldRecordSourceUnavailable(
  from: SourceStatus | null,
  to: SourceStatus,
): boolean {
  return shouldRecordSourceTransition(from, to) && !sourceIsAccessible(to);
}

/** @deprecated Use shouldRecordSourceTransition */
export function shouldRecordSourceRestored(
  from: SourceStatus | null,
  to: SourceStatus,
): boolean {
  return shouldRecordSourceTransition(from, to) && sourceIsAccessible(to);
}
