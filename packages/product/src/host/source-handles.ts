/**
 * MULTI-PLATFORM-SOURCE-ADAPTERS-001
 *
 * Handle adapters are infrastructure. Source is identity.
 * The Source never knows which adapter it owns.
 *
 * The Domain never stores provider-specific information.
 * Provider-specific metadata belongs exclusively to the Handle.
 *
 * Handle → HandleStatus → handle-lifecycle-bridge → Lifecycle → Presentation
 * Handles never speak Presentation copy or lifecycle labels.
 *
 * Registry owns Handle lifetime.
 * Only the Registry may call dispose() on a bound Handle.
 * UI and React must never call handle.dispose() directly.
 */

export type SourceProvider =
  | "browser_fs"
  | "electron"
  | "ios"
  | "android"
  | "google_drive"
  | "dropbox"
  | "onedrive"
  | "nas"
  | "smb"
  | "future";

/** @deprecated Use SourceProvider */
export type SourceHandleProvider = SourceProvider;

export const SOURCE_HANDLE_PROVIDERS: readonly SourceProvider[] = [
  "browser_fs",
  "electron",
  "ios",
  "android",
  "google_drive",
  "dropbox",
  "onedrive",
  "nas",
  "smb",
  "future",
];

/** Infrastructure tokens only. Lifecycle translates these; Presentation never reads them. */
export type HandleStatus =
  | "unknown"
  | "available"
  | "permissionDenied"
  | "notFound"
  | "offline"
  | "busy"
  | "unsupported";

export type HandleCapabilities = {
  watch: boolean;
  open: boolean;
  organise: boolean;
  rename: boolean;
  move: boolean;
  sync: boolean;
};

export type SourceHandleOpenResult = {
  ok: boolean;
  status: HandleStatus;
};

export type SourceHandleRefreshResult = {
  ok: boolean;
  status: HandleStatus;
};

export type SourceHandleWatch = {
  stop(): void;
};

/** Same surface on every provider. Source never receives this object. */
export interface SourceHandle {
  readonly provider: SourceProvider;
  readonly capabilities: HandleCapabilities;
  /** Version of the SourceHandle interface contract — not the adapter or backend build. */
  readonly contractVersion: number;
  open(): Promise<SourceHandleOpenResult>;
  refresh(): Promise<SourceHandleRefreshResult>;
  status(): Promise<HandleStatus>;
  requestPermission(): Promise<HandleStatus>;
  /**
   * Registry-internal teardown. Only SourceHandleRegistry may call this.
   * UI and React must never invoke dispose() on a Handle.
   */
  dispose(): Promise<void>;
  /** Present only when capabilities.watch is true. */
  watch?: () => Promise<SourceHandleWatch | null>;
}

export type SourceHandleBackend = {
  open?: () => Promise<SourceHandleOpenResult>;
  refresh?: () => Promise<SourceHandleRefreshResult>;
  status?: () => Promise<HandleStatus>;
  requestPermission?: () => Promise<HandleStatus>;
  watch?: () => Promise<SourceHandleWatch | null>;
  dispose?: () => Promise<void>;
};

/** Registry owns Handle lifetime. Host code must route teardown through the Registry. */
export const REGISTRY_OWNS_HANDLE_LIFETIME = true as const;

type AdapterDefaults = {
  status: HandleStatus;
  capabilities: HandleCapabilities;
};

const CAPABILITY_PRESETS: Record<SourceProvider, HandleCapabilities> = {
  browser_fs: { watch: false, open: true, organise: true, rename: false, move: false, sync: false },
  electron: { watch: true, open: true, organise: true, rename: true, move: true, sync: false },
  ios: { watch: false, open: true, organise: true, rename: false, move: false, sync: false },
  android: { watch: false, open: true, organise: true, rename: false, move: false, sync: false },
  google_drive: { watch: true, open: true, organise: false, rename: false, move: false, sync: true },
  dropbox: { watch: false, open: true, organise: false, rename: false, move: false, sync: true },
  onedrive: { watch: true, open: true, organise: false, rename: false, move: false, sync: true },
  nas: { watch: false, open: true, organise: true, rename: true, move: true, sync: false },
  smb: { watch: false, open: true, organise: true, rename: true, move: true, sync: false },
  future: { watch: false, open: false, organise: false, rename: false, move: false, sync: false },
};

