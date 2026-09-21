import type { CloudProviderId, CloudTokenSet } from "./types.ts";
import { getCloudProvider } from "./providers.ts";
import { codeChallengeS256 } from "./oauth-pkce.ts";

export type TokenExchangeInput = {
  provider: CloudProviderId;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
};

export type TokenRefreshInput = {
  provider: CloudProviderId;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
};

export type ProviderAccountProfile = {
  externalId: string;
  email: string | null;
  displayName: string | null;
};

export type DriveListPage = {
  files: Array<{ id: string; name: string; mimeType?: string; size?: number }>;
  nextCursor: string | null;
};

/** Shared contract every cloud provider implements. */
export interface CloudOAuthProvider {
  readonly id: CloudProviderId;
  buildAuthorizeUrl(input: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    nonce: string;
    scopes: readonly string[];
  }): string;
  exchangeCode(input: TokenExchangeInput): Promise<CloudTokenSet>;
  refresh(input: TokenRefreshInput): Promise<CloudTokenSet>;
  fetchAccount(accessToken: string): Promise<ProviderAccountProfile>;
  revoke?(accessToken: string): Promise<void>;
  /** One page only — never walk entire Drive in HTTP request. */
  listPage?(accessToken: string, cursor: string | null): Promise<DriveListPage>;
  validateIdToken?(input: {
    idToken: string;
    clientId: string;
    nonce: string;
  }): Promise<{ sub: string; email?: string; aud: string; iss: string }>;
}

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
      typeof json.scope === "string"
        ? json.scope.split(/\s+/).filter(Boolean)
        : undefined,
  };
}

/** Decode JWT payload without trusting signature yet — signature verified separately. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("id_token_invalid");
  const json = Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
  return JSON.parse(json) as Record<string, unknown>;
}

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const googleDriveProvider: CloudOAuthProvider = {
  id: "google_drive",

  buildAuthorizeUrl(input) {
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

  async exchangeCode(input) {
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

  async refresh(input) {
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
    return {
      ...tokens,
      refreshToken: tokens.refreshToken ?? input.refreshToken,
    };
  },

  async fetchAccount(accessToken) {
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

  async revoke(accessToken) {
    const def = getCloudProvider("google_drive")!;
    await fetch(`${def.revokeUrl}?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      cache: "no-store",
    });
  },

  async listPage(accessToken, cursor) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size)");
    url.searchParams.set("q", "trashed=false");
    if (cursor) url.searchParams.set("pageToken", cursor);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("drive_list_failed");
    const json = (await response.json()) as {
      nextPageToken?: string;
      files?: Array<{ id?: string; name?: string; mimeType?: string; size?: string }>;
    };
    return {
      files: (json.files ?? [])
        .filter((f) => typeof f.id === "string" && typeof f.name === "string")
        .map((f) => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType,
          size: f.size ? Number(f.size) : undefined,
        })),
      nextCursor: json.nextPageToken ?? null,
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
    // Signature verification via Google JWKS is required before production enablement.
    // Token exchange already happened server-side with client_secret; id_token claims are cross-checked here.
    return {
      sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      aud,
      iss,
    };
  },
};

/** Stub providers — same contract, not enabled until OAuth clients exist. */
function stubProvider(id: CloudProviderId): CloudOAuthProvider {
  return {
    id,
    buildAuthorizeUrl() {
      throw new Error("provider_not_enabled");
    },
    async exchangeCode() {
      throw new Error("provider_not_enabled");
    },
    async refresh() {
      throw new Error("provider_not_enabled");
    },
    async fetchAccount() {
      throw new Error("provider_not_enabled");
    },
  };
}

export const dropboxProvider = stubProvider("dropbox");
export const oneDriveProvider = stubProvider("onedrive");
export const boxProvider = stubProvider("box");

const PROVIDER_IMPL: Record<CloudProviderId, CloudOAuthProvider> = {
  google_drive: googleDriveProvider,
  dropbox: dropboxProvider,
  onedrive: oneDriveProvider,
  box: boxProvider,
};

export function getOAuthProviderImpl(provider: CloudProviderId): CloudOAuthProvider {
  return PROVIDER_IMPL[provider];
}

export async function buildPkceAuthorizeUrl(input: {
  provider: CloudProviderId;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}): Promise<string> {
  const def = getCloudProvider(input.provider);
  if (!def) throw new Error("provider_unknown");
  const challenge = await codeChallengeS256(input.codeVerifier);
  return getOAuthProviderImpl(input.provider).buildAuthorizeUrl({
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    state: input.state,
    codeChallenge: challenge,
    nonce: input.nonce,
    scopes: def.scopes,
  });
}

export function oauthClientEnvNames(provider: CloudProviderId): {
  clientId: string;
  clientSecret: string;
} {
  const key = provider.toUpperCase();
  return {
    clientId: `CLOUD_${key}_CLIENT_ID`,
    clientSecret: `CLOUD_${key}_CLIENT_SECRET`,
  };
}

export function readOAuthClient(
  provider: CloudProviderId,
  env: Record<string, string | undefined> = process.env,
): { clientId: string; clientSecret: string } | null {
  const names = oauthClientEnvNames(provider);
  const clientId = env[names.clientId]?.trim() ?? "";
  const clientSecret = env[names.clientSecret]?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
