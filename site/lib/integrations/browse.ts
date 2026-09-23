/**
 * One-page cloud browse. Never walks an entire Drive in a single HTTP request.
 */

import { brand } from "@suhuella/brand";
import type { CloudItem, CloudItemPage } from "./adapter.ts";
import {
  GOOGLE_DRIVE_ROOT_ID,
  GOOGLE_DRIVE_SHARED_ID,
  getCloudProviderAdapter,
  googleDriveConnectionSections,
} from "./google-drive-adapter.ts";
import {
  ONEDRIVE_ROOT_ID,
  ONEDRIVE_SHARED_ID,
  oneDriveConnectionSections,
} from "./onedrive-adapter.ts";
import { isCloudIntegrationsPubliclyEnabled } from "./providers.ts";
import { getCloudIntegrationsStore } from "./store.ts";
import { loadConnectionTokens, refreshConnectionTokens } from "./tokens.ts";
import { timingSafeEqualString } from "./oauth-pkce.ts";
import type { CloudOwnerKind, CloudProviderId } from "./types.ts";

export type CloudBrowseResult =
  | {
      ok: true;
      connectionId: string;
      provider: CloudProviderId;
      parentId: string;
      parentName: string;
      parentOfParentId: string | null;
      handle: {
        provider: CloudProviderId;
        connectionId: string;
        accountExternalId: string | null;
        rootLabel: string;
      };
      page: CloudItemPage;
    }
  | { ok: false; error: string };

const SECTION_ROOT_IDS = new Set([
  GOOGLE_DRIVE_ROOT_ID,
  GOOGLE_DRIVE_SHARED_ID,
  ONEDRIVE_ROOT_ID,
  ONEDRIVE_SHARED_ID,
]);

function connectionSectionsFor(provider: CloudProviderId): CloudItem[] {
  if (provider === "google_drive") return googleDriveConnectionSections();
  if (provider === "onedrive") return oneDriveConnectionSections();
  return [];
}

async function accessTokenForConnection(connectionId: string): Promise<
  | { ok: true; accessToken: string }
  | { ok: false; error: string }
> {
  let tokens = await loadConnectionTokens(connectionId);
  if (!tokens) return { ok: false, error: "credentials_missing" };
  if (tokens.expiresAt && Date.parse(tokens.expiresAt) < Date.now() + 60_000) {
    const refreshed = await refreshConnectionTokens(connectionId);
    if (!refreshed.ok) return { ok: false, error: refreshed.error };
    tokens = refreshed.tokens;
  }
  return { ok: true, accessToken: tokens.accessToken };
}

export async function browseCloudChildren(input: {
  connectionId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  brandId?: string;
  parentId?: string | null;
  cursor?: string | null;
}): Promise<CloudBrowseResult> {
  if (!isCloudIntegrationsPubliclyEnabled()) {
    return { ok: false, error: "integrations_disabled" };
  }
  if (!input.ownerId.trim()) return { ok: false, error: "owner_required" };

  const brandId = input.brandId ?? brand.id;
  const store = await getCloudIntegrationsStore();
  const row = await store.getConnection(input.connectionId);
  if (!row || row.status === "disconnected") return { ok: false, error: "not_found" };
  if (
    row.brandId !== brandId ||
    row.ownerKind !== input.ownerKind ||
    !timingSafeEqualString(row.ownerId, input.ownerId)
  ) {
    return { ok: false, error: "forbidden" };
  }
  if (row.status === "needs_reauth") {
    return { ok: false, error: "needs_reauth" };
  }

  const token = await accessTokenForConnection(row.id);
  if (!token.ok) return token;

  const adapter = getCloudProviderAdapter(row.provider);
  const rawParent = input.parentId?.trim() || "";
  const cursor = input.cursor?.trim() || null;
  const atConnectionRoot = !rawParent;

  try {
    const handle = adapter.mapToSourceHandle({
      connectionId: row.id,
      accountExternalId: row.accountExternalId,
      accountDisplayName: row.accountDisplayName,
      accountEmail: row.accountEmail,
    });

    if (atConnectionRoot) {
      const sections = connectionSectionsFor(row.provider);
      if (sections.length > 0) {
        if (cursor) {
          return {
            ok: true,
            connectionId: row.id,
            provider: row.provider,
            parentId: "",
            parentName: handle.rootLabel,
            parentOfParentId: null,
            handle,
            page: { items: [], nextCursor: null },
          };
        }
        return {
          ok: true,
          connectionId: row.id,
          provider: row.provider,
          parentId: "",
          parentName: handle.rootLabel,
          parentOfParentId: null,
          handle,
          page: { items: sections, nextCursor: null },
        };
      }
      // Providers without virtual sections: listRoots directly.
      const page = await adapter.listRoots(token.accessToken, cursor);
      return {
        ok: true,
        connectionId: row.id,
        provider: row.provider,
        parentId: "",
        parentName: handle.rootLabel,
        parentOfParentId: null,
        handle,
        page,
      };
    }

    const page = await adapter.listChildren(token.accessToken, rawParent, cursor);
    const parentItem = await adapter.getItem(token.accessToken, rawParent);
    let parentOfParentId: string | null = null;
    if (SECTION_ROOT_IDS.has(rawParent)) {
      parentOfParentId = null;
    } else {
      parentOfParentId =
        parentItem?.parentId ??
        (row.provider === "onedrive" ? ONEDRIVE_ROOT_ID : GOOGLE_DRIVE_ROOT_ID);
    }

    return {
      ok: true,
      connectionId: row.id,
      provider: row.provider,
      parentId: rawParent,
      parentName: parentItem?.name ?? handle.rootLabel,
      parentOfParentId,
      handle,
      page,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "browse_failed";
    if (message === "token_expired" || message === "refresh_expired") {
      return { ok: false, error: "needs_reauth" };
    }
    return { ok: false, error: message };
  }
}
