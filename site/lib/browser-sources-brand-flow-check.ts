import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  commitSourceBeforeScan,
  humanFolderName,
  isTechnicalSourceId,
  pendingBrowserSource,
} from "@suhuella/product/host/browser/connect-source.ts";
import { documentFilterForName, searchKnowledge } from "@suhuella/product/host/browser/search.ts";
import {
  browserBlockedFolderDialogCopy,
  browserConnectDialogCopy,
  browserConnectFolderHint,
  browserConnectFolderLabel,
  browserLocalFoldersLabel,
  isProtectedFolderConnectError,
  sourceDisplayName,
} from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runBrowserSourcesBrandFlowCheck(): void {
  assert(isTechnicalSourceId("src_mu7ubk7y_jjy1r9"), "technical source id is detected");
  assert(!isTechnicalSourceId("informes"), "folder name is not a technical id");
  assert(humanFolderName("informes") === "informes", "handle.name becomes displayName");
  assert(humanFolderName("src_mu7ubk7y_jjy1r9", "Folder") === "Folder", "technical id is not used as displayName");
  assert(
    sourceDisplayName("informes", "src_mu7ubk7y_jjy1r9", isTechnicalSourceId) === "informes",
    "UI prefers displayName over source id",
  );
  assert(
    sourceDisplayName("src_mu7ubk7y_jjy1r9", "src_mu7ubk7y_jjy1r9", isTechnicalSourceId) === "Folder",
    "UI never renders technical id",
  );

  const files = [
    {
      id: "src_informes:factura-enero.pdf",
      sourceId: "src_informes",
      name: "factura-enero.pdf",
      relativePath: "factura-enero.pdf",
      parentRelative: "",
      size: 12,
      lastModified: null,
    },
    {
      id: "src_informes:contrato-cliente.docx",
      sourceId: "src_informes",
      name: "contrato-cliente.docx",
      relativePath: "contrato-cliente.docx",
      parentRelative: "",
      size: 20,
      lastModified: null,
    },
    {
      id: "src_informes:captura-yala.png",
      sourceId: "src_informes",
      name: "captura-yala.png",
      relativePath: "captura-yala.png",
      parentRelative: "",
      size: 8,
      lastModified: null,
    },
  ];
  const sources = [pendingBrowserSource({ id: "src_informes", name: "informes", access: "persistent" })];
  sources[0].fileCount = files.length;

  const factura = searchKnowledge({ query: "factura", files, sources, workflows: [], activity: [] });
  assert(factura.some((hit) => hit.title === "factura-enero.pdf"), "Search finds browser file by filename substring");
  assert(factura[0]?.subtitle === "informes", "Search result shows folder displayName");

  const contrato = searchKnowledge({ query: "contrato", files, sources, workflows: [], activity: [] });
  assert(contrato.some((hit) => hit.title === "contrato-cliente.docx"), "Search finds contrato-cliente.docx");

  assert(documentFilterForName("factura-enero.pdf") === "pdf", "pdf chip maps pdf files");
  assert(documentFilterForName("contrato-cliente.docx") === "docx", "docx chip maps docx files");
  assert(documentFilterForName("captura-yala.png") === "images", "image chip maps png files");
  assert(
    searchKnowledge({ query: "factura", files, sources, workflows: [], activity: [] }).length > 0,
    "missing openFile capability does not hide browser results",
  );

  assert(browserLocalFoldersLabel("es") === "Local", "browser section is Local, not This Mac");
  assert(browserConnectFolderLabel("en") === "Connect folder", "browser primary action is Connect folder");
  assert(
    browserConnectFolderHint("en").includes("work folder"),
    "browser copy asks for a work folder, not Documents/Downloads",
  );
  assert(browserConnectDialogCopy("es").primary === "Elegir carpeta", "connect copy remains available for docs");
  assert(
    browserBlockedFolderDialogCopy("en").title.includes("not available in this browser"),
    "blocked-folder modal explains the folder is not available in the browser",
  );
  assert(
    !browserBlockedFolderDialogCopy("es").body.toLowerCase().includes("sube"),
    "blocked modal does not talk about upload",
  );
  assert(
    browserConnectDialogCopy("en").body.includes("download the desktop app"),
    "connect body includes the desktop download line",
  );
  assert(
    !("downloadHint" in browserConnectDialogCopy("en")),
    "connect dialog has two text blocks, not a third download paragraph",
  );

  const dialog = readFileSync(
    join(process.cwd(), "../packages/product/src/components/BrowserFolderConnectDialog.tsx"),
    "utf8",
  );
  assert(dialog.includes("data-brand-dialog"), "connect popup is a branded dialog");
  assert(dialog.includes("brand-dialog-surface"), "connect popup uses brand surface class");
  assert(!dialog.includes("bg-[var(--app-bg)]"), "connect popup does not use generic app background");
  assert(!dialog.includes("copy.downloadHint"), "connect popup does not render a third download paragraph");

  const sourceCard = readFileSync(join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"), "utf8");
  assert(
    sourceCard.includes("onPress={onOpenSource ? undefined"),
    "source icon click opens the source instead of the appearance editor",
  );

  const settingsWindow = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settingsWindow.includes("suhuella-opened-source"), "opened source is persisted");
  assert(
    settingsWindow.includes("setBlockedFolderDialogOpen(true)"),
    "protected or aborted picker shows the blocked-folder dialog",
  );
  assert(
    !settingsWindow.includes("setFolderDialog('connect')"),
    "connect opens the native picker directly without a pre-picker modal",
  );
  assert(settingsWindow.includes("isFolderPickAbort"), "picker abort is recovered in the branded blocked dialog");

  const protectedError = Object.assign(new Error("Chrome cannot open this folder because it contains system files."), {
    code: "protected",
  });
  assert(isProtectedFolderConnectError(protectedError), "UI treats protected folders as branded recovery, not a product failure");
  assert(isProtectedFolderConnectError(new Error("Can't open this folder because it contains system files")), "Chrome system-files copy is classified");
  assert(
    isProtectedFolderConnectError(Object.assign(new Error("Failed to execute showDirectoryPicker"), { name: "SecurityError" })),
    "SecurityError from the picker is a blocked folder, not a silent cancel",
  );

  const homeCount = sources[0].fileCount;
  const searchCount = searchKnowledge({ query: "pdf", files, sources, workflows: [], activity: [] }).filter(
    (hit) => hit.kind === "file",
  ).length;
  assert(homeCount === files.length, "Home document count reads the same descriptors");
  assert(searchCount >= 1, "Search reads the same browser index as Home");
}

async function runCommitBeforeScan(): Promise<void> {
  let visibleBeforeScan = false;
  await commitSourceBeforeScan({
    source: pendingBrowserSource({ id: "src_visible", name: "informes", access: "limited" }),
    persist: async () => {},
    remember: () => {
      visibleBeforeScan = true;
    },
    startScan: () => {
      assert(visibleBeforeScan, "source is visible before scan completes");
    },
  });
}

void (async () => {
  runBrowserSourcesBrandFlowCheck();
  await runCommitBeforeScan();
  console.log("BROWSER-SOURCES-BRAND-FLOW-001 check passed");
})().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
