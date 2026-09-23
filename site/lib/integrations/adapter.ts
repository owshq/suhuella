/**
 * Provider-neutral cloud adapter contract.
 * Infrastructure only — never leaks into public Source identity.
 */

import type { CloudProviderId, CloudTokenSet } from "./types.ts";

export type CloudAuthorizeInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
  scopes: readonly string[];
};

export type CloudExchangeInput = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
};

export type CloudRefreshInput = {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
};

export type CloudAccountProfile = {
  externalId: string;
  email: string | null;
  displayName: string | null;
};

export type CloudItemKind = "folder" | "file";

export type CloudItem = {
  id: string;
  name: string;
  kind: CloudItemKind;
  mimeType?: string;
  size?: number | null;
  modifiedAt?: string | null;
  parentId?: string | null;
};

export type CloudItemPage = {
  items: CloudItem[];
  nextCursor: string | null;
};

/** Opaque handle metadata kept on the adapter / registry — not on Source. */
export type CloudSourceHandleMap = {
  provider: CloudProviderId;
  connectionId: string;
  accountExternalId: string | null;
  rootLabel: string;
};

export interface CloudProviderAdapter {
  readonly id: CloudProviderId;
  authorize(input: CloudAuthorizeInput): string;
  exchangeCode(input: CloudExchangeInput): Promise<CloudTokenSet>;
  refresh(input: CloudRefreshInput): Promise<CloudTokenSet>;
  revoke(accessToken: string): Promise<void>;
  fetchAccount(accessToken: string): Promise<CloudAccountProfile>;
  listRoots(accessToken: string, cursor?: string | null): Promise<CloudItemPage>;
  listChildren(accessToken: string, parentId: string, cursor: string | null): Promise<CloudItemPage>;
  getItem(accessToken: string, itemId: string): Promise<CloudItem | null>;
  mapToSourceHandle(input: {
    connectionId: string;
    accountExternalId: string | null;
    accountDisplayName: string | null;
    accountEmail: string | null;
  }): CloudSourceHandleMap;
  validateIdToken?(input: {
    idToken: string;
    clientId: string;
    nonce: string;
  }): Promise<{ sub: string; email?: string; aud: string; iss: string }>;
}
