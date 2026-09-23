/**
 * Back-compat facade over CloudProviderAdapter.
 * New code should import from google-drive-adapter / adapter.
 */

import { codeChallengeS256 } from "./oauth-pkce.ts";
import { getCloudProvider } from "./providers.ts";
import { getCloudProviderAdapter } from "./google-drive-adapter.ts";
import type { CloudProviderId, CloudTokenSet } from "./types.ts";
import type { CloudAccountProfile } from "./adapter.ts";

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

export type ProviderAccountProfile = CloudAccountProfile;

export type DriveListPage = {
  files: Array<{ id: string; name: string; mimeType?: string; size?: number }>;
  nextCursor: string | null;
};

export type CloudOAuthProvider = {
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
  listPage?(accessToken: string, cursor: string | null): Promise<DriveListPage>;
  validateIdToken?(input: {
    idToken: string;
    clientId: string;
    nonce: string;
  }): Promise<{ sub: string; email?: string; aud: string; iss: string }>;
};

function wrap(provider: CloudProviderId): CloudOAuthProvider {
  const adapter = getCloudProviderAdapter(provider);
  return {
    id: provider,
    buildAuthorizeUrl(input) {
      return adapter.authorize(input);
    },
    exchangeCode(input) {
      return adapter.exchangeCode(input);
    },
    refresh(input) {
      return adapter.refresh(input);
    },
    fetchAccount(accessToken) {
      return adapter.fetchAccount(accessToken);
    },
    async revoke(accessToken) {
      await adapter.revoke(accessToken);
    },
    async listPage(accessToken, cursor) {
      const page = await adapter.listRoots(accessToken, cursor);
      return {
        files: page.items.map((item) => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size ?? undefined,
        })),
        nextCursor: page.nextCursor,
      };
    },
    validateIdToken: adapter.validateIdToken
      ? (input) => adapter.validateIdToken!(input)
      : undefined,
  };
}

export const googleDriveProvider = wrap("google_drive");
export const dropboxProvider = wrap("dropbox");
export const oneDriveProvider = wrap("onedrive");
export const boxProvider = wrap("box");

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
