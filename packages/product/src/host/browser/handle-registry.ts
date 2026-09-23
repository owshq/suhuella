/**
 * BROWSER-ADAPTER-WIRING-001
 *
 * Connect / Restore / Refresh / Remove / Probe → Registry → Store.
 *
 * The store never imports a provider adapter.
 * Registry owns Handle lifetime. Store never calls handle.dispose().
 *
 * The File System Access grant stays in IndexedDB (provider token).
 * Access checks go through SourceHandle + handle-lifecycle-bridge.
 *
 * Future migration:
 * scanDirectory() will become provider-independent
 * (SyncEngine → Handle.open() → Indexer).
 * No functional change required now.
 */

import { createBrowserFsHandleAdapter } from "../adapters/browser-fs-handle-adapter.ts";
import {
  createSourceHandleRegistry,
  type SourceHandle,
  type SourceHandleRegistry,
} from "../source-handles.ts";
import {
  browserStoreProbeFromHandleStatus,
  type BrowserHandleProbe,
} from "./browser-handle-probe.ts";
import {
  directoryAvailable,
  ensurePermission,
  loadHandle,
  persistHandle,
  queryPermission,
  removeHandle,
} from "./fs.ts";

export type { BrowserHandleProbe };
export { browserStoreProbeFromHandleStatus };

let registry: SourceHandleRegistry = createSourceHandleRegistry();

function adapterFromDirectory(directory: FileSystemDirectoryHandle): SourceHandle {
  return createBrowserFsHandleAdapter({
    directory,
    directoryAccess: {
      queryPermission: async () => queryPermission(directory, "read"),
      requestPermission: async () => ((await ensurePermission(directory, "read")) ? "granted" : "denied"),
      available: () => directoryAvailable(directory),
    },
  });
}

async function bind(sourceId: string, directory: FileSystemDirectoryHandle): Promise<"persistent" | "limited"> {
  let access: "persistent" | "limited" = "limited";
  try {
    await persistHandle(sourceId, directory);
    access = "persistent";
  } catch {
    access = "limited";
  }
  const adapter = adapterFromDirectory(directory);
  if (registry.get(sourceId)) {
    await registry.replace(sourceId, adapter);
    return access;
  }
  registry.bind(sourceId, adapter);
  return access;
}

async function replace(sourceId: string, directory: FileSystemDirectoryHandle): Promise<void> {
  const adapter = adapterFromDirectory(directory);
  if (registry.get(sourceId)) {
    await registry.replace(sourceId, adapter);
    return;
  }
  registry.bind(sourceId, adapter);
}

async function resolve(sourceId: string): Promise<SourceHandle | null> {
  const bound = registry.get(sourceId);
  if (bound) return bound;
  const directory = await loadHandle(sourceId);
  if (!directory) return null;
  const adapter = adapterFromDirectory(directory);
  registry.bind(sourceId, adapter);
  return adapter;
}

async function unbind(sourceId: string): Promise<void> {
  await registry.unbind(sourceId);
  await removeHandle(sourceId);
}

async function dispose(): Promise<void> {
  await registry.dispose();
  registry = createSourceHandleRegistry();
}

async function probe(sourceId: string): Promise<BrowserHandleProbe | null> {
  const adapter = await resolve(sourceId);
  if (!adapter) return null;
  return browserStoreProbeFromHandleStatus(await adapter.status());
}

async function requestAccess(sourceId: string): Promise<BrowserHandleProbe | null> {
  const adapter = await resolve(sourceId);
  if (!adapter) return null;
  return browserStoreProbeFromHandleStatus(await adapter.requestPermission());
}

async function open(sourceId: string): Promise<BrowserHandleProbe | null> {
  const adapter = await resolve(sourceId);
  if (!adapter) return null;
  const result = await adapter.open();
  return browserStoreProbeFromHandleStatus(result.status);
}

/** Provider token for today's scanDirectory. Future: SyncEngine → Handle.open() → Indexer. */
async function grant(sourceId: string): Promise<FileSystemDirectoryHandle | null> {
  return loadHandle(sourceId);
}

/**
 * The only surface the browser store may use.
 * Provider adapters stay behind this facade.
 */
export const browserHandles = {
  bind,
  replace,
  unbind,
  probe,
  requestAccess,
  open,
  grant,
  dispose,
};

export function browserHandleRegistry(): SourceHandleRegistry {
  return registry;
}