const DEFAULTS: Record<SourceProvider, AdapterDefaults> = {
  browser_fs: { status: "unknown", capabilities: CAPABILITY_PRESETS.browser_fs },
  electron: { status: "unknown", capabilities: CAPABILITY_PRESETS.electron },
  ios: { status: "unknown", capabilities: CAPABILITY_PRESETS.ios },
  android: { status: "unknown", capabilities: CAPABILITY_PRESETS.android },
  google_drive: { status: "unknown", capabilities: CAPABILITY_PRESETS.google_drive },
  dropbox: { status: "unknown", capabilities: CAPABILITY_PRESETS.dropbox },
  onedrive: { status: "unknown", capabilities: CAPABILITY_PRESETS.onedrive },
  nas: { status: "unknown", capabilities: CAPABILITY_PRESETS.nas },
  smb: { status: "unknown", capabilities: CAPABILITY_PRESETS.smb },
  future: { status: "unknown", capabilities: CAPABILITY_PRESETS.future },
};

const HANDLE_CONTRACT_VERSION = 1;

const customFactories = new Map<string, (backend?: SourceHandleBackend) => SourceHandle>();

function mergeCapabilities(
  provider: SourceProvider,
  overrides?: Partial<HandleCapabilities>,
): HandleCapabilities {
  return { ...CAPABILITY_PRESETS[provider], ...overrides };
}

function createHandle(
  provider: SourceProvider,
  backend: SourceHandleBackend = {},
  overrides?: Partial<HandleCapabilities>,
): SourceHandle {
  const defaults = DEFAULTS[provider];
  const capabilities = mergeCapabilities(provider, overrides);
  let activeWatch: SourceHandleWatch | null = null;
  let disposed = false;

  const ensureActive = () => {
    if (disposed) throw new Error("handle disposed");
  };

  const handle: SourceHandle = {
    provider,
    capabilities,
    contractVersion: HANDLE_CONTRACT_VERSION,
    async open() {
      ensureActive();
      if (backend.open) return backend.open();
      const status = backend.status ? await backend.status() : defaults.status;
      return { ok: status === "available", status };
    },
    async refresh() {
      ensureActive();
      if (backend.refresh) return backend.refresh();
      const status = backend.status ? await backend.status() : defaults.status;
      return { ok: status === "available", status };
    },
    async status() {
      ensureActive();
      if (backend.status) return backend.status();
      return defaults.status;
    },
    async requestPermission() {
      ensureActive();
      if (backend.requestPermission) return backend.requestPermission();
      return defaults.status;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      activeWatch?.stop();
      activeWatch = null;
      if (backend.dispose) await backend.dispose();
    },
  };

  if (capabilities.watch) {
    handle.watch = async () => {
      ensureActive();
      activeWatch?.stop();
      activeWatch = backend.watch ? await backend.watch() : null;
      return activeWatch;
    };
  }

  return handle;
}

/** @deprecated Read handle.provider instead. */
export function sourceHandleProvider(handle: SourceHandle): SourceProvider {
  return handle.provider;
}

type FileSystemPermission = "granted" | "denied" | "unknown" | "prompt";

export type BrowserFileSystemHandleOptions = SourceHandleBackend & {
  capabilities?: Partial<HandleCapabilities>;
  directory?: {
    queryPermission?: (mode?: "read") => Promise<FileSystemPermission>;
    requestPermission?: (mode?: "read") => Promise<FileSystemPermission>;
    available?: () => Promise<boolean>;
  };
};

function permissionToStatus(
  permission: FileSystemPermission | undefined,
  available: boolean,
): HandleStatus {
  if (permission === "denied") return "permissionDenied";
  if (permission === "unknown" || permission === "prompt") return "permissionDenied";
  if (permission === "granted") return available ? "available" : "offline";
  return "unknown";
}

export function createBrowserFileSystemHandle(options: BrowserFileSystemHandleOptions = {}): SourceHandle {
  const directory = options.directory;
  const watch = options.capabilities?.watch ?? Boolean(options.watch);
  return createHandle(
    "browser_fs",
    {
      ...options,
      async status() {
        if (options.status) return options.status();
        if (!directory) return "unknown";
        const permission = await directory.queryPermission?.("read");
        const available = directory.available ? await directory.available() : permission === "granted";
        return permissionToStatus(permission, available);
      },
      async requestPermission() {
        if (options.requestPermission) return options.requestPermission();
        if (!directory?.requestPermission) return "unknown";
        const permission = await directory.requestPermission("read");
        const available = directory.available ? await directory.available() : permission === "granted";
        return permissionToStatus(permission, available);
      },
      async open() {
        if (options.open) return options.open();
        if (!directory) return { ok: false, status: "unknown" };
        const permission = await directory.queryPermission?.("read");
        const available = directory.available ? await directory.available() : permission === "granted";
        const status = permissionToStatus(permission, available);
        return { ok: status === "available", status };
      },
    },
    { ...options.capabilities, watch },
  );
}

export type ElectronHandleOptions = SourceHandleBackend & {
  capabilities?: Partial<HandleCapabilities>;
  pathExists?: () => Promise<boolean>;
  requestAccess?: () => Promise<boolean>;
};

