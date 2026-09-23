/**
 * Source capabilities — derived.
 *
 * Answers "what can this Source do?" from lifecycle status
 * and optional host access. Not stored. Not decided by the UI.
 */

import { sourceIsAccessible, type SourceStatus } from "./source-lifecycle.ts";

export type SourceCapabilities = {
  searchable: boolean;
  openable: boolean;
  organisable: boolean;
  removable: boolean;
  reconnectable: boolean;
  refreshable: boolean;
  watchable: boolean;
};

export function sourceCapabilities(
  status: SourceStatus,
  access?: { folderWatching?: boolean },
): SourceCapabilities {
  const ready = sourceIsAccessible(status);
  return {
    searchable: true,
    openable: ready,
    organisable: ready,
    removable: true,
    reconnectable:
      status === "permission_required" || status === "missing" || status === "unavailable",
    refreshable: status === "error" || status === "indexed",
    watchable: Boolean(access?.folderWatching) && ready,
  };
}
