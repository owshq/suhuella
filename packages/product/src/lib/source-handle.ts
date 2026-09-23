/**
 * Source handle — current access.
 *
 * Replaceable. The concrete grant (filesystem handle, token, provider session)
 * stays in the adapter. This type never names a product platform.
 *
 * Replacing a Handle does not replace the Source.
 */

import { type Source, type SourceId } from "./source-identity.ts";

export type SourcePermissionState = "granted" | "denied" | "unknown";

/** Domain Handle contract version. Bump only with an ADR. */
export const SOURCE_HANDLE_DOMAIN_CONTRACT_VERSION = 1 as const;

export type SourceHandleContractVersion = typeof SOURCE_HANDLE_DOMAIN_CONTRACT_VERSION;

export type SourceHandle = {
  readonly sourceId: SourceId;
  permission: SourcePermissionState;
  /**
   * Which adapter currently owns the grant.
   * An open string. Adapters choose it. The domain does not enumerate them.
   */
  readonly adapterId: string;
  /** Domain Handle shape version. Adapters must write the current version. */
  readonly contractVersion: SourceHandleContractVersion;
};

/** Keep sourceId. Swap permission, adapter, and optional contract version. */
export function replaceSourceHandle(
  current: SourceHandle,
  next: {
    permission: SourcePermissionState;
    adapterId: string;
    contractVersion?: SourceHandleContractVersion;
  },
): SourceHandle {
  return {
    sourceId: current.sourceId,
    permission: next.permission,
    adapterId: next.adapterId,
    contractVersion: next.contractVersion ?? current.contractVersion,
  };
}

/** A Handle may bind only to its own Source. */
export function bindSourceHandle(source: Source, handle: SourceHandle): SourceHandle {
  if (handle.sourceId !== source.id) {
    throw new Error("Handle sourceId must match Source id. Replacing access does not create a Source.");
  }
  return handle;
}
