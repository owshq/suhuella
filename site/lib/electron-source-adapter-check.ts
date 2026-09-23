import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElectronHandleAdapter } from "@suhuella/product/host/adapters/electron-handle-adapter.ts";
import { runAdapterContract } from "@suhuella/product/host/adapters/adapter-contract.ts";
import { ADAPTER_CONTRACT_FIXTURES } from "@suhuella/product/host/adapters/adapter-fixtures.ts";
import { createSourceHandleRegistry } from "@suhuella/product/host/source-handles.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function repoFile(relative: string): string {
  return readFileSync(join(process.cwd(), "..", relative), "utf8");
}

async function runElectronSourceAdapterCheck(): Promise<void> {
  const startup = createElectronHandleAdapter();
  assert(startup.provider === "electron", "adapter identity is electron");
  assert((await startup.status()) === "unknown", "startup is unknown until a path is bound");
  assert(startup.capabilities.watch === true, "electron declares watch");
  assert(startup.capabilities.rename === true, "electron may rename");
  assert(startup.capabilities.move === true, "electron may move");
  assert(startup.capabilities.sync === false, "electron does not sync");

  const available = createElectronHandleAdapter({
    probe: () => "available",
    requestAccess: async () => true,
  });
  assert((await available.open()).ok === true, "connect/open succeeds when the path is there");
  assert((await available.refresh()).ok === true, "refresh succeeds when the path is there");
  assert((await available.status()) === "available", "availability is available");
  assert((await available.requestPermission()) === "available", "permission is available");

  const missing = createElectronHandleAdapter({ probe: () => "notFound" });
  assert((await missing.status()) === "notFound", "missing path is notFound");
  assert((await missing.open()).ok === false, "open fails when the path is gone");

  const denied = createElectronHandleAdapter({
    probe: () => "permissionDenied",
    requestAccess: async () => false,
  });
  assert((await denied.status()) === "permissionDenied", "denied path is permissionDenied");

  const registry = createSourceHandleRegistry();
  let disposed = false;
  registry.bind(
    "src_electron_test",
    createElectronHandleAdapter({
      probe: () => "available",
      dispose: () => {
        disposed = true;
      },
    }),
  );
  await registry.unbind("src_electron_test");
  assert(disposed, "dispose goes through the registry");

  const fixture = ADAPTER_CONTRACT_FIXTURES.find((item) => item.provider === "electron");
  assert(fixture, "electron is in the shared contract suite");
  const report = await runAdapterContract(fixture!);
  assert(report.passed.includes("open"), "contract open");
  assert(report.passed.includes("refresh"), "contract refresh");
  assert(report.passed.includes("unavailable"), "contract availability");
  assert(report.passed.includes("dispose"), "contract dispose");

  const adapter = repoFile("packages/product/src/host/adapters/electron-handle-adapter.ts");
  assert(!adapter.includes("node:fs"), "product adapter does not import Node fs");
  assert(adapter.includes("createElectronHandle"), "adapter uses the frozen factory");

  const index = repoFile("desktop/electron/index-service.ts");
  assert(index.includes("inspectElectronLocation"), "Desktop availability goes through the adapter");
  assert(!index.includes("accessSync("), "index-service no longer probes accessSync");

  const main = repoFile("desktop/electron/main.ts");
  assert(main.includes("bindElectronPathHandle"), "Add folder binds the handle");
  assert(main.includes("unbindElectronPathHandle"), "Remove unbinds through the registry");
  assert(main.includes("refreshElectronPathHandle"), "Restore refreshes the handle");

  const lifecycle = repoFile("packages/product/src/lib/source-lifecycle.ts");
  const presentation = repoFile("packages/product/src/lib/source-presentation.ts");
  assert(!lifecycle.includes("electron-handle-adapter"), "Lifecycle does not import the adapter");
  assert(!presentation.includes("electron-handle-adapter"), "Presentation does not import the adapter");
  assert(!lifecycle.includes("handle-registry"), "Lifecycle does not import the registry");

  const sources = repoFile("packages/product/src/components/SourcesPanel.tsx");
  assert(!sources.includes("electron-handle-adapter"), "Sources UI does not import the adapter");

  const doc = repoFile("ELECTRON-SOURCE-ADAPTER-001.md");
  assert(doc.includes("STATUS = CLOSED"), "track is closed");
  assert(doc.includes("No UI redesign"), "track forbids UI redesign");

  console.log("ELECTRON-SOURCE-ADAPTER-001 check passed");
}

void runElectronSourceAdapterCheck();
