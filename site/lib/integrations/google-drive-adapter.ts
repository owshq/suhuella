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
import { oneDriveAdapter } from "./onedrive-adapter.ts";

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

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const GOOGLE_DRIVE_ROOT_ID = "root";
/** Virtual folder id for Drive "Shared with me". */
export const GOOGLE_DRIVE_SHARED_ID = "sharedWithMe";

function mapDriveFile(file: {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}): CloudItem | null {
  if (typeof file.id !== "string" || typeof file.name !== "string") return null;
  return {
    id: file.id,
    name: file.name,
    kind: file.mimeType === FOLDER_MIME ? "folder" : "file",
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : null,
    modifiedAt: file.modifiedTime ?? null,
    parentId: file.parents?.[0] ?? null,
  };
}

async function listDrivePage(
  accessToken: string,
  query: string,
  cursor: string | null,
): Promise<CloudItemPage> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set(
    "fields",
    "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("orderBy", "folder,name_natural");
  if (cursor) url.searchParams.set("pageToken", cursor);
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("token_expired");
  if (!response.ok) throw new Error("drive_list_failed");
  const json = (await response.json()) as {
    nextPageToken?: string;
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
      modifiedTime?: string;
      parents?: string[];
    }>;
  };
  return {
    items: (json.files ?? []).map(mapDriveFile).filter((item): item is CloudItem => item !== null),
    nextCursor: json.nextPageToken ?? null,
  };
}

export const googleDriveAdapter: CloudProviderAdapter = {
  id: "google_drive",

  authorize(input: CloudAuthorizeInput): string {
    const url = new URL(getCloudProvider("google_drive")!.authorizationUrl);
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", input.scopes.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("nonce", input.nonce);
    return url.toString();
  },

  async exchangeCode(input: CloudExchangeInput): Promise<CloudTokenSet> {
    const def = getCloudProvider("google_drive")!;
    const response = await fetch(def.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
        code_verifier: input.codeVerifier,
      }),
      cache: "no-store",
    });
    return parseTokenJson(response);
  },

  async refresh(input: CloudRefreshInput): Promise<CloudTokenSet> {
    const def = getCloudProvider("google_drive")!;
    const response = await fetch(def.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        refresh_token: input.refreshToken,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    if (response.status === 400 || response.status === 401) {
      throw new Error("refresh_expired");
    }
    const tokens = await parseTokenJson(response);
    return { ...tokens, refreshToken: tokens.refreshToken ?? input.refreshToken };
  },

  async revoke(accessToken: string): Promise<void> {
    const def = getCloudProvider("google_drive")!;
    await fetch(`${def.revokeUrl}?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      cache: "no-store",
    });
  },

  async fetchAccount(accessToken: string): Promise<CloudAccountProfile> {
    const def = getCloudProvider("google_drive")!;
    const response = await fetch(def.userinfoUrl!, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("userinfo_failed");
    const json = (await response.json()) as Record<string, unknown>;
    const sub = typeof json.sub === "string" ? json.sub : "";
    if (!sub) throw new Error("userinfo_failed");
    return {
      externalId: sub,
      email: typeof json.email === "string" ? json.email : null,
      displayName: typeof json.name === "string" ? json.name : null,
    };
  },

  async listRoots(accessToken: string, cursor: string | null = null): Promise<CloudItemPage> {
    // Sync + My Drive folder listing (children of Drive root).
    return listDrivePage(accessToken, `'${GOOGLE_DRIVE_ROOT_ID}' in parents and trashed=false`, cursor);
  },

  async listChildren(
    accessToken: string,
    parentId: string,
    cursor: string | null,
  ): Promise<CloudItemPage> {
    if (parentId === GOOGLE_DRIVE_ROOT_ID) {
      return this.listRoots(accessToken, cursor);
    }
    if (parentId === GOOGLE_DRIVE_SHARED_ID) {
      return listDrivePage(accessToken, "sharedWithMe=true and trashed=false", cursor);
    }
    const safeParent = parentId.replace(/'/g, "\\'");
    return listDrivePage(accessToken, `'${safeParent}' in parents and trashed=false`, cursor);
  },

  async getItem(accessToken: string, itemId: string): Promise<CloudItem | null> {
    if (itemId === GOOGLE_DRIVE_ROOT_ID) {
      return {
        id: GOOGLE_DRIVE_ROOT_ID,
        name: "My Drive",
        kind: "folder",
        mimeType: FOLDER_MIME,
        size: null,
        modifiedAt: null,
        parentId: null,
      };
    }
    if (itemId === GOOGLE_DRIVE_SHARED_ID) {
      return {
        id: GOOGLE_DRIVE_SHARED_ID,
        name: "Shared with me",
        kind: "folder",
        mimeType: FOLDER_MIME,
        size: null,
        modifiedAt: null,
        parentId: null,
      };
    }
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(itemId)}`);
    url.searchParams.set("fields", "id,name,mimeType,size,modifiedTime,parents");
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 401) throw new Error("token_expired");
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("drive_get_failed");
    const json = (await response.json()) as {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
      modifiedTime?: string;
      parents?: string[];
    };
    return mapDriveFile(json);
  },

  mapToSourceHandle(input): CloudSourceHandleMap {
    return {
      provider: "google_drive",
      connectionId: input.connectionId,
      accountExternalId: input.accountExternalId,
      // Platform name on Source; account email stays on the connection row / UI details.
      rootLabel: "Google Drive",
    };
  },

  async validateIdToken(input) {
    const payload = decodeJwtPayload(input.idToken);
    const iss = typeof payload.iss === "string" ? payload.iss : "";
    const aud = typeof payload.aud === "string" ? payload.aud : "";
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (!GOOGLE_ISSUERS.has(iss)) throw new Error("issuer_invalid");
    if (aud !== input.clientId) throw new Error("audience_invalid");
    if (!sub) throw new Error("id_token_invalid");
    if (nonce !== input.nonce) throw new Error("nonce_invalid");
    if (exp * 1000 < Date.now()) throw new Error("id_token_expired");
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      aud,
      iss,
    };
  },
};

