/**
 * CLOUD-INTEGRATIONS-001 — security and isolation checks.
 * No real OAuth clients, no real secrets, no network to Google.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertNoTokenLeak,
  decryptCloudTokens,
  encryptCloudTokens,
  generateTestEncryptionKeyBase64,
} from "./integrations/crypto-vault.ts";
import {
  handleOAuthCallback,
  listOwnerConnections,
  startOAuth,
  disconnectConnection,
} from "./integrations/connections.ts";
import {
  isAllowedCallbackUri,
  isCloudIntegrationsPubliclyEnabled,
  parseProviderPathSlug,
  providerPathSlug,
  buildCallbackUri,
} from "./integrations/providers.ts";
import { browseCloudChildren } from "./integrations/browse.ts";
import { googleDriveAdapter, GOOGLE_DRIVE_ROOT_ID } from "./integrations/google-drive-adapter.ts";
import { codeChallengeS256, randomCodeVerifier } from "./integrations/oauth-pkce.ts";
import { googleDriveProvider } from "./integrations/oauth-providers.ts";
import {
  clearCloudIntegrationsStoreForTests,
  getCloudIntegrationsStore,
  resetCloudIntegrationsStoreForTests,
} from "./integrations/store.ts";
import {
  acceptWebhookReceipt,
  enqueueSyncJob,
  processSyncJobPage,
} from "./integrations/sync-jobs.ts";
import { loadConnectionTokens, refreshConnectionTokens } from "./integrations/tokens.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runCloudIntegrationsCheck(): Promise<void> {
  const previous = {
    CLOUD_INTEGRATIONS_ENABLED: process.env.CLOUD_INTEGRATIONS_ENABLED,
    CLOUD_TOKEN_ENCRYPTION_KEY: process.env.CLOUD_TOKEN_ENCRYPTION_KEY,
    CLOUD_GOOGLE_DRIVE_CLIENT_ID: process.env.CLOUD_GOOGLE_DRIVE_CLIENT_ID,
    CLOUD_GOOGLE_DRIVE_CLIENT_SECRET: process.env.CLOUD_GOOGLE_DRIVE_CLIENT_SECRET,
    CLOUD_ONEDRIVE_CLIENT_ID: process.env.CLOUD_ONEDRIVE_CLIENT_ID,
    CLOUD_ONEDRIVE_CLIENT_SECRET: process.env.CLOUD_ONEDRIVE_CLIENT_SECRET,
  };

  process.env.CLOUD_TOKEN_ENCRYPTION_KEY = generateTestEncryptionKeyBase64();
  process.env.CLOUD_GOOGLE_DRIVE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.CLOUD_GOOGLE_DRIVE_CLIENT_SECRET = "test-client-secret-not-real";
  process.env.CLOUD_ONEDRIVE_CLIENT_ID = "test-onedrive-client-id";
  process.env.CLOUD_ONEDRIVE_CLIENT_SECRET = "test-onedrive-client-secret-not-real";
  process.env.CLOUD_INTEGRATIONS_ENABLED = "true";
  resetCloudIntegrationsStoreForTests();

  const originalFetch = globalThis.fetch;
  let tokenExchangeCount = 0;
  let lastTokenBody = "";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      tokenExchangeCount += 1;
      lastTokenBody = typeof init?.body === "string" ? init.body : "";
      if (lastTokenBody.includes("code_verifier=bad")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      if (lastTokenBody.includes("grant_type=refresh_token")) {
        if (lastTokenBody.includes("refresh_token=expired")) {
          return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
        }
        return new Response(
          JSON.stringify({
            access_token: "ya29.test_refreshed_access_token_value",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "openid email https://www.googleapis.com/auth/drive.readonly",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          access_token: "ya29.test_access_token_value_abcdefgh",
          refresh_token: "1//test_refresh_token_value_abcdefgh",
          expires_in: 3600,
          token_type: "Bearer",
          id_token: makeIdToken({
            aud: "test-client-id.apps.googleusercontent.com",
            iss: "https://accounts.google.com",
            sub: "google-sub-1",
            email: "user@example.com",
            nonce: pendingNonce,
          }),
          scope: "openid email https://www.googleapis.com/auth/drive.readonly",
        }),
        { status: 200 },
      );
    }
    if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return new Response(
        JSON.stringify({
          sub: "google-sub-1",
          email: "user@example.com",
          name: "Test User",
        }),
        { status: 200 },
      );
    }
    if (url.includes("www.googleapis.com/drive/v3/files")) {
      const parsed = new URL(url);
      if (!parsed.searchParams.get("pageToken")) {
        return new Response(
          JSON.stringify({
            nextPageToken: "page-2",
            files: [
              { id: "f1", name: "a.pdf", mimeType: "application/pdf", size: "10" },
              { id: "f2", name: "b.pdf", mimeType: "application/pdf", size: "20" },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          files: [{ id: "f3", name: "c.pdf", mimeType: "application/pdf", size: "30" }],
        }),
        { status: 200 },
      );
    }
    if (url.includes("oauth2.googleapis.com/revoke")) {
      return new Response("{}", { status: 200 });
    }
    if (url.includes("login.microsoftonline.com") && url.includes("/token")) {
      tokenExchangeCount += 1;
      lastTokenBody = typeof init?.body === "string" ? init.body : "";
      if (lastTokenBody.includes("code_verifier=bad")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      if (lastTokenBody.includes("grant_type=refresh_token")) {
        return new Response(
          JSON.stringify({
            access_token: "ew0K.test_onedrive_refreshed_access",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "openid email profile offline_access Files.Read User.Read",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          access_token: "ew0K.test_onedrive_access_token_value",
          refresh_token: "M.R3_test_onedrive_refresh_token",
          expires_in: 3600,
          token_type: "Bearer",
          id_token: makeIdToken({
            aud: "test-onedrive-client-id",
            iss: "https://login.microsoftonline.com/common/v2.0",
            sub: "ms-oid-1",
            email: "user@outlook.com",
            nonce: pendingNonce,
          }),
          scope: "openid email profile offline_access Files.Read User.Read",
        }),
        { status: 200 },
      );
    }
    if (url.includes("graph.microsoft.com/v1.0/me") && !url.includes("/drive")) {
      return new Response(
        JSON.stringify({
          id: "ms-oid-1",
          mail: "user@outlook.com",
          displayName: "MS Test User",
          userPrincipalName: "user@outlook.com",
        }),
        { status: 200 },
      );
    }
    if (url.includes("graph.microsoft.com/v1.0/me/drive/root/children")) {
      return new Response(
        JSON.stringify({
          value: [
            { id: "od1", name: "Docs", folder: {}, size: 0 },
            { id: "od2", name: "note.txt", file: {}, size: 12 },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes("graph.microsoft.com/v1.0/me/drive/sharedWithMe")) {
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "share-link",
              name: "Shared folder",
              remoteItem: { id: "od-shared-1", name: "Shared folder", folder: {} },
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response("not mocked", { status: 404 });
  }) as typeof fetch;

  let pendingNonce = "";

  try {
    assert(isCloudIntegrationsPubliclyEnabled({ CLOUD_INTEGRATIONS_ENABLED: "false" }) === false, "flag false");
    assert(isCloudIntegrationsPubliclyEnabled({ CLOUD_INTEGRATIONS_ENABLED: "true" }) === true, "flag true");

    // redirect URI allowlist (hyphen public slug + underscore storage id)
    assert(providerPathSlug("google_drive") === "google-drive", "public slug uses hyphen");
    assert(parseProviderPathSlug("google-drive") === "google_drive", "hyphen parses");
    assert(parseProviderPathSlug("google_drive") === "google_drive", "underscore still parses");
    assert(
      isAllowedCallbackUri("https://suhuella.com/api/integrations/google-drive/callback", "suhuella"),
      "suhuella hyphen callback allowed",
    );
    assert(
      isAllowedCallbackUri("https://suhuella.com/api/integrations/google_drive/callback", "suhuella"),
      "suhuella underscore callback allowed",
    );
    assert(
      !isAllowedCallbackUri("https://evil.example/api/integrations/google-drive/callback", "suhuella"),
      "evil origin rejected",
    );
    assert(
      !isAllowedCallbackUri("https://dbasenet.com/api/integrations/google-drive/callback", "suhuella"),
      "cross-brand callback rejected for suhuella brand",
    );
    assert(
      isAllowedCallbackUri("https://dbasenet.com/api/integrations/google-drive/callback", "dbasenet"),
      "dbasenet callback allowed for dbasenet brand",
    );
    assert(
      buildCallbackUri("https://suhuella.com", "google_drive").endsWith("/api/integrations/google-drive/callback"),
      "callback URI uses hyphen slug",
    );

    process.env.CLOUD_INTEGRATIONS_ENABLED = "false";
    const disabled = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_a",
      origin: "https://suhuella.com",
    });
    assert(disabled.ok === false && disabled.error === "integrations_disabled", "disabled gate");

    process.env.CLOUD_INTEGRATIONS_ENABLED = "true";
    const badRedirect = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_a",
      origin: "https://evil.example",
    });
    assert(badRedirect.ok === false && badRedirect.error === "redirect_uri_not_allowed", "bad origin");

    const started = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_a",
      origin: "https://suhuella.com",
      returnPath: "/home",
    });
    assert(started.ok === true, "start ok");
    if (!started.ok) return;
    assert(started.authorizeUrl.includes("code_challenge="), "PKCE challenge present");
    assert(started.authorizeUrl.includes("state="), "state present");
    assert(!started.authorizeUrl.includes("client_secret"), "no secret in authorize URL");

    const store = await getCloudIntegrationsStore();
    const state = new URL(started.authorizeUrl).searchParams.get("state");
    assert(state, "state extracted");
    const pending = await store.getPending(state!);
    assert(pending, "pending stored");
    pendingNonce = pending!.nonce;

    // invalid state
    const badState = await handleOAuthCallback({
      provider: "google_drive",
      state: "not-a-real-state",
      code: "code",
      error: null,
    });
    assert(badState.ok === false && badState.error === "state_invalid", "invalid state");

    // wrong issuer via id_token (after consuming a fresh start)
    const started2 = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_a",
      origin: "https://suhuella.com",
    });
    assert(started2.ok === true, "second start");
    if (!started2.ok) return;
    const state2 = new URL(started2.authorizeUrl).searchParams.get("state")!;
    const pending2 = await store.getPending(state2);
    pendingNonce = pending2!.nonce;

    const previousIdFactory = makeIdToken;
    // force wrong issuer for next exchange by patching fetch response — override once
    const fetchWithBadIssuer = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token") && !(typeof init?.body === "string" && init.body.includes("grant_type=refresh_token"))) {
        tokenExchangeCount += 1;
        return new Response(
          JSON.stringify({
            access_token: "ya29.test_access_token_value_abcdefgh",
            refresh_token: "1//test_refresh_token_value_abcdefgh",
            expires_in: 3600,
            id_token: previousIdFactory({
              aud: "test-client-id.apps.googleusercontent.com",
              iss: "https://evil-issuer.example",
              sub: "google-sub-1",
              email: "user@example.com",
              nonce: pendingNonce,
            }),
          }),
          { status: 200 },
        );
      }
      return fetchWithBadIssuer(input, init);
    }) as typeof fetch;

    const badIssuer = await handleOAuthCallback({
      provider: "google_drive",
      state: state2,
      code: "auth-code",
      error: null,
    });
    assert(badIssuer.ok === false && badIssuer.error === "issuer_invalid", "issuer rejected");
    globalThis.fetch = fetchWithBadIssuer;

    // successful callback
    const started3 = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_a",
      origin: "https://suhuella.com",
    });
    assert(started3.ok === true, "third start");
    if (!started3.ok) return;
    const state3 = new URL(started3.authorizeUrl).searchParams.get("state")!;
    const pending3 = await store.getPending(state3);
    pendingNonce = pending3!.nonce;
    const okCallback = await handleOAuthCallback({
      provider: "google_drive",
      state: state3,
      code: "auth-code-ok",
      error: null,
    });
    assert(okCallback.ok === true, "callback ok");
    if (!okCallback.ok) return;

    // callback replay
    const replay = await handleOAuthCallback({
      provider: "google_drive",
      state: state3,
      code: "auth-code-ok",
      error: null,
    });
    assert(replay.ok === false && replay.error === "callback_replay", "replay rejected");

    const connections = await listOwnerConnections({
      ownerKind: "device",
      ownerId: "dev_a",
      brandId: "suhuella",
    });
    assert(connections.length === 1, "one connection");
    assert(connections[0]!.accountEmail === "user@example.com", "account email");
    const publicJson = JSON.stringify(connections);
    assert(!publicJson.includes("ya29."), "access token not in public list");
    assert(!publicJson.includes("1//test_refresh"), "refresh token not in public list");
    assertNoTokenLeak(publicJson);

    const tokens = await loadConnectionTokens(okCallback.connectionId);
    assert(tokens?.accessToken.startsWith("ya29."), "server can decrypt");
    const roundTrip = await encryptCloudTokens(tokens!);
    const decrypted = await decryptCloudTokens(roundTrip);
    assert(decrypted.accessToken === tokens!.accessToken, "encrypt round-trip");

    // brand isolation
    const otherBrand = await listOwnerConnections({
      ownerKind: "device",
      ownerId: "dev_a",
      brandId: "dbasenet",
    });
    assert(otherBrand.length === 0, "brand isolation");

    const otherDevice = await listOwnerConnections({
      ownerKind: "device",
      ownerId: "dev_b",
      brandId: "suhuella",
    });
    assert(otherDevice.length === 0, "device isolation");

    // PKCE invalid
    const startedPkce = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_pkce",
      origin: "https://suhuella.com",
    });
    assert(startedPkce.ok === true, "pkce start");
    if (!startedPkce.ok) return;
    const statePkce = new URL(startedPkce.authorizeUrl).searchParams.get("state")!;
    const pendingPkce = await store.getPending(statePkce);
    // corrupt verifier
    await store.putPending({ ...pendingPkce!, codeVerifier: "bad" });
    pendingNonce = pendingPkce!.nonce;
    const pkceFail = await handleOAuthCallback({
      provider: "google_drive",
      state: statePkce,
      code: "code",
      error: null,
    });
    assert(pkceFail.ok === false && pkceFail.error === "pkce_invalid", "pkce invalid");

    // refresh expired
    const connId = okCallback.connectionId;
    await store.putCredential({
      connectionId: connId,
      encryptionVersion: 1,
      ...(await encryptCloudTokens({
        accessToken: "ya29.old",
        refreshToken: "expired",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })),
      keyId: "v1",
      createdAt: new Date().toISOString(),
      rotatedAt: null,
    });
    const refreshed = await refreshConnectionTokens(connId);
    assert(refreshed.ok === false && refreshed.error === "refresh_expired", "refresh expired");

    // restore good tokens for sync + disconnect
    await store.putCredential({
      connectionId: connId,
      encryptionVersion: 1,
      ...(await encryptCloudTokens({
        accessToken: "ya29.test_access_token_value_abcdefgh",
        refreshToken: "1//test_refresh_token_value_abcdefgh",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      })),
      keyId: "v1",
      createdAt: new Date().toISOString(),
      rotatedAt: null,
    });
    const row = await store.getConnection(connId);
    await store.updateConnection({ ...row!, status: "active", lastErrorCode: null, lastErrorMessage: null });

    // browse pagination (one page only)
    const browseRoot = await browseCloudChildren({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_a",
      parentId: GOOGLE_DRIVE_ROOT_ID,
    });
    assert(browseRoot.ok === true, "browse roots ok");
    if (!browseRoot.ok) return;
    assert(browseRoot.page.items.length === 2, "first page size");
    assert(browseRoot.handle.provider === "google_drive", "handle maps provider");
    assert(!JSON.stringify(browseRoot).includes("ya29."), "browse payload has no access token");
    const browsePage2 = await browseCloudChildren({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_a",
      parentId: GOOGLE_DRIVE_ROOT_ID,
      cursor: browseRoot.page.nextCursor,
    });
    assert(browsePage2.ok === true, "browse page 2 ok");
    if (!browsePage2.ok) return;
    assert(browsePage2.page.items.length === 1, "second page size");
    assert(browsePage2.page.nextCursor === null, "no more pages");

    const foreignBrowse = await browseCloudChildren({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_intruder_early",
      parentId: GOOGLE_DRIVE_ROOT_ID,
    });
    assert(foreignBrowse.ok === false && foreignBrowse.error === "forbidden", "browse enforces owner");

    process.env.CLOUD_INTEGRATIONS_ENABLED = "false";
    const flagOffBrowse = await browseCloudChildren({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_a",
    });
    assert(flagOffBrowse.ok === false && flagOffBrowse.error === "integrations_disabled", "flag off blocks browse");
    process.env.CLOUD_INTEGRATIONS_ENABLED = "true";

    const handleMap = googleDriveAdapter.mapToSourceHandle({
      connectionId: connId,
      accountExternalId: "google-sub-1",
      accountDisplayName: "Test User",
      accountEmail: "user@example.com",
    });
    assert(handleMap.rootLabel === "Google Drive", "handle root label is platform name");
    assert(handleMap.connectionId === connId, "handle keeps connection id");

    const browseSections = await browseCloudChildren({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_a",
    });
    assert(browseSections.ok === true, "browse connection root ok");
    if (browseSections.ok) {
      assert(browseSections.page.items.length === 2, "My Drive + Shared with me");
      assert(browseSections.page.items[0]?.name === "My Drive", "My Drive section");
      assert(browseSections.page.items[1]?.name === "Shared with me", "Shared section");
      assert(browseSections.handle.rootLabel === "Google Drive", "browse handle label");
    }

    // resumable sync
    const jobId = await enqueueSyncJob({ connectionId: connId, brandId: "suhuella" });
    const page1 = await processSyncJobPage(jobId);
    assert(page1.status === "queued", "more pages remain");
    assert(page1.progressFiles === 2, "page 1 progress");
    const page2 = await processSyncJobPage(jobId);
    assert(page2.status === "completed", "sync completed");
    assert(page2.progressFiles === 3, "all files counted");

    // webhook duplicate
    const first = await acceptWebhookReceipt({
      receiptId: "wh_1",
      provider: "google_drive",
      connectionId: connId,
    });
    const second = await acceptWebhookReceipt({
      receiptId: "wh_1",
      provider: "google_drive",
      connectionId: connId,
    });
    assert(first.accepted && !first.duplicate, "webhook first");
    assert(!second.accepted && second.duplicate, "webhook duplicate");

    // disconnect
    const gone = await disconnectConnection({
      connectionId: connId,
      ownerKind: "device",
      ownerId: "dev_a",
    });
    assert(gone.ok === true, "disconnect ok");
    assert((await store.getConnection(connId)) === null, "connection deleted");
    assert((await store.getCredential(connId)) === null, "credential deleted");
    assert((await loadConnectionTokens(connId)) === null, "tokens gone");

    // forbidden cross-owner disconnect attempt on a new connection
    const started4 = await startOAuth({
      provider: "google_drive",
      ownerKind: "device",
      ownerId: "dev_owner",
      origin: "https://suhuella.com",
    });
    assert(started4.ok === true, "owner start");
    if (!started4.ok) return;
    const state4 = new URL(started4.authorizeUrl).searchParams.get("state")!;
    pendingNonce = (await store.getPending(state4))!.nonce;
    const ok4 = await handleOAuthCallback({
      provider: "google_drive",
      state: state4,
      code: "code-4",
      error: null,
    });
    assert(ok4.ok === true, "owner callback");
    if (!ok4.ok) return;
    const forbidden = await disconnectConnection({
      connectionId: ok4.connectionId,
      ownerKind: "device",
      ownerId: "dev_intruder",
    });
    assert(forbidden.ok === false && forbidden.error === "forbidden", "cross-device disconnect denied");

    // id_token audience
    try {
      await googleDriveProvider.validateIdToken!({
        idToken: makeIdToken({
          aud: "other-client",
          iss: "https://accounts.google.com",
          sub: "x",
          nonce: "n",
        }),
        clientId: "test-client-id.apps.googleusercontent.com",
        nonce: "n",
      });
      assert(false, "audience should fail");
    } catch (error) {
      assert(error instanceof Error && error.message === "audience_invalid", "audience invalid");
    }

    // PKCE helper
    const verifier = randomCodeVerifier();
    const challenge = await codeChallengeS256(verifier);
    assert(challenge.length > 20, "challenge length");
    assert(buildCallbackUri("https://suhuella.com", "google_drive").endsWith("/callback"), "callback path");

    // route source guards
    const startRoute = readFileSync(
      join(process.cwd(), "app/api/integrations/[provider]/start/route.ts"),
      "utf8",
    );
    assert(startRoute.includes("token_not_accepted"), "start rejects browser tokens");
    const callbackRoute = readFileSync(
      join(process.cwd(), "app/api/integrations/[provider]/callback/route.ts"),
      "utf8",
    );
    assert(callbackRoute.includes("token_not_accepted"), "callback rejects query tokens");
    const migration = readFileSync(join(process.cwd(), "migrations/0006_cloud_integrations.sql"), "utf8");
    assert(migration.includes("cloud_connection"), "migration has connections");
    assert(migration.includes("cloud_credential"), "migration has credentials");
    assert(migration.includes("encryption_version"), "migration versions encryption");
    assert(!migration.includes("DROP TABLE"), "migration does not drop tables");

    const childrenRoute = readFileSync(
      join(process.cwd(), "app/api/sources/[id]/children/route.ts"),
      "utf8",
    );
    assert(childrenRoute.includes("token_not_accepted"), "children rejects query tokens");
    assert(childrenRoute.includes("integrations_disabled"), "children respects flag");
    assert(childrenRoute.includes("browseCloudChildren"), "children uses browse service");

    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "personal checkout is on");
    assert(wrangler.includes('"CLOUD_INTEGRATIONS_ENABLED": "false"'), "cloud integrations stay gated");
    assert(!wrangler.includes("CLOUD_GOOGLE_DRIVE_CLIENT_SECRET"), "no oauth secrets in wrangler");
    assert(!wrangler.includes("CLOUD_ONEDRIVE_CLIENT_SECRET"), "no onedrive secrets in wrangler");

    // OneDrive — connect + connection sections (My files / Shared)
    const msStart = await startOAuth({
      provider: "onedrive",
      ownerKind: "device",
      ownerId: "dev_ms",
      origin: "http://localhost:3000",
      returnPath: "/sources",
    });
    assert(msStart.ok === true, "onedrive start ok");
    if (!msStart.ok) return;
    assert(msStart.authorizeUrl.includes("login.microsoftonline.com"), "ms authorize host");
    assert(msStart.authorizeUrl.includes("code_challenge"), "ms pkce");
    assert(msStart.authorizeUrl.includes("Files.Read"), "ms files scope");
    const msAuth = new URL(msStart.authorizeUrl);
    pendingNonce = msAuth.searchParams.get("nonce") ?? "";
    const msState = msAuth.searchParams.get("state") ?? "";
    const msCallback = await handleOAuthCallback({
      provider: "onedrive",
      state: msState,
      code: "ms-test-code",
      error: null,
    });
    assert(msCallback.ok === true, "onedrive callback ok");
    if (!msCallback.ok) return;
    assert(msCallback.returnPath.startsWith("/sources"), "onedrive returns to sources");
    const msConnId = msCallback.connectionId;
    const msTokens = await loadConnectionTokens(msConnId);
    assert(msTokens?.accessToken.includes("onedrive_access"), "onedrive token stored");
    assert(!JSON.stringify(await listOwnerConnections({ ownerKind: "device", ownerId: "dev_ms" })).includes("ew0K."), "ms public list no token");

    const msSections = await browseCloudChildren({
      connectionId: msConnId,
      ownerKind: "device",
      ownerId: "dev_ms",
    });
    assert(msSections.ok === true, "onedrive sections ok");
    if (msSections.ok) {
      assert(msSections.page.items.length === 2, "My files + Shared");
      assert(msSections.page.items[0]?.name === "My files", "My files section");
      assert(msSections.page.items[1]?.name === "Shared", "Shared section");
      assert(msSections.handle.rootLabel === "OneDrive", "onedrive platform label");
    }
    const msMyFiles = await browseCloudChildren({
      connectionId: msConnId,
      ownerKind: "device",
      ownerId: "dev_ms",
      parentId: "root",
    });
    assert(msMyFiles.ok === true, "onedrive my files ok");
    if (msMyFiles.ok) {
      assert(msMyFiles.page.items.length === 2, "onedrive root children");
      assert(!JSON.stringify(msMyFiles).includes("ew0K."), "onedrive browse no token");
    }

    console.log("CLOUD-INTEGRATIONS-001 check passed");
  } finally {
    globalThis.fetch = originalFetch;
    clearCloudIntegrationsStoreForTests();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function makeIdToken(claims: {
  aud: string;
  iss: string;
  sub: string;
  email?: string;
  nonce: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      ...claims,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

void runCloudIntegrationsCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
