import {
  createGoogleDriveHandle,
  createSourceHandleRegistry,
  type SourceHandle,
  type SourceHandleRegistry,
} from "../source-handles.ts";

/**
 * Google Drive SourceHandle adapter — maps a cloud connection to the Handle contract.
 * Provider metadata stays on the Handle; Source identity stays id + displayName only.
 */

const registry: SourceHandleRegistry = createSourceHandleRegistry();

export function googleDriveBrowsePath(connectionId: string, itemId?: string): string {
  return itemId ? `cloud:${connectionId}/${itemId}` : `cloud:${connectionId}`;
}

export function parseCloudBrowsePath(path: string): {
  connectionId: string;
  itemId: string | null;
} | null {
  const trimmed = path.trim();
  if (!trimmed.startsWith("cloud:")) return null;
  const rest = trimmed.slice("cloud:".length);
  const slash = rest.indexOf("/");
  if (slash === -1) return { connectionId: rest, itemId: null };
  return {
    connectionId: rest.slice(0, slash),
    itemId: rest.slice(slash + 1) || null,
  };
}

export function bindGoogleDriveConnectionHandle(input: {
  connectionId: string;
  status: "available" | "permissionDenied" | "offline" | "unknown";
}): SourceHandle {
  const existing = registry.get(input.connectionId);
  if (existing) return existing;
  const handle = createGoogleDriveHandle({
    status: async () => input.status,
    open: async () => ({
      ok: input.status === "available",
      status: input.status,
    }),
    refresh: async () => ({
      ok: input.status === "available",
      status: input.status,
    }),
    requestPermission: async () => input.status,
  });
  registry.bind(input.connectionId, handle);
  return handle;
}

export async function unbindGoogleDriveConnectionHandle(connectionId: string): Promise<void> {
  await registry.unbind(connectionId);
}

export function googleDriveHandleRegistry(): SourceHandleRegistry {
  return registry;
}
