import { searchKnowledge } from "@suhuella/product/host/browser/search.ts";
import {
  DEV_DEMO_DISPLAY_NAME,
  DEV_DEMO_FILES,
  DEV_DEMO_HINT,
  DEV_DEMO_SOURCE_ID,
  demoFileDescriptors,
  isBrowserDevHost,
  isDevDemoHint,
} from "@suhuella/product/host/browser/dev-host.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runBrowserDevSourcesCheck(): void {
  assert(isBrowserDevHost("localhost") === true, "localhost is a dev host");
  assert(isBrowserDevHost("127.0.0.1") === true, "127.0.0.1 is a dev host");
  assert(isBrowserDevHost("suhuella.com") === false, "production hostname is not a dev host");
  assert(isBrowserDevHost("suhuella.narcis-clavell.workers.dev") === false, "workers.dev is not a dev host");
  assert(isDevDemoHint(DEV_DEMO_HINT), "dev demo hint is recognised");
  assert(!isDevDemoHint("suhuella:documents"), "production catalog hints are not demo");

  const files = demoFileDescriptors();
  assert(files.length === DEV_DEMO_FILES.length, "demo descriptors match fixture count");
  assert(
    files.every((file) => file.sourceId === DEV_DEMO_SOURCE_ID),
    "demo files use the stable demo source id",
  );

  const hits = searchKnowledge({
    query: "factura",
    files,
    sources: [
      {
        id: DEV_DEMO_SOURCE_ID,
        kind: "local",
        type: "local_folder",
        name: DEV_DEMO_DISPLAY_NAME,
        fileCount: files.length,
        folderCount: 5,
        bytes: 0,
        lastIndexed: null,
        status: "ready",
        access: "limited",
        wellKnownToken: DEV_DEMO_HINT,
      },
    ],
    workflows: [],
    activity: [],
  });
  assert(
    hits.some((hit) => hit.title === "factura-enero.pdf"),
    "demo source is searchable by filename substring",
  );

  const panel = readFileSync(join(process.cwd(), "../packages/product/src/components/DeveloperSourcesPanel.tsx"), "utf8");
  assert(panel.includes("isBrowserDevHost()"), "Developer Sources panel is gated to localhost");
  assert(panel.includes("Load demo data"), "Developer Sources can load demo data");
  assert(panel.includes("Reconnect"), "Developer Sources can reconnect previous handles");

  const host = readFileSync(join(process.cwd(), "../packages/product/src/host/install-browser-host.ts"), "utf8");
  assert(host.includes("isDevDemoHint"), "browser host has a localhost Dev Host driver");
  assert(host.includes("connectDemoSource"), "Dev Host reuses the same source/index pipeline");

  const root = join(process.cwd(), "..");
  for (const file of DEV_DEMO_FILES) {
    const path = join(root, "dev-data", file.relativePath);
    readFileSync(path);
  }

  console.log("DEV-SOURCES check passed");
}

runBrowserDevSourcesCheck();
