/**
 * Microsoft OneDrive cloud adapter — OAuth + Graph browse.
 * Separate from Gmail/Outlook (Communications — later).
 */

import type {
  CloudAccountProfile,
  CloudAuthorizeInput,
  CloudExchangeInput,
  CloudItem,
  CloudItemPage,
  CloudProviderAdapter,
  CloudRefreshInput,
  CloudSourceHandleMap,
} from "./adapter.ts";
import type { CloudTokenSet } from "./types.ts";
import { getCloudProvider } from "./providers.ts";

export const ONEDRIVE_ROOT_ID = "root";
/** Virtual folder id for OneDrive "Shared". */
export const ONEDRIVE_SHARED_ID = "sharedWithMe";

const FOLDER_FACET = "folder";
const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
const GRAPH_DRIVE = "https://graph.microsoft.com/v1.0/me/drive";

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function expiresAtFromSeconds(seconds: unknown): string | undefined {
  const n = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(Date.now() + n * 1000).toISOString();
}

async function parseTokenJson(response: Response): Promise<CloudTokenSet> {
  if (!response.ok) throw new Error("token_exchange_failed");
  const json = (await response.json()) as Record<string, unknown>;
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) throw new Error("token_exchange_failed");
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    tokenType: typeof json.token_type === "string" ? json.token_type : undefined,
    expiresAt: expiresAtFromSeconds(json.expires_in),
    idToken: typeof json.id_token === "string" ? json.id_token : undefined,
    rawScopes:
      typeof json.scope === "string" ? json.scope.split(/\s+/).filter(Boolean) : undefined,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("id_token_invalid");
  const json = Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
  return JSON.parse(json) as Record<string, unknown>;
}

function mapDriveItem(item: {
  id?: string;
  name?: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: unknown;
  parentReference?: { id?: string };
  remoteItem?: {
    id?: string;
    name?: string;
    size?: number;
    lastModifiedDateTime?: string;
    folder?: unknown;
    file?: unknown;
    parentReference?: { id?: string };
  };
}): CloudItem | null {
  const source = item.remoteItem ?? item;
  const id = typeof source.id === "string" ? source.id : typeof item.id === "string" ? item.id : "";
  const name = typeof source.name === "string" ? source.name : typeof item.name === "string" ? item.name : "";
  if (!id || !name) return null;
  const isFolder = Boolean(source.folder) || (Boolean(item.folder) && !item.file);
  return {
    id,
    name,
    kind: isFolder ? "folder" : "file",
    mimeType: isFolder ? FOLDER_FACET : undefined,
    size: typeof source.size === "number" ? source.size : typeof item.size === "number" ? item.size : null,
    modifiedAt:
      source.lastModifiedDateTime ?? item.lastModifiedDateTime ?? null,
    parentId: source.parentReference?.id ?? item.parentReference?.id ?? null,
  };
}

async function listGraphChildren(
  accessToken: string,
  url: URL,
): Promise<CloudItemPage> {
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("token_expired");
  if (!response.ok) throw new Error("onedrive_list_failed");
  const json = (await response.json()) as {
    value?: Array<Parameters<typeof mapDriveItem>[0]>;
    "@odata.nextLink"?: string;
  };
  const nextLink = json["@odata.nextLink"];
  let nextCursor: string | null = null;
  if (nextLink) {
    try {
      const nextUrl = new URL(nextLink);
      nextCursor = nextUrl.searchParams.get("$skiptoken") ?? nextLink;
    } catch {
      nextCursor = nextLink;
    }
  }
  return {
    items: (json.value ?? []).map(mapDriveItem).filter((item): item is CloudItem => item !== null),
    nextCursor,
  };
}

function childrenUrl(parentId: string, cursor: string | null): URL {
  let url: URL;
  if (parentId === ONEDRIVE_ROOT_ID) {
    url = new URL(`${GRAPH_DRIVE}/root/children`);
  } else if (parentId === ONEDRIVE_SHARED_ID) {
    url = new URL(`${GRAPH_DRIVE}/sharedWithMe`);
  } else {
    url = new URL(`${GRAPH_DRIVE}/items/${encodeURIComponent(parentId)}/children`);
  }
  url.searchParams.set("$top", "50");
  url.searchParams.set(
    "$select",
    "id,name,size,lastModifiedDateTime,folder,file,parentReference,remoteItem",
  );
  if (cursor) {
    if (cursor.startsWith("http")) {
      return new URL(cursor);
    }
    url.searchParams.set("$skiptoken", cursor);
  }
  return url;
}