export function createElectronHandle(options: ElectronHandleOptions = {}): SourceHandle {
  return createHandle(
    "electron",
    {
      ...options,
      async status() {
        if (options.status) return options.status();
        if (!options.pathExists) return "unknown";
        return (await options.pathExists()) ? "available" : "notFound";
      },
      async requestPermission() {
        if (options.requestPermission) return options.requestPermission();
        if (!options.requestAccess) {
          return options.pathExists && (await options.pathExists()) ? "available" : "unknown";
        }
        return (await options.requestAccess()) ? "available" : "permissionDenied";
      },
      async open() {
        if (options.open) return options.open();
        const exists = options.pathExists ? await options.pathExists() : false;
        const status: HandleStatus = exists ? "available" : options.pathExists ? "notFound" : "unknown";
        return { ok: exists, status };
      },
    },
    options.capabilities,
  );
}

export function createIOSHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("ios", backend);
}

export function createAndroidHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("android", backend);
}

export function createGoogleDriveHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("google_drive", backend);
}

export function createDropboxHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("dropbox", backend);
}

export function createOneDriveHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("onedrive", backend);
}

export function createNasHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("nas", backend);
}

export function createSmbHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("smb", backend);
}

export function createFutureHandle(backend?: SourceHandleBackend): SourceHandle {
  return createHandle("future", backend);
}

const FACTORIES: Record<SourceProvider, (backend?: SourceHandleBackend) => SourceHandle> = {
  browser_fs: createBrowserFileSystemHandle,
  electron: createElectronHandle,
  ios: createIOSHandle,
  android: createAndroidHandle,
  google_drive: createGoogleDriveHandle,
  dropbox: createDropboxHandle,
  onedrive: createOneDriveHandle,
  nas: createNasHandle,
  smb: createSmbHandle,
  future: createFutureHandle,
};

/** Register a provider that does not exist yet. Domain stays unchanged. */
export function registerSourceHandleProvider(
  provider: string,
  factory: (backend?: SourceHandleBackend) => SourceHandle,
): void {
  customFactories.set(provider, factory);
}

export function createSourceHandle(provider: string, backend?: SourceHandleBackend): SourceHandle {
  const custom = customFactories.get(provider);
  if (custom) return custom(backend);
  if (provider in FACTORIES) return FACTORIES[provider as SourceProvider](backend);
  return createFutureHandle(backend);
}

export type SourceHandleBinding = {
  sourceId: string;
  handle: SourceHandle;
};

export type SourceHandleRegistry = {
  bind(sourceId: string, handle: SourceHandle): void;
  replace(sourceId: string, handle: SourceHandle): Promise<SourceHandle>;
  unbind(sourceId: string): Promise<void>;
  get(sourceId: string): SourceHandle | null;
  list(): readonly SourceHandleBinding[];
  /** Disposes every bound handle and clears the registry. */
  dispose(): Promise<void>;
};

export function createSourceHandleRegistry(): SourceHandleRegistry {
  const handles = new Map<string, SourceHandle>();

  async function disposeOwnedHandle(handle: SourceHandle | undefined): Promise<void> {
    if (!handle) return;
    await handle.dispose();
  }

  return {
    bind(sourceId, handle) {
      handles.set(sourceId, handle);
    },
    async replace(sourceId, handle) {
      if (!handles.has(sourceId)) {
        throw new Error("source has no handle to replace");
      }
      const previous = handles.get(sourceId);
      await disposeOwnedHandle(previous);
      handles.set(sourceId, handle);
      return handle;
    },
    async unbind(sourceId) {
      await disposeOwnedHandle(handles.get(sourceId));
      handles.delete(sourceId);
    },
    get(sourceId) {
      return handles.get(sourceId) ?? null;
    },
    list() {
      return [...handles.entries()].map(([sourceId, handle]) => ({ sourceId, handle }));
    },
    async dispose() {
      await Promise.all([...handles.values()].map((handle) => handle.dispose()));
      handles.clear();
    },
  };
}

/** Identity records the host must keep when an adapter is replaced. */
export type SourceContinuity = {
  sourceId: string;
  activityIds: readonly string[];
  planIds: readonly string[];
  searchHistoryIds: readonly string[];
  documentIds: readonly string[];
};

export function snapshotSourceContinuity(value: SourceContinuity): SourceContinuity {
  return {
    sourceId: value.sourceId,
    activityIds: [...value.activityIds],
    planIds: [...value.planIds],
    searchHistoryIds: [...value.searchHistoryIds],
    documentIds: [...value.documentIds],
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function sourceContinuityEquals(left: SourceContinuity, right: SourceContinuity): boolean {
  return (
    left.sourceId === right.sourceId &&
    sameIds(left.activityIds, right.activityIds) &&
    sameIds(left.planIds, right.planIds) &&
    sameIds(left.searchHistoryIds, right.searchHistoryIds) &&
    sameIds(left.documentIds, right.documentIds)
  );
}
