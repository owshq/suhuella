/**
 * Contract fixtures — mock backends for every provider.
 * Real adapters replace these incrementally; the contract suite stays identical.
 */

import { createElectronHandleAdapter } from "./electron-handle-adapter.ts";
import {
  createAndroidHandle,
  createBrowserFileSystemHandle,
  createDropboxHandle,
  createFutureHandle,
  createGoogleDriveHandle,
  createIOSHandle,
  createNasHandle,
  createOneDriveHandle,
  createSmbHandle,
  type SourceHandle,
  type SourceHandleBackend,
  type SourceProvider,
} from "../source-handles.ts";
import type { AdapterContractFixture, AdapterContractScenario } from "./adapter-contract.ts";

function grantedBackend(): SourceHandleBackend {
  return {
    open: async () => ({ ok: true, status: "available" }),
    refresh: async () => ({ ok: true, status: "available" }),
    status: async () => "available",
    requestPermission: async () => "available",
    watch: async () => ({ stop() {} }),
  };
}

function deniedBackend(): SourceHandleBackend {
  return {
    status: async () => "permissionDenied",
    requestPermission: async () => "permissionDenied",
    open: async () => ({ ok: false, status: "permissionDenied" }),
    refresh: async () => ({ ok: false, status: "permissionDenied" }),
  };
}

function offlineBackend(): SourceHandleBackend {
  return {
    status: async () => "offline",
    requestPermission: async () => "offline",
    open: async () => ({ ok: false, status: "offline" }),
    refresh: async () => ({ ok: false, status: "offline" }),
  };
}

function fixtureFactory(
  provider: SourceProvider,
  createForScenario: (scenario: AdapterContractScenario) => SourceHandle,
): AdapterContractFixture {
  return { provider, create: createForScenario };
}

function browserDirectoryAccess(options: {
  permission?: "granted" | "denied";
  available?: boolean;
}) {
  const permission = options.permission ?? "granted";
  const available = options.available ?? true;
  return {
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    available: async () => available,
  };
}

function browserFixture(): AdapterContractFixture {
  return fixtureFactory("browser_fs", (scenario) => {
    if (scenario === "startup") return createBrowserFileSystemHandle();
    if (scenario === "available") {
      return createBrowserFileSystemHandle({ directory: browserDirectoryAccess({ permission: "granted" }) });
    }
    if (scenario === "permissionDenied") {
      return createBrowserFileSystemHandle({ directory: browserDirectoryAccess({ permission: "denied" }) });
    }
    if (scenario === "unavailable") {
      return createBrowserFileSystemHandle({
        directory: browserDirectoryAccess({ permission: "granted", available: false }),
      });
    }
    return createBrowserFileSystemHandle({
      capabilities: { watch: true },
      watch: async () => ({ stop() {} }),
      directory: browserDirectoryAccess({ permission: "granted" }),
    });
  });
}

function electronFixture(): AdapterContractFixture {
  return fixtureFactory("electron", (scenario) => {
    if (scenario === "startup") return createElectronHandleAdapter();
    if (scenario === "available") {
      return createElectronHandleAdapter({
        probe: () => "available",
        requestAccess: async () => true,
      });
    }
    if (scenario === "permissionDenied") {
      return createElectronHandleAdapter({
        probe: () => "permissionDenied",
        requestAccess: async () => false,
      });
    }
    if (scenario === "unavailable") {
      return createElectronHandleAdapter({ probe: () => "notFound" });
    }
    return createElectronHandleAdapter({
      probe: () => "available",
      watchPath: async () => ({ stop() {} }),
    });
  });
}

function cloudFixture(provider: SourceProvider, factory: (backend?: SourceHandleBackend) => SourceHandle): AdapterContractFixture {
  return fixtureFactory(provider, (scenario) => {
    if (scenario === "startup") return factory();
    if (scenario === "available") return factory(grantedBackend());
    if (scenario === "permissionDenied") return factory(deniedBackend());
    if (scenario === "unavailable") return factory(offlineBackend());
    return factory({ ...grantedBackend(), watch: async () => ({ stop() {} }) });
  });
}

function mobileFixture(provider: SourceProvider, factory: (backend?: SourceHandleBackend) => SourceHandle): AdapterContractFixture {
  return cloudFixture(provider, factory);
}

/** Every provider the contract suite runs against. Add new adapters here only. */
export const ADAPTER_CONTRACT_FIXTURES: readonly AdapterContractFixture[] = [
  browserFixture(),
  electronFixture(),
  cloudFixture("google_drive", createGoogleDriveHandle),
  cloudFixture("dropbox", createDropboxHandle),
  cloudFixture("onedrive", createOneDriveHandle),
  mobileFixture("ios", createIOSHandle),
  mobileFixture("android", createAndroidHandle),
  cloudFixture("nas", createNasHandle),
  cloudFixture("smb", createSmbHandle),
  cloudFixture("future", createFutureHandle),
];

/** Low-level browser factory fixture — kept for infrastructure regression. */
export function browserFsFactoryFixture(): AdapterContractFixture {
  return fixtureFactory("browser_fs", (scenario) => {
    if (scenario === "startup") return createBrowserFileSystemHandle();
    if (scenario === "available") {
      return createBrowserFileSystemHandle({
        directory: {
          queryPermission: async () => "granted",
          requestPermission: async () => "granted",
          available: async () => true,
        },
      });
    }
    if (scenario === "permissionDenied") {
      return createBrowserFileSystemHandle({
        directory: {
          queryPermission: async () => "denied",
          requestPermission: async () => "denied",
          available: async () => false,
        },
      });
    }
    if (scenario === "unavailable") {
      return createBrowserFileSystemHandle({
        directory: {
          queryPermission: async () => "granted",
          requestPermission: async () => "granted",
          available: async () => false,
        },
      });
    }
    return createBrowserFileSystemHandle({
      capabilities: { watch: true },
      watch: async () => ({ stop() {} }),
      directory: {
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        available: async () => true,
      },
    });
  });
}
