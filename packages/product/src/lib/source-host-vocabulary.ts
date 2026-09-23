/**
 * Adapter for the status words current hosts already store.
 *
 * Browser and Desktop records still say `ready`, `needs_permission`,
 * `permission_denied`, and so on. This file translates those words into
 * SourceStatus. It is not the Source model.
 *
 * A new platform does not extend this file. It emits SourceStatus itself.
 *
 * Health fallbacks for missing probe observations live in
 * handle-lifecycle-bridge.ts — not here.
 */

import type { IndexedLocationStatus } from "../types.ts";
import type { SourceStatus } from "./source-lifecycle.ts";

const HOST_TO_LOCATION: Record<string, IndexedLocationStatus> = {
  ready: "ready",
  indexing: "indexing",
  needs_permission: "permission_denied",
  unavailable: "unavailable",
  missing: "missing",
  error: "error",
};

/** Thrown when a host stores a word this vocabulary does not recognise. */
export class UnknownHostStatusError extends Error {
  readonly hostStatus: string;

  constructor(hostStatus: string) {
    super(`Unknown host status: ${hostStatus}`);
    this.name = "UnknownHostStatusError";
    this.hostStatus = hostStatus;
  }
}

function strictHostVocabulary(): boolean {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") return true;
  try {
    return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

export function hostStatusToLocationStatus(status: string): IndexedLocationStatus {
  return HOST_TO_LOCATION[status] ?? "unavailable";
}

/** Map a stored host word onto the canonical lifecycle status. Idempotent for SourceStatus. */
export function sourceAccessState(status: string): SourceStatus {
  if (status === "indexing") return "indexing";
  if (status === "indexed") return "indexed";
  if (
    status === "permission_denied" ||
    status === "needs_permission" ||
    status === "permission_required"
  ) {
    return "permission_required";
  }
  if (status === "missing") return "missing";
  if (status === "error") return "error";
  if (
    status === "unavailable" ||
    status === "external_drive_disconnected" ||
    status === "cancelled"
  ) {
    return "unavailable";
  }
  if (status === "ready") return "indexed";
  if (strictHostVocabulary()) {
    throw new UnknownHostStatusError(status);
  }
  return "indexed";
}
