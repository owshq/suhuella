import {
  catalogCardHidden,
  commitSourceBeforeScan,
  homeSourceCount,
  locationFromPending,
  mergeLiveSources,
  pendingBrowserSource,
} from "@suhuella/product/host/browser/connect-source.ts";
import type { WebKnowledgeSource } from "@suhuella/product/host/browser/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runBrowserConnectSourceCheck(): Promise<void> {
  const persisted: string[] = [];
  const remembered: string[] = [];
  let scanStarted = false;

  const pending = pendingBrowserSource({
    id: "src_test",
    name: "Documents",
    access: "persistent",
    wellKnownToken: "suhuella:documents",
  });

  const committed = await commitSourceBeforeScan({
    source: pending,
    persist: async (source) => {
      persisted.push(source.id);
    },
    remember: (source) => {
      remembered.push(source.id);
    },
    startScan: () => {
      scanStarted = true;
    },
  });

  assert(persisted[0] === "src_test", "source persists before scan");
  assert(remembered[0] === "src_test", "in-memory store updates before scan");
  assert(committed.status === "indexing", "committed source is indexing");
  assert(scanStarted, "scan starts after persist");
  assert(homeSourceCount([committed]) === 1, "Home source count includes indexing sources");

  const location = locationFromPending(committed);
  assert(location.status === "indexing", "UI location status is indexing while scan pending");
  assert(location.name === "Documents", "source name is visible");
  assert(
    catalogCardHidden("suhuella:documents", [location], (left, right) => left.toLowerCase() === right.toLowerCase()),
    "catalog card hides when wellKnownToken/catalogKey matches",
  );

  let scanOrder = "";
  let slowScanFinished = false;
  const created = await Promise.race([
    commitSourceBeforeScan({
      source: pendingBrowserSource({ id: "src_slow", name: "Downloads", access: "limited" }),
      persist: async () => {
        scanOrder += "persist";
      },
      remember: () => {
        scanOrder += "remember";
      },
      startScan: () => {
        scanOrder += "scan";
        void new Promise((resolve) => setTimeout(resolve, 8000)).then(() => {
          slowScanFinished = true;
        });
      },
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
  ]);
  assert(created && created.id === "src_slow", "slow scan promise does not block source creation");
  assert(scanOrder === "persistrememberscan", "slow scan does not run before persist");
  assert(slowScanFinished === false, "UI source exists while scan is still pending");

  const failedSource = pendingBrowserSource({ id: "src_fail", name: "Pictures", access: "persistent" });
  const kept: typeof failedSource[] = [];
  await commitSourceBeforeScan({
    source: failedSource,
    persist: async (source) => {
      kept.push(source);
    },
    remember: (source) => {
      kept.push({ ...source });
    },
    startScan: () => {
      kept[0] = { ...failedSource, status: "unavailable" };
    },
  });
  assert(kept.length >= 1, "failed scan still has a persisted source");
  assert(kept[0]?.id === "src_fail", "scan failure does not erase the source");

  const cancelled: string[] = [];
  try {
    throw new DOMException("The user aborted a request.", "AbortError");
  } catch (error) {
    assert(error instanceof DOMException && error.name === "AbortError", "user cancel does not create source");
    assert(cancelled.length === 0, "cancel creates no source");
  }

  const stored = (id: string, fileCount: number, extra: Partial<WebKnowledgeSource> = {}): WebKnowledgeSource => ({
    id,
    kind: "local",
    type: "local_folder",
    name: id,
    fileCount,
    folderCount: 1,
    bytes: 0,
    lastIndexed: null,
    status: "ready",
    access: "persistent",
    ...extra,
  });
  const fromIdb = [stored("src_old", 0), stored("src_live", 2)];
  const inMemory = [stored("src_live", 9)];
  const merged = mergeLiveSources(fromIdb, inMemory, new Set());
  assert(merged.length === 1, "initialized memory is membership, persisted-only ids stay out");
  assert(merged[0]?.id === "src_live" && merged[0].fileCount === 9, "memory file count wins over stale persist");

  const afterRemove = mergeLiveSources(fromIdb, [stored("src_old", 3)], new Set(["src_old"]));
  assert(afterRemove.length === 0, "removed source does not re-enter from IndexedDB");

  const emptyMemory = mergeLiveSources(fromIdb, [], new Set(["src_old", "src_live"]));
  assert(emptyMemory.length === 0, "empty memory after remove does not resurrect persisted sources");

  console.log("BROWSER-CONNECT-SOURCE-001 check passed");
}

void runBrowserConnectSourceCheck().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