export const oneDriveAdapter: CloudProviderAdapter = {
  id: "onedrive",

  authorize(input: CloudAuthorizeInput): string {
    const url = new URL(getCloudProvider("onedrive")!.authorizationUrl);
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", input.scopes.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "consent");
    if (input.nonce) url.searchParams.set("nonce", input.nonce);
    return url.toString();
  },

  async exchangeCode(input: CloudExchangeInput): Promise<CloudTokenSet> {
    const def = getCloudProvider("onedrive")!;
    const response = await fetch(def.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
        code_verifier: input.codeVerifier,
      }),
      cache: "no-store",
    });
    return parseTokenJson(response);
  },

  async refresh(input: CloudRefreshInput): Promise<CloudTokenSet> {
    const def = getCloudProvider("onedrive")!;
    const response = await fetch(def.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        refresh_token: input.refreshToken,
        grant_type: "refresh_token",
        scope: def.scopes.join(" "),
      }),
      cache: "no-store",
    });
    if (response.status === 400 || response.status === 401) {
      throw new Error("refresh_expired");
    }
    const tokens = await parseTokenJson(response);
    return { ...tokens, refreshToken: tokens.refreshToken ?? input.refreshToken };
  },

  async revoke(_accessToken: string): Promise<void> {
    // Microsoft has no Google-style token revoke for SPA/web clients; disconnect deletes vault.
  },

  async fetchAccount(accessToken: string): Promise<CloudAccountProfile> {
    const response = await fetch(GRAPH_ME, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("userinfo_failed");
    const json = (await response.json()) as Record<string, unknown>;
    const id = typeof json.id === "string" ? json.id : "";
    if (!id) throw new Error("userinfo_failed");
    const mail =
      (typeof json.mail === "string" && json.mail) ||
      (typeof json.userPrincipalName === "string" && json.userPrincipalName) ||
      null;
    return {
      externalId: id,
      email: mail,
      displayName: typeof json.displayName === "string" ? json.displayName : null,
    };
  },

  async listRoots(accessToken: string, cursor: string | null = null): Promise<CloudItemPage> {
    return listGraphChildren(accessToken, childrenUrl(ONEDRIVE_ROOT_ID, cursor));
  },

  async listChildren(
    accessToken: string,
    parentId: string,
    cursor: string | null,
  ): Promise<CloudItemPage> {
    return listGraphChildren(accessToken, childrenUrl(parentId, cursor));
  },

  async getItem(accessToken: string, itemId: string): Promise<CloudItem | null> {
    if (itemId === ONEDRIVE_ROOT_ID) {
      return {
        id: ONEDRIVE_ROOT_ID,
        name: "My files",
        kind: "folder",
        mimeType: FOLDER_FACET,
        size: null,
        modifiedAt: null,
        parentId: null,
      };
    }
    if (itemId === ONEDRIVE_SHARED_ID) {
      return {
        id: ONEDRIVE_SHARED_ID,
        name: "Shared",
        kind: "folder",
        mimeType: FOLDER_FACET,
        size: null,
        modifiedAt: null,
        parentId: null,
      };
    }
    const url = new URL(`${GRAPH_DRIVE}/items/${encodeURIComponent(itemId)}`);
    url.searchParams.set(
      "$select",
      "id,name,size,lastModifiedDateTime,folder,file,parentReference",
    );
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 401) throw new Error("token_expired");
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("onedrive_get_failed");
    return mapDriveItem((await response.json()) as Parameters<typeof mapDriveItem>[0]);
  },

  mapToSourceHandle(input): CloudSourceHandleMap {
    return {
      provider: "onedrive",
      connectionId: input.connectionId,
      accountExternalId: input.accountExternalId,
      rootLabel: "OneDrive",
    };
  },

  async validateIdToken(input) {
    const payload = decodeJwtPayload(input.idToken);
    const iss = typeof payload.iss === "string" ? payload.iss : "";
    const aud = typeof payload.aud === "string" ? payload.aud : "";
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const issOk =
      iss.startsWith("https://login.microsoftonline.com/") ||
      iss.startsWith("https://sts.windows.net/");
    if (!issOk) throw new Error("issuer_invalid");
    if (aud !== input.clientId) throw new Error("audience_invalid");
    if (!sub) throw new Error("id_token_invalid");
    if (input.nonce && nonce && nonce !== input.nonce) throw new Error("nonce_invalid");
    if (exp * 1000 < Date.now()) throw new Error("id_token_expired");
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      aud,
      iss,
    };
  },
};

export function oneDriveConnectionSections(): CloudItem[] {
  return [
    {
      id: ONEDRIVE_ROOT_ID,
      name: "My files",
      kind: "folder",
      mimeType: FOLDER_FACET,
      size: null,
      modifiedAt: null,
      parentId: null,
    },
    {
      id: ONEDRIVE_SHARED_ID,
      name: "Shared",
      kind: "folder",
      mimeType: FOLDER_FACET,
      size: null,
      modifiedAt: null,
      parentId: null,
    },
  ];
}
