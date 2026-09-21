import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { handleStatusToLifecycle } from "@suhuella/product/host/handle-lifecycle-bridge.ts";
import {
  createAndroidHandle,
  createBrowserFileSystemHandle,
  createDropboxHandle,
  createElectronHandle,
  createFutureHandle,
  createGoogleDriveHandle,
  createIOSHandle,
  createNasHandle,
  createOneDriveHandle,
  createSmbHandle,
  createSourceHandle,
  createSourceHandleRegistry,
  REGISTRY_OWNS_HANDLE_LIFETIME,
  registerSourceHandleProvider,
  snapshotSourceContinuity,
  sourceContinuityEquals,
  SOURCE_HANDLE_PROVIDERS,
  type HandleStatus,
  type SourceContinuity,
  type SourceHandle,
  type SourceHandleBackend,
} from "@suhuella/product/host/source-handles.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function repoFile(relative: string): string {
  return readFileSync(join(process.cwd(), "..", relative), "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkTsFiles(path, out);
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function grantedBackend(): SourceHandleBackend {
  return {
    open: async () => ({ ok: true, status: "available" }),
    refresh: async () => ({ ok: true, status: "available" }),
    status: async () => "available",
    requestPermission: async () => "available",
    watch: async () => ({ stop() {} }),
  };
}

const HANDLE_STATUSES: HandleStatus[] = [
  "unknown",
  "available",
  "permissionDenied",
  "notFound",
  "offline",
  "busy",
  "unsupported",
];

async function assertHandleContract(handle: SourceHandle, label: string): Promise<void> {
  assert(typeof handle.provider === "string", `${label} exposes provider`);
  assert(typeof handle.contractVersion === "number", `${label} exposes contractVersion`);
  assert(typeof handle.capabilities === "object", `${label} exposes capabilities`);
  for (const key of ["watch", "open", "organise", "rename", "move", "sync"] as const) {
    assert(typeof handle.capabilities[key] === "boolean", `${label} exposes capabilities.${key}`);
  }
  assert(typeof handle.open === "function", `${label} exposes open`);
  assert(typeof handle.refresh === "function", `${label} exposes refresh`);
  assert(typeof handle.status === "function", `${label} exposes status`);
  assert(typeof handle.requestPermission === "function", `${label} exposes requestPermission`);
  assert(typeof handle.dispose === "function", `${label} exposes dispose`);

  const opened = await handle.open();
  const refreshed = await handle.refresh();
  const status = await handle.status();
  const permission = await handle.requestPermission();

  assert(typeof opened.ok === "boolean", `${label}.open returns ok`);
  assert(HANDLE_STATUSES.includes(opened.status), `${label}.open returns HandleStatus`);
  assert(typeof refreshed.ok === "boolean", `${label}.refresh returns ok`);
  assert(HANDLE_STATUSES.includes(refreshed.status), `${label}.refresh returns HandleStatus`);
  assert(HANDLE_STATUSES.includes(status), `${label}.status returns HandleStatus`);
  assert(HANDLE_STATUSES.includes(permission), `${label}.requestPermission returns HandleStatus`);

  if (handle.capabilities.watch) {
    assert(typeof handle.watch === "function", `${label} exposes watch when watchable`);
    const watch = await handle.watch!();
    assert(watch === null || typeof watch.stop === "function", `${label}.watch returns null or stop()`);
  } else {
    assert(handle.watch === undefined, `${label} omits watch when not watchable`);
  }
}

const continuity: SourceContinuity = {
  sourceId: "src_facturas",
  activityIds: ["act_connected"],
  planIds: ["plan_2026"],
  searchHistoryIds: ["q_factura"],
  documentIds: ["doc_factura_enero"],
};

async function runSourceHandleAdaptersCheck(): Promise<void> {
  assert(REGISTRY_OWNS_HANDLE_LIFETIME === true, "registry ownership is frozen");

  const factories: Record<string, () => SourceHandle> = {
    browser_fs: () => createBrowserFileSystemHandle(),
    electron: () => createElectronHandle(),
    ios: () => createIOSHandle(),
    android: () => createAndroidHandle(),
    google_drive: () => createGoogleDriveHandle(),
    dropbox: () => createDropboxHandle(),
    onedrive: () => createOneDriveHandle(),
    nas: () => createNasHandle(),
    smb: () => createSmbHandle(),
    future: () => createFutureHandle(),
  };

  assert(SOURCE_HANDLE_PROVIDERS.length === 10, "all target providers are listed");
  for (const provider of SOURCE_HANDLE_PROVIDERS) {
    assert(typeof factories[provider] === "function", `${provider} has a factory`);
    const handle = factories[provider]();
    await assertHandleContract(handle, provider);
    assert(handle.provider === provider, `${provider} adapter carries provider identity`);
    assert((await handle.status()) === "unknown", `${provider} starts as unknown before probe`);
    const viaFactory = createSourceHandle(provider);
    await assertHandleContract(viaFactory, `createSourceHandle(${provider})`);
  }

  const browser = createBrowserFileSystemHandle({
    directory: {
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      available: async () => true,
    },
  });
  assert((await browser.status()) === "available", "browser FSA adapter reports available after probe");
  assert((await browser.requestPermission()) === "available", "browser FSA adapter can request permission");
  assert((await browser.open()).ok === true, "browser FSA adapter can open a granted directory");
  assert(browser.capabilities.watch === false, "browser FSA is not watchable by default");
  assert(browser.capabilities.open === true, "browser FSA can open");
  assert(browser.watch === undefined, "browser FSA omits watch unless capabilities say so");

  const browserWithWatch = createBrowserFileSystemHandle({
    capabilities: { watch: true },
    watch: async () => ({ stop() {} }),
  });
  assert(browserWithWatch.capabilities.watch === true, "browser can opt into watch");
  assert(typeof browserWithWatch.watch === "function", "watchable browser exposes watch");

  const electron = createElectronHandle({
    pathExists: async () => true,
    requestAccess: async () => true,
  });
  assert((await electron.status()) === "available", "electron adapter uses path existence");
  assert((await electron.requestPermission()) === "available", "electron adapter does not mint a Source");
  assert(electron.capabilities.watch === true, "electron defaults to watchable");
  assert(electron.capabilities.rename === true, "electron defaults to rename");

  const drive = createGoogleDriveHandle();
  assert((await drive.status()) === "unknown", "Drive starts unknown until probed");
  assert(drive.capabilities.watch === true, "Drive defaults to watchable when connected");
  assert(drive.capabilities.sync === true, "Drive defaults to syncable");

  const dropbox = createDropboxHandle();
  assert(dropbox.capabilities.watch === false, "Dropbox defaults to not watchable");
  assert(dropbox.capabilities.sync === true, "Dropbox defaults to syncable");

  registerSourceHandleProvider("box", () => createFutureHandle(grantedBackend()));
  const box = createSourceHandle("box");
  await assertHandleContract(box, "future provider box");
  assert((await box.status()) === "available", "future providers reuse the same interface");

  const unknownProbe = handleStatusToLifecycle("unknown");
  assert(unknownProbe.permission === "unknown", "bridge maps unknown before first probe");
  const lifecycleProbe = handleStatusToLifecycle("permissionDenied");
  assert(lifecycleProbe.status === "permission_required", "bridge maps permissionDenied to lifecycle");
  assert(lifecycleProbe.availabilityReason === "permission_revoked", "bridge keeps availability internal");
  const busyProbe = handleStatusToLifecycle("busy");
  assert(busyProbe.status === "indexing", "bridge maps busy to indexing");

  const source = { id: "src_facturas", displayName: "Facturas 2026" };
  const before = snapshotSourceContinuity(continuity);
  const registry = createSourceHandleRegistry();
  let disposed = false;
  registry.bind(
    source.id,
    createBrowserFileSystemHandle({
      ...grantedBackend(),
      dispose: async () => {
        disposed = true;
      },
    }),
  );
  const first = registry.get(source.id);
  assert(first !== null, "registry binds a handle to the source id");
  assert(!Object.values(source).includes(first), "Source does not own the adapter instance");
  assert(registry.list().length === 1, "registry lists bindings");

  const replaced = await registry.replace(
    source.id,
    createGoogleDriveHandle({
      ...grantedBackend(),
    }),
  );
  assert(disposed === true, "replace disposes the previous handle through the registry");
  const after = snapshotSourceContinuity(continuity);

  assert(source.id === "src_facturas", "replacing an adapter does not change Source ID");
  assert(source.id === before.sourceId, "continuity source id is the registry key, not a new identity");
  assert(sourceContinuityEquals(before, after), "Activity, Plans, Search history and documents stay the same");
  assert(registry.get(source.id) === replaced, "registry now holds the replacement adapter");
  assert(first!.provider === "browser_fs", "previous adapter remains browser_fs");
  assert(replaced.provider === "google_drive", "replacement adapter is Drive");
  assert(source.id === continuity.sourceId, "document identity stays on the same Source");
  assert(!("handle" in source), "Source object never received the adapter");
  assert(!("driveId" in source), "Source never stores provider-specific metadata");

  let unbound = false;
  registry.bind(
    "src_other",
    createFutureHandle({
      dispose: async () => {
        unbound = true;
      },
    }),
  );
  await registry.unbind("src_other");
  assert(unbound === true, "unbind disposes the handle through the registry");

  let cleared = 0;
  registry.bind("src_a", createFutureHandle({ dispose: async () => { cleared += 1; } }));
  registry.bind("src_b", createFutureHandle({ dispose: async () => { cleared += 1; } }));
  await registry.dispose();
  assert(cleared === 2, "registry.dispose clears every handle");
  assert(registry.list().length === 0, "registry is empty after dispose");

  const adapters = repoFile("packages/product/src/host/source-handles.ts");
  assert(adapters.includes("readonly provider: SourceProvider"), "handle carries provider identity");
  assert(adapters.includes("readonly capabilities: HandleCapabilities"), "handle carries capabilities");
  assert(adapters.includes("readonly contractVersion: number"), "handle carries contractVersion");
  assert(adapters.includes("export type HandleStatus"), "handle speaks HandleStatus tokens");
  assert(adapters.includes('"unknown"'), "handle includes unknown startup state");
  assert(adapters.includes("REGISTRY_OWNS_HANDLE_LIFETIME"), "registry ownership is documented in code");
  assert(adapters.includes("Provider-specific metadata belongs exclusively to the Handle"), "provider metadata stays on handle");
  assert(adapters.includes("dispose(): Promise<void>"), "handle exposes dispose for registry use");
  assert(adapters.includes("watch?: () => Promise"), "watch is optional");
  assert(!adapters.includes("readonly version: number"), "version was renamed to contractVersion");
  assert(!adapters.includes("watchable"), "capabilities use grouped watch/open/organise");
  assert(!adapters.includes("checkAvailability()"), "handle no longer speaks availability UI tokens");
  assert(!adapters.includes("permission_required"), "handle no longer speaks lifecycle labels");
  assert(adapters.includes("get(sourceId"), "registry exposes get");
  assert(adapters.includes("list()"), "registry exposes list");
  assert(!adapters.includes("from \"../lib/source-lifecycle.ts\""), "adapters do not import Source lifecycle");
  assert(!adapters.includes("from \"../lib/source-presentation.ts\""), "adapters do not import Presentation");
  assert(!adapters.includes("from \"../lib/source-capabilities.ts\""), "adapters do not import Capabilities");
  assert(!adapters.includes("createId("), "adapters never mint a Source ID");

  const bridge = repoFile("packages/product/src/host/handle-lifecycle-bridge.ts");
  assert(
    bridge.includes("Only handle-lifecycle-bridge may translate HandleStatus into SourceLifecycle"),
    "bridge is the only authorized translation layer",
  );
  assert(bridge.includes("handleStatusToLifecycle"), "bridge translates HandleStatus to lifecycle");
  assert(!bridge.includes("source-presentation"), "bridge never reaches Presentation");

  const productRoot = join(process.cwd(), "../packages/product/src");
  const forbiddenTranslators: string[] = [];
  for (const file of walkTsFiles(productRoot)) {
    const relative = file.slice(productRoot.length + 1);
    if (relative === "host/handle-lifecycle-bridge.ts") continue;
    if (relative === "host/source-handles.ts") continue;
    if (relative.startsWith("host/adapters/")) continue;
    const content = readFileSync(file, "utf8");
    const reimplementsBridge =
      content.includes('case "permissionDenied"') && content.includes("permission_required");
    if (reimplementsBridge) forbiddenTranslators.push(`${relative} (reimplements HandleStatus map)`);
  }
  assert(forbiddenTranslators.length === 0, `only the bridge may translate HandleStatus: ${forbiddenTranslators.join(", ")}`);

  const uiRoots = [
    join(productRoot, "components"),
    join(productRoot, "windows"),
  ];
  for (const root of uiRoots) {
    for (const file of walkTsFiles(root)) {
      const content = readFileSync(file, "utf8");
      assert(!content.includes("source-handles"), `${file} does not import adapters`);
      assert(!content.includes("handle-lifecycle-bridge"), `${file} does not import the bridge`);
      assert(!content.includes(".dispose("), `${file} never disposes handles directly`);
    }
  }

  const lifecycle = repoFile("packages/product/src/lib/source-lifecycle.ts");
  const presentation = repoFile("packages/product/src/lib/source-presentation.ts");
  const capabilities = repoFile("packages/product/src/lib/source-capabilities.ts");
  const domainHandle = repoFile("packages/product/src/lib/source-handle.ts");
  assert(!lifecycle.includes("source-handles"), "Lifecycle does not import adapters");
  assert(!lifecycle.includes("handle-lifecycle-bridge"), "Lifecycle does not import the bridge");
  assert(!presentation.includes("source-handles"), "Presentation does not import adapters");
  assert(!presentation.includes("handle-lifecycle-bridge"), "Presentation does not import the bridge");
  assert(!capabilities.includes("source-handles"), "Capabilities do not import adapters");
  assert(!domainHandle.includes("driveId"), "domain handle never stores driveId");
  assert(!domainHandle.includes("dropboxPath"), "domain handle never stores dropboxPath");

  const contract = repoFile("MULTI-PLATFORM-SOURCE-ADAPTERS-001.md");
  assert(contract.includes("STATUS = FROZEN"), "contract is frozen");
  assert(contract.includes("unknown"), "contract documents unknown startup state");
  assert(contract.includes("contractVersion"), "contract documents contractVersion");
  assert(contract.includes("Registry owns Handle lifetime"), "contract documents registry ownership");
  assert(contract.includes("Only `handle-lifecycle-bridge.ts`"), "contract documents bridge exclusivity");
  assert(contract.includes("provider-specific information"), "contract forbids provider metadata on Source");
  assert(contract.includes("Sync Engine"), "contract documents sync evolution path");
  assert(contract.includes("change Source ID"), "contract forbids identity change on swap");

  console.log("MULTI-PLATFORM-SOURCE-ADAPTERS-001 check passed");
}

void runSourceHandleAdaptersCheck();
