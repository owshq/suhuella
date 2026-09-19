export type SourceRemovalReason = "user_remove" | "clear_knowledge" | "permission_missing"

/** Frozen: permission loss must not delete a persisted browser source. */
export function mayDeletePersistedBrowserSource(reason: SourceRemovalReason): boolean {
  return reason !== "permission_missing"
}
