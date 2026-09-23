/**
 * SOURCE PROJECTION — adapter factory contract.
 *
 * Each host implements one `project*Source()` function. That is the only
 * authorised path from persisted host storage into the frozen domain:
 *
 * ```text
 * Browser store          projectBrowserSource()       Domain
 * ─────────────          ──────────────────────       ──────
 * WebKnowledgeSource  →  Source                       identity
 *                        Handle                       access + contractVersion
 *                        Health                       observations
 *                        status                       lifecycle token
 *                              │
 *                              ▼
 *                        buildSourcePresentation()
 *                              │
 *                              ▼
 *                        React (SourcePresentation only)
 * ```
 *
 * Future factories (same contract, different store):
 *
 * - `projectElectronSource()`
 * - `projectGoogleDriveSource()`
 * - `projectIOSSource()`
 *
 * They must not mint a new Source id on reconnect. They must not persist
 * SourcePresentation.
 */

import {
  SOURCE_HANDLE_DOMAIN_CONTRACT_VERSION,
  type SourceHandle,
} from "../../lib/source-handle.ts";
import type { SourceHealth } from "../../lib/source-health.ts";
import { sourceId, type Source } from "../../lib/source-identity.ts";
import { sourceAccessState } from "../../lib/source-host-vocabulary.ts";
import type { SourceStatus } from "../../lib/source-lifecycle.ts";
import type { WebKnowledgeSource } from "./types.ts";

/** Adapter key for the browser grant store. Not a domain enum. */
export const BROWSER_SOURCE_ADAPTER_ID = "browser";

export type ProjectedSource = {
  source: Source;
  handle: SourceHandle;
  health: SourceHealth;
  status: SourceStatus;
};

export function projectBrowserSource(record: WebKnowledgeSource): ProjectedSource {
  const id = sourceId(record.id);
  return {
    source: {
      id,
      displayName: record.name,
    },
    handle: {
      sourceId: id,
      permission: record.permission ?? "unknown",
      adapterId: BROWSER_SOURCE_ADAPTER_ID,
      contractVersion: SOURCE_HANDLE_DOMAIN_CONTRACT_VERSION,
    },
    health: {
      lastIndexedAt: record.lastIndexed,
      lastCheckedAt: record.lastCheckedAt ?? null,
      lastStateChangeAt: record.lastStateChangeAt ?? null,
      availabilityReason: record.availabilityReason ?? null,
    },
    status: sourceAccessState(record.status),
  };
}
