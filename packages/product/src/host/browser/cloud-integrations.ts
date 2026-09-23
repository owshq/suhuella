import { getDevice } from "./license.ts";
import {
  bindGoogleDriveConnectionHandle,
  parseCloudBrowsePath,
  unbindGoogleDriveConnectionHandle,
} from "../adapters/google-drive-handle-adapter.ts";

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

export type CloudIntegrationSource = {
  id: string;
  displayName: string;
  provider: string;
  status: string;
  accountEmail: string | null;
  browseRoot: string;
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

export type CloudBrowsePage = {
  connectionId: string;
  provider: string;
  parentId: string;
  parentName: string;
  parentOfParentId: string | null;
  source: { id: string; displayName: string };
  items: Array<{
    id: string;
    name: string;
    kind: "folder" | "file";
    mimeType?: string;
    size?: number | null;
    modifiedAt?: string | null;
  }>;
  nextCursor: string | null;
};

async function deviceHeaders(): Promise<HeadersInit> {
  const device = await getDevice();
  return {
    "Content-Type": "application/json",
    "x-suhuella-device-id": device.deviceId,
  };
}

function bindHandles(sources: CloudIntegrationSource[]): void {
  for (const source of sources) {
    bindGoogleDriveConnectionHandle({
      connectionId: source.id,
      status: source.status === "active" ? "available" : "permissionDenied",
    });
  }
}

export async function listCloudIntegrations(): Promise<
  | {
      ok: true;
      enabled: boolean;
      catalog: CloudIntegrationCatalogItem[];
      connections: CloudIntegrationConnection[];
      sources: CloudIntegrationSource[];
    }
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
    enabled?: boolean;
    catalog?: CloudIntegrationCatalogItem[];
    connections?: CloudIntegrationConnection[];
    sources?: CloudIntegrationSource[];
  };
  if (!response.ok || !json.ok) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  const sources = json.sources ?? [];
  bindHandles(sources);
  return {
    ok: true,
    enabled: json.enabled === true,
    catalog: json.catalog ?? [],
    connections: json.connections ?? [],
    sources,
  };
}

export async function startCloudIntegration(
  provider: string,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const device = await getDevice();
  const slug = provider.replaceAll("_", "-");
  const response = await fetch(`/api/integrations/${encodeURIComponent(slug)}/start`, {
    method: "POST",
    headers: await deviceHeaders(),
    body: JSON.stringify({ deviceId: device.deviceId, returnPath: "/sources" }),
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
  await unbindGoogleDriveConnectionHandle(connectionId);
  return { ok: true };
}

export async function reconnectCloudIntegration(
  connectionId: string,
): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const device = await getDevice();
  const response = await fetch(`/api/integrations/${encodeURIComponent(connectionId)}/reconnect`, {
    method: "POST",
    headers: await deviceHeaders(),
    body: JSON.stringify({ deviceId: device.deviceId, returnPath: "/sources" }),
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

export async function browseCloudSourceChildren(input: {
  connectionId: string;
  parentId?: string | null;
  cursor?: string | null;
}): Promise<{ ok: true; page: CloudBrowsePage } | { ok: false; error: string }> {
  const device = await getDevice();
  const params = new URLSearchParams({ deviceId: device.deviceId });
  if (input.parentId) params.set("parent", input.parentId);
  if (input.cursor) params.set("cursor", input.cursor);
  const response = await fetch(
    `/api/sources/${encodeURIComponent(input.connectionId)}/children?${params.toString()}`,
    {
      headers: await deviceHeaders(),
      cache: "no-store",
    },
  );
  const json = (await response.json()) as {
    ok?: boolean;
    error?: string;
    connectionId?: string;
    provider?: string;
    parentId?: string;
    parentName?: string;
    parentOfParentId?: string | null;
    source?: { id: string; displayName: string };
    items?: CloudBrowsePage["items"];
    nextCursor?: string | null;
  };
  if (!response.ok || !json.ok || !json.connectionId || !json.source) {
    return { ok: false, error: json.error ?? "server_error" };
  }
  return {
    ok: true,
    page: {
      connectionId: json.connectionId,
      provider: json.provider ?? "google_drive",
      parentId: json.parentId ?? "root",
      parentName: json.parentName ?? json.source.displayName,
      parentOfParentId: json.parentOfParentId ?? null,
      source: json.source,
      items: json.items ?? [],
      nextCursor: json.nextCursor ?? null,
    },
  };
}

export { parseCloudBrowsePath };
