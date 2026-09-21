import { brand } from "@suhuella/brand";
import type { CloudBrandIntegrationConfig, CloudProviderDefinition, CloudProviderId } from "./types.ts";

/** Registry of cloud OAuth providers. Not Cloudflare Access IdPs. Not Stripe. */
const PROVIDERS: Record<CloudProviderId, CloudProviderDefinition> = {
  google_drive: {
    provider: "google_drive",
    displayName: "Google Drive",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    supportsWebhooks: true,
    brandAllowlist: ["suhuella"],
    enabled: true,
  },
  dropbox: {
    provider: "dropbox",
    displayName: "Dropbox",
    authorizationUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scopes: [],
    supportsWebhooks: true,
    brandAllowlist: ["suhuella"],
    enabled: false,
  },
  onedrive: {
    provider: "onedrive",
    displayName: "OneDrive",
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "Files.Read", "User.Read"],
    supportsWebhooks: true,
    brandAllowlist: ["suhuella"],
    enabled: false,
  },
  box: {
    provider: "box",
    displayName: "Box",
    authorizationUrl: "https://account.box.com/api/oauth2/authorize",
    tokenUrl: "https://api.box.com/oauth2/token",
    scopes: ["root_readonly"],
    supportsWebhooks: true,
    brandAllowlist: ["suhuella"],
    enabled: false,
  },
};

const BRAND_CONFIGS: Record<string, CloudBrandIntegrationConfig> = {
  suhuella: {
    brandId: "suhuella",
    displayName: "SuHuella",
    primaryDomain: "suhuella.com",
    callbackOrigins: [
      "https://suhuella.com",
      "https://www.suhuella.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  },
  dbasenet: {
    brandId: "dbasenet",
    displayName: "Dbasenet",
    primaryDomain: "dbasenet.com",
    callbackOrigins: [
      "https://dbasenet.com",
      "https://www.dbasenet.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  },
};

export function listCloudProviders(): CloudProviderDefinition[] {
  return Object.values(PROVIDERS);
}

export function getCloudProvider(provider: string): CloudProviderDefinition | null {
  if (provider in PROVIDERS) return PROVIDERS[provider as CloudProviderId];
  return null;
}

export function isCloudProviderId(value: string): value is CloudProviderId {
  return value in PROVIDERS;
}

export function currentBrandIntegrationConfig(): CloudBrandIntegrationConfig {
  const id = brand.id;
  return BRAND_CONFIGS[id] ?? {
    brandId: id,
    displayName: brand.displayName,
    primaryDomain: brand.primaryDomain,
    callbackOrigins: [`https://${brand.primaryDomain}`, "http://localhost:3000"],
  };
}

export function brandAllowsProvider(brandId: string, provider: CloudProviderId): boolean {
  const def = PROVIDERS[provider];
  return def.brandAllowlist.includes(brandId);
}

export function providerEnabledForBrand(provider: CloudProviderId, brandId: string): boolean {
  const def = PROVIDERS[provider];
  if (!def.enabled) return false;
  return brandAllowsProvider(brandId, provider);
}

/** Exact callback path for a provider. Origin must still pass the allowlist. */
export function callbackPathForProvider(provider: CloudProviderId): string {
  return `/api/integrations/${provider}/callback`;
}

export function buildCallbackUri(origin: string, provider: CloudProviderId): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${callbackPathForProvider(provider)}`;
}

export function isAllowedCallbackUri(uri: string, brandId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    return false;
  }
  const config = BRAND_CONFIGS[brandId];
  if (!config) return false;
  const origin = `${parsed.protocol}//${parsed.host}`;
  if (!config.callbackOrigins.includes(origin)) return false;
  const providerMatch = parsed.pathname.match(/^\/api\/integrations\/([a-z_]+)\/callback$/);
  if (!providerMatch) return false;
  return isCloudProviderId(providerMatch[1]);
}

/** Env gate for public start endpoints. Missing/false keeps production closed. */
export function isCloudIntegrationsPubliclyEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CLOUD_INTEGRATIONS_ENABLED === "true";
}
