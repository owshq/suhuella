import { getDevice } from "./license.ts";

export type CloudIntegrationCatalogItem = {
  provider: string;
  displayName: string;
  enabled: boolean;
  supportsWebhooks: boolean;
  scopes: string[];
};

export type CloudIntegrationConnection = {
  id: string;
  brandId: string;
  provider: string;
  status: string;
  accountEmail: string | null;
  accountDisplayName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudIntegrationSync = {
  jobId: string;
  status: string;
  progressFiles: number;
  progressBytes: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
} | null;

async function deviceHeaders(): Promise<HeadersInit> {
  const device = await getDevice();
  return {
    "Content-Type": "application/json",
    "x-suhuella-device-id": device.deviceId,
  };
}

export async function listCloudIntegrations(): Promise<
  | { ok: true; catalog: CloudIntegrationCatalogItem[]; connections: CloudIntegrationConnection[] }
  | { ok: false; error: string }
> {
  const device = await getDevice();
  const response = await fetch(`/api/integrations?deviceId=${encodeURIComponent(device.deviceId)}`, {
    headers: await deviceHeaders(),
    cache: "no-store",
  });
  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
    catalog?: CloudIntegrationCatalogItem[];
    connections?: CloudIntegrationConnection[];
  };
  if (!response.ok || !json.ok) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  return {
    ok: true,
    catalog: json.catalog ?? [],
    connections: json.connections ?? [],
  };
}

export async function startCloudIntegration(
  provider: string,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const device = await getDevice();
  const response = await fetch(`/api/integrations/${encodeURIComponent(provider)}/start`, {
    method: "POST",
    headers: await deviceHeaders(),
    body: JSON.stringify({ deviceId: device.deviceId, returnPath: "/home" }),
    cache: "no-store",
  });
  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
    authorizeUrl?: string;
  };
  if (!response.ok || !json.ok || !json.authorizeUrl) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  return { ok: true, authorizeUrl: json.authorizeUrl };
}

export async function disconnectCloudIntegration(
  connectionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const device = await getDevice();
  const response = await fetch(`/api/integrations/${encodeURIComponent(connectionId)}/disconnect`, {
    method: "POST",
    headers: await deviceHeaders(),
    body: JSON.stringify({ deviceId: device.deviceId }),
    cache: "no-store",
  });
  const json = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !json.ok) return { ok: false, error: json.error ?? "server_error" };
  return { ok: true };
}

export async function reconnectCloudIntegration(
  connectionId: string,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const device = await getDevice();
  const response = await fetch(`/api/integrations/${encodeURIComponent(connectionId)}/reconnect`, {
    method: "POST",
    headers: await deviceHeaders(),
    body: JSON.stringify({ deviceId: device.deviceId }),
    cache: "no-store",
  });
  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
    authorizeUrl?: string;
  };
  if (!response.ok || !json.ok || !json.authorizeUrl) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  return { ok: true, authorizeUrl: json.authorizeUrl };
}

export async function getCloudIntegrationStatus(
  connectionId: string,
): Promise<
  | { ok: true; connection: CloudIntegrationConnection; sync: CloudIntegrationSync }
  | { ok: false; error: string }
> {
  const device = await getDevice();
  const response = await fetch(
    `/api/integrations/${encodeURIComponent(connectionId)}/status?deviceId=${encodeURIComponent(device.deviceId)}`,
    {
      headers: await deviceHeaders(),
      cache: "no-store",
    },
  );
  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
    connection?: CloudIntegrationConnection;
    sync?: CloudIntegrationSync;
  };
  if (!response.ok || !json.ok || !json.connection) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  return { ok: true, connection: json.connection, sync: json.sync ?? null };
}
