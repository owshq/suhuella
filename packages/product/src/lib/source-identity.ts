/**
 * Source identity.
 *
 * The id is immutable. Rename, reconnect and relocate keep it.
 * Only Remove destroys it.
 *
 * This module does not know Handle, Health, Lifecycle, or UI.
 */

/** Opaque id. Never derived from a path, grant, or provider. */
export type SourceId = string & { readonly __sourceId: unique symbol };

export function sourceId(value: string): SourceId {
  return value as SourceId;
}

export type Source = {
  readonly id: SourceId;
  /** Label only. Changing it does not mint a new Source. */
  displayName: string;
};

export function renameSource(source: Source, displayName: string): Source {
  return { id: source.id, displayName };
}

export function sameSourceId(left: SourceId, right: SourceId): boolean {
  return left === right;
}
