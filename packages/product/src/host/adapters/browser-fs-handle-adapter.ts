/**
 * BROWSER-SOURCE-ADAPTER-001 — reference implementation.
 *
 * Browser File System Access → SourceHandle infrastructure.
 * Domain projection stays in host/browser/source-adapter.ts.
 *
 * Sync Engine rule: Sync Engine → Handle → Provider. Never Sync Engine → browser API.
 */

import {
  createBrowserFileSystemHandle,
  type HandleCapabilities,
  type SourceHandle,
} from "../source-handles.ts";

export const BROWSER_FS_ADAPTER_ID = "browser_fs" as const;

type FileSystemPermission = "granted" | "denied" | "unknown" | "prompt";

export type BrowserFsDirectoryAccess = {
  queryPermission?: (mode?: "read") => Promise<FileSystemPermission>;
  requestPermission?: (mode?: "read") => Promise<FileSystemPermission>;
  available?: () => Promise<boolean>;
};

export type BrowserFsHandleAdapterOptions = {
  directory?: FileSystemDirectoryHandle;
  directoryAccess?: BrowserFsDirectoryAccess;
  capabilities?: Partial<HandleCapabilities>;
};

/** Reference adapter: wires a directory grant into the frozen Handle contract. */
export function createBrowserFsHandleAdapter(options: BrowserFsHandleAdapterOptions = {}): SourceHandle {
  const access = options.directoryAccess;
  return createBrowserFileSystemHandle({
    capabilities: options.capabilities,
    directory: access
      ? {
          queryPermission: access.queryPermission,
          requestPermission: access.requestPermission,
          available: access.available,
        }
      : undefined,
  });
}

/**
 * Real browser host wiring. Dynamic import keeps Node contract tests off browser/fs.ts.
 * Call only from the browser host when a FileSystemDirectoryHandle is already granted.
 */
export async function createBrowserFsHandleAdapterFromDirectory(
  directory: FileSystemDirectoryHandle,
  capabilities?: Partial<HandleCapabilities>,
): Promise<SourceHandle> {
  const { queryPermission, ensurePermission, directoryAvailable } = await import("../browser/fs.ts");
  return createBrowserFsHandleAdapter({
    capabilities,
    directory,
    directoryAccess: {
      queryPermission: async () => queryPermission(directory, "read"),
      requestPermission: async () => {
        const granted = await ensurePermission(directory, "read");
        return granted ? "granted" : "denied";
      },
      available: () => directoryAvailable(directory),
    },
  });
}
