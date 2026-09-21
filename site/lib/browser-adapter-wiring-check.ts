import { readFileSync } from "node:fs";
import { join } from "node:path";
import { browserStoreProbeFromHandleStatus } from "@suhuella/product/host/browser/browser-handle-probe.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function repoFile(relative: string): string {
  return readFileSync(join(process.cwd(), "..", relative), "utf8");
}

function runBrowserAdapterWiringCheck(): void {
  const available = browserStoreProbeFromHandleStatus("available");
  assert(available.status === "ready", "available maps to the same ready record");
  assert(available.permission === "granted", "available keeps granted");
  assert(available.availabilityReason === null, "available has no availability reason");

  const denied = browserStoreProbeFromHandleStatus("permissionDenied");
  assert(denied.status === "needs_permission", "permissionDenied maps to needs_permission");
  assert(denied.permission === "denied", "permissionDenied keeps denied");
  assert(denied.availabilityReason === "permission_revoked", "permissionDenied keeps revoked reason");

  const offline = browserStoreProbeFromHandleStatus("offline");
  assert(offline.status === "unavailable", "offline maps to unavailable");
  assert(offline.permission === "granted", "offline keeps granted");
  assert(offline.availabilityReason === "disk_offline", "offline keeps disk_offline");

  const missing = browserStoreProbeFromHandleStatus("notFound");
  assert(missing.status === "missing", "notFound maps to missing");
  assert(missing.availabilityReason === "folder_moved", "notFound keeps folder_moved");

  const registry = repoFile("packages/product/src/host/browser/handle-registry.ts");
  const probe = repoFile("packages/product/src/host/browser/browser-handle-probe.ts");
  assert(registry.includes("createBrowserFsHandleAdapter"), "registry facade creates the browser adapter");
  assert(registry.includes("createSourceHandleRegistry"), "wiring uses the registry");
  assert(registry.includes("persistHandle(sourceId"), "grant still binds to the stable source id");
  assert(registry.includes("browserHandles"), "store-facing facade is browserHandles");
  assert(probe.includes("handleStatusToLifecycle"), "probe mapping calls the bridge, does not reimplement it");
  assert(!probe.includes('case "permissionDenied"'), "probe mapping does not reimplement HandleStatus");
  assert(registry.includes("Registry owns Handle lifetime"), "wiring keeps registry ownership");
  assert(registry.includes("scanDirectory() will become provider-independent"), "scan migration is documented");

  const store = repoFile("packages/product/src/host/browser/store.ts");
  assert(store.includes("browserHandles.bind"), "connect binds through the registry");
  assert(store.includes("browserHandles.probe"), "probe goes through the registry");
  assert(store.includes("browserHandles.requestAccess"), "restore/refresh go through the registry");
  assert(store.includes("browserHandles.unbind"), "remove unbinds through the registry");
  assert(store.includes("browserHandles.dispose"), "clear disposes through the registry");
  assert(store.includes("browserHandles.open"), "scan opens through the registry first");
  assert(store.includes("never mints a new id"), "restore still keeps identity");
  assert(!store.includes("queryPermission("), "store no longer probes permission directly");
  assert(!store.includes("ensurePermission("), "store no longer requests permission directly");
  assert(!store.includes("directoryAvailable("), "store no longer checks availability directly");
  assert(!store.includes("persistHandle("), "store does not persist grants itself");
  assert(!store.includes("removeHandle("), "store does not delete grants itself");
  assert(!store.includes("loadHandle("), "store does not load grants itself");
  assert(!store.includes("browser-fs-handle-adapter"), "store does not import the browser adapter");
  assert(!store.includes("createElectronHandle"), "store does not import the electron adapter");
  assert(!store.includes("createGoogleDriveHandle"), "store does not import the drive adapter");
  assert(!store.includes("handle.dispose"), "store never disposes a handle itself");
  assert(store.includes("browserHandles.dispose"), "clear disposes through the registry facade");
  assert(store.includes("SyncEngine → Handle.open() → Indexer"), "store documents scan migration");
  const restoreBlock =
    store.match(/export async function restoreSourceAccess[\s\S]*?(?=\nexport async function)/)?.[0] ?? "";
  assert(restoreBlock.length > 0, "restoreSourceAccess exists");
  assert(!restoreBlock.includes("createId("), "restore does not mint a new Source ID");
  assert(restoreBlock.includes("browserHandles.requestAccess"), "restore goes through the registry");

  const lifecycle = repoFile("packages/product/src/lib/source-lifecycle.ts");
  const presentation = repoFile("packages/product/src/lib/source-presentation.ts");
  assert(!lifecycle.includes("handle-registry"), "Lifecycle does not import wiring");
  assert(!presentation.includes("handle-registry"), "Presentation does not import wiring");

  const sources = repoFile("packages/product/src/components/SourcesPanel.tsx");
  assert(!sources.includes("handle-registry"), "Sources UI does not import wiring");
  assert(!sources.includes("source-handles"), "Sources UI still does not consume adapters");

  const contract = repoFile("tracks/archive/BROWSER-ADAPTER-WIRING-001.md");
  assert(contract.includes("STATUS = FROZEN · PASS"), "wiring track is frozen and passed");
  assert(contract.includes("AUTOMATED = PASS"), "automated gate is pass");
  assert(contract.includes("MANUAL = PASS"), "manual smoke passed");
  assert(contract.includes("FREEZE = ACTIVE"), "freeze is active");
  assert(contract.includes("Connect folder"), "manual smoke covers connect");
  assert(contract.includes("registry.unbind()"), "manual smoke covers remove");
  assert(contract.includes("No further refactoring of Browser Wiring"), "close rule is documented");
  assert(contract.includes("No behaviour changes"), "wiring contract forbids behaviour change");
  assert(contract.includes("The Store never imports a provider adapter"), "store/adapter split is frozen");
  assert(contract.includes("Do **not** open `ELECTRON-SOURCE-ADAPTER-001`"), "electron stays closed until freeze");

  const next = repoFile("BROWSER-SOURCE-ADAPTER-001.md");
  assert(next.includes("BROWSER-ADAPTER-WIRING-001"), "reference adapter points at wiring");

  console.log("BROWSER-ADAPTER-WIRING-001 check passed");
}

runBrowserAdapterWiringCheck();