function stubAdapter(id: CloudProviderAdapter["id"]): CloudProviderAdapter {
  const fail = async (): Promise<never> => {
    throw new Error("provider_not_enabled");
  };
  return {
    id,
    authorize() {
      throw new Error("provider_not_enabled");
    },
    exchangeCode: fail,
    refresh: fail,
    revoke: fail,
    fetchAccount: fail,
    listRoots: fail,
    listChildren: fail,
    getItem: fail,
    mapToSourceHandle(input) {
      return {
        provider: id,
        connectionId: input.connectionId,
        accountExternalId: input.accountExternalId,
        rootLabel: id === "dropbox" ? "Dropbox" : id === "onedrive" ? "OneDrive" : id === "box" ? "Box" : id,
      };
    },
  };
}

export const dropboxAdapter = stubAdapter("dropbox");
export const boxAdapter = stubAdapter("box");

const ADAPTERS: Record<CloudProviderAdapter["id"], CloudProviderAdapter> = {
  google_drive: googleDriveAdapter,
  dropbox: dropboxAdapter,
  onedrive: oneDriveAdapter,
  box: boxAdapter,
};

export function getCloudProviderAdapter(provider: CloudProviderAdapter["id"]): CloudProviderAdapter {
  return ADAPTERS[provider];
}

export function googleDriveConnectionSections(): CloudItem[] {
  return [
    {
      id: GOOGLE_DRIVE_ROOT_ID,
      name: "My Drive",
      kind: "folder",
      mimeType: FOLDER_MIME,
      size: null,
      modifiedAt: null,
      parentId: null,
    },
    {
      id: GOOGLE_DRIVE_SHARED_ID,
      name: "Shared with me",
      kind: "folder",
      mimeType: FOLDER_MIME,
      size: null,
      modifiedAt: null,
      parentId: null,
    },
  ];
}

export { oneDriveAdapter };
