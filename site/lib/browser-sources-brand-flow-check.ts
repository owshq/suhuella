import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  commitSourceBeforeScan,
  humanFolderName,
  isTechnicalSourceId,
  pendingBrowserSource,
  UNKNOWN_SOURCE_NAME,
} from "@suhuella/product/host/browser/connect-source.ts";
import { resolveSourceDisplayName } from "@suhuella/product/lib/source-display-name.ts";
import { sourceRecommendedAction } from "@suhuella/product/lib/source-actions.ts";
import { sourceAccessState } from "@suhuella/product/lib/source-host-vocabulary.ts";
import {
  shouldRecordSourceTransition,
  shouldRecordSourceUnavailable,
  sourceIsAccessible,
} from "@suhuella/product/lib/source-lifecycle.ts";
import {
  buildSourcePresentation,
  sourceActionLabel,
  sourceHealthDetailLines,
  sourceLifecycleActionLabel,
  sourceOpenBlockedCopy,
  sourceOrganiseBlockedCopy,
  sourceSearchUnavailableLine,
} from "@suhuella/product/lib/source-presentation.ts";
import {
  documentFilterForName,
  runBrowserSearchRankingChecks,
  searchKnowledge,
} from "@suhuella/product/host/browser/search.ts";
import {
  browserBlockedFolderDialogCopy,
  browserConnectDialogCopy,
  browserConnectFolderHint,
  browserConnectFolderLabel,
  browserLocalFoldersLabel,
  folderConnectErrorMessage,
  folderConnectFailedCopy,
  folderConnectPermissionCopy,
  isProtectedFolderConnectError,
  sourceDisplayName,
  sourceRemovedCopy,
} from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runBrowserSourcesBrandFlowCheck(): void {
  assert(isTechnicalSourceId("src_mu7ubk7y_jjy1r9"), "technical source id is detected");
  assert(!isTechnicalSourceId("informes"), "folder name is not a technical id");
  assert(humanFolderName("informes") === "informes", "handle.name becomes displayName");
  assert(
    humanFolderName("src_mu7ubk7y_jjy1r9", "Folder") === UNKNOWN_SOURCE_NAME,
    "technical id and placeholder never become a source name",
  );
  assert(humanFolderName("Folder", "informes") === "informes", "placeholder never wins over the real name");
  assert(
    resolveSourceDisplayName("Taxes2026") === "Taxes2026",
    "creation stores the real folder name immediately",
  );
  assert(
    sourceDisplayName("informes", "src_mu7ubk7y_jjy1r9", isTechnicalSourceId) === "informes",
    "UI prefers displayName over source id",
  );
  assert(
    sourceDisplayName("src_mu7ubk7y_jjy1r9", "src_mu7ubk7y_jjy1r9", isTechnicalSourceId) === UNKNOWN_SOURCE_NAME,
    "UI never renders technical id",
  );
  assert(
    sourceDisplayName("Folder", "/Users/narcis/Facturas", isTechnicalSourceId) === "Facturas",
    "placeholder yields to the real folder path",
  );
  assert(sourceAccessState("missing") === "missing", "missing stays a first-class access state");
  assert(sourceAccessState("permission_required") === "permission_required", "canonical status is idempotent");
  assert(!sourceIsAccessible("missing"), "missing sources are not usable for Plan");
  assert(!sourceIsAccessible("permission_required"), "permission_required is not accessible");
  assert(sourceRecommendedAction("missing") === "locate_folder", "domain recommends locate_folder, not a label");
  assert(sourceRecommendedAction("error") === "retry", "domain recommends retry, not Retry");
  assert(sourceActionLabel("retry") === "Retry", "presentation maps retry to Retry");
  assert(sourceActionLabel("locate_folder") === "Locate again", "presentation maps locate_folder");
  assert(sourceLifecycleActionLabel("missing") === "Locate again", "missing asks the user to locate");
  assert(sourceLifecycleActionLabel("permission_required") === "Restore permission", "permission asks Restore");
  assert(shouldRecordSourceUnavailable("indexed", "missing"), "first loss of access is recorded once");
  assert(!shouldRecordSourceUnavailable("missing", "missing"), "repeated probes do not spam Activity");
  assert(shouldRecordSourceTransition("indexed", "missing"), "Activity records access transitions");
  assert(!shouldRecordSourceTransition("missing", "missing"), "same state is not recorded again");
  assert(!shouldRecordSourceTransition("indexing", "indexed"), "scan completion is not an Activity event");
  assert(sourceRecommendedAction("missing") === "locate_folder", "missing recommends locate again");
  assert(
    sourceSearchUnavailableLine("Facturas 2026").includes("Reconnect"),
    "Search keeps unavailable documents visible with reconnect copy",
  );
  const presentation = buildSourcePresentation({
    id: "src_facturas",
    displayName: "Facturas 2026",
    locationStatus: "ready",
    documentCount: 147,
    lastIndexedAt: "2026-09-18T10:00:00.000Z",
    lastCheckedAt: "2026-09-19T16:00:00.000Z",
  });
  assert(presentation.summary.title === "Facturas 2026", "presentation summary carries the display name");
  assert(presentation.summary.documentCount === 147, "presentation summary carries document count");
  assert(presentation.status.accessible === true, "indexed sources are accessible");
  assert(presentation.actions.every((action) => action !== "none"), "presentation actions are concrete IDs");
  assert(!("actionLabel" in presentation), "presentation does not carry button copy");
  const detailLines = sourceHealthDetailLines(presentation);
  assert(detailLines.some((line) => line.includes("147 document")), "health shows remembered document count");
  assert(detailLines.some((line) => line.includes("Last checked")), "health separates last checked from last updated");

  const unavailable = buildSourcePresentation({
    id: "src_facturas",
    displayName: "Facturas 2026",
    locationStatus: "permission_denied",
    documentCount: 147,
  });
  assert(unavailable.actions.includes("restore_permission"), "unavailable presentation recommends restore_permission");
  assert(unavailable.actions.includes("remove"), "unavailable presentation also offers remove");
  assert(
    unavailable.actions.every((action) => action === action.toLowerCase() || action.includes("_")),
    "presentation actions stay domain IDs, not button copy",
  );

  const domainModel = readFileSync(
    join(process.cwd(), "../SOURCE-DOMAIN-MODEL-001.md"),
    "utf8",
  );
  assert(domainModel.includes("Source IDs are immutable"), "domain contract documents id immutability");
  assert(domainModel.includes("Source is identity"), "domain contract names Source as identity");
  assert(domainModel.includes("Handle is access"), "domain contract names Handle as access");
  assert(domainModel.includes("Presentation is derived"), "domain contract names Presentation as derived");
  assert(domainModel.includes("The UI never decides"), "domain contract keeps UI dumb");
  assert(domainModel.includes("SourcePresentation"), "domain contract names the React DTO");

  const lifecycleModel = readFileSync(
    join(process.cwd(), "../SOURCE-LIFECYCLE-MODEL-001.md"),
    "utf8",
  );
  assert(lifecycleModel.includes("SOURCE-DOMAIN-MODEL-001"), "lifecycle chapter points at the domain contract");
  assert(lifecycleModel.includes("Source IDs are immutable"), "lifecycle chapter keeps id immutability");
  assert(lifecycleModel.includes("Source ≠ Handle"), "lifecycle chapter keeps Source ≠ Handle");

  const domainGuard = readFileSync(
    join(process.cwd(), "../.cursor/rules/source-domain-guard.mdc"),
    "utf8",
  );
  assert(domainGuard.includes("SourcePresentation"), "cursor guard points UI at SourcePresentation");
  assert(domainGuard.includes("source-presentation.ts"), "cursor guard points UI at presentation module");
  assert(domainGuard.includes("alwaysApply: false"), "cursor guard stays minimal, not always-on");

  const domainSource = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-lifecycle.ts"),
    "utf8",
  );
  const identitySource = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-identity.ts"),
    "utf8",
  );
  const handleSource = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-handle.ts"),
    "utf8",
  );
  const healthSource = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-health.ts"),
    "utf8",
  );
  assert(!domainSource.includes('"Retry"'), "domain does not speak Retry");
  assert(!domainSource.includes("Restore permission"), "domain does not speak Restore permission");
  assert(identitySource.includes("export type Source "), "domain exports Source identity");
  assert(handleSource.includes("export type SourceHandle"), "domain exports Handle");
  assert(healthSource.includes("export type SourceHealth"), "domain exports Health");

  const storeSource = readFileSync(
    join(process.cwd(), "../packages/product/src/host/browser/store.ts"),
    "utf8",
  );
  assert(storeSource.includes("never mints a new id"), "restore keeps the same source identity");
  const restoreBlock =
    storeSource.match(
      /export async function restoreSourceAccess[\s\S]*?(?=\nexport async function)/,
    )?.[0] ?? "";
  assert(restoreBlock.length > 0, "restoreSourceAccess is present in the browser store");
  assert(!restoreBlock.includes("createId("), "restore never creates a new source id");
  const handleRegistry = readFileSync(
    join(process.cwd(), "../packages/product/src/host/browser/handle-registry.ts"),
    "utf8",
  );
  assert(storeSource.includes("browserHandles.bind"), "connect binds through the registry");
  assert(handleRegistry.includes("persistHandle(sourceId"), "handle binds to stable source id");

  const sourcesPanel = readFileSync(
    join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"),
    "utf8",
  );
  assert(sourcesPanel.includes("buildSourcePresentation"), "Sources UI consumes SourcePresentation");
  assert(sourcesPanel.includes("source-presentation"), "Sources UI imports presentation, not domain objects");
  assert(sourcesPanel.includes("presentation.summary"), "Sources UI reads presentation.summary");
  assert(sourcesPanel.includes("presentation.actions"), "Sources UI reads presentation.actions");
  assert(!sourcesPanel.includes("sourceAccessState"), "Sources UI does not decide access from host status");
  assert(sourcesPanel.includes("sourceHealthDetailLines"), "Sources UI does not derive health copy inline");

  assert(
    sourceOrganiseBlockedCopy("Facturas 2026").includes("Reconnect"),
    "Organise refuses a Plan on an unavailable source",
  );
  assert(
    sourceOpenBlockedCopy("Facturas 2026").includes("Facturas 2026"),
    "Search does not pretend an unavailable document can open",
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
    {
      id: "src_informes:Factura_José_García.pdf",
      sourceId: "src_informes",
      name: "Factura_José_García.pdf",
      relativePath: "Factura_José_García.pdf",
      parentRelative: "",
      size: 16,
      lastModified: null,
    },
    {
      id: "src_informes:Joshua.pdf",
      sourceId: "src_informes",
      name: "Joshua.pdf",
      relativePath: "Joshua.pdf",
      parentRelative: "",
      size: 10,
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

  const unaccented = searchKnowledge({ query: "jose garcia", files, sources, workflows: [], activity: [] });
  assert(
    unaccented.some((hit) => hit.title === "Factura_José_García.pdf"),
    "Search finds an accented filename from an unaccented query",
  );
  assert(
    !unaccented.some((hit) => hit.title === "Joshua.pdf"),
    "folded query does not match a different name",
  );

  const accentedQuery = searchKnowledge({ query: "josé", files, sources, workflows: [], activity: [] });
  assert(
    accentedQuery.some((hit) => hit.title === "Factura_José_García.pdf"),
    "Search still finds a document when the query keeps the accent",
  );
  assert(
    !accentedQuery.some((hit) => hit.title === "Joshua.pdf"),
    "accented query is not split into a short prefix",
  );

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
    browserBlockedFolderDialogCopy("en").title.includes("Desktop"),
    "blocked-folder modal offers Desktop for a browser-limited folder",
  );
  assert(
    browserBlockedFolderDialogCopy("es").body.includes("elegir una subcarpeta") &&
      browserBlockedFolderDialogCopy("es").body.includes("permisos de tu sistema"),
    "blocked-folder modal explains the browser limit and the subfolder alternative",
  );
  assert(
    !browserBlockedFolderDialogCopy("en").body.toLowerCase().includes("every function"),
    "blocked-folder modal does not promise every function",
  );
  assert(
    !browserBlockedFolderDialogCopy("es").body.toLowerCase().includes("todas las funciones"),
    "Spanish blocked-folder modal does not promise every function",
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
  assert(sourceCard.includes("sourceWorkingActionLabel"), "Add/Connect shows a busy label");
  assert(sourceCard.includes("data-source-connect-busy"), "Add/Connect shows a loading status");
  assert(sourceCard.includes("source-connect-busy-track"), "Add/Connect shows an indeterminate bar");
  assert(dialog.includes("data-source-connect-busy"), "blocked-folder retry shows loading status");

  const settingsWindow = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settingsWindow.includes("name={folderLabel(folderPath)}"), "recents inherit the stored folder name");
  assert(settingsWindow.includes("folderLabel(openedSource.path)"), "browse title inherits the stored folder name");
  assert(!settingsWindow.includes("recentFolderLabel"), "recents do not use a hardcoded Folder label");
  assert(settingsWindow.includes("suhuella-opened-source"), "opened source is persisted");
  assert(
    settingsWindow.includes("presentFolderConnectError"),
    "a protected folder opens the capability dialog",
  );
  assert(
    settingsWindow.includes("isFolderPickAbort(error)) return"),
    "cancelling the picker does not open the download dialog",
  );
  assert(
    !settingsWindow.includes("setFolderDialog('connect')"),
    "connect opens the native picker directly without a pre-picker modal",
  );
  assert(settingsWindow.includes("isFolderPickAbort"), "picker cancel returns before any capability or download dialog");

  const protectedError = Object.assign(new Error("Chrome cannot open this folder because it contains system files."), {
    code: "protected",
  });
  assert(isProtectedFolderConnectError(protectedError), "UI treats protected folders as branded recovery, not a product failure");
  assert(isProtectedFolderConnectError(new Error("Can't open this folder because it contains system files")), "Chrome system-files copy is classified");
  assert(
    isProtectedFolderConnectError(Object.assign(new Error("Failed to execute showDirectoryPicker"), { name: "SecurityError" })),
    "SecurityError from the picker is a blocked folder, not a silent cancel",
  );
  assert(
    folderConnectErrorMessage(Object.assign(new Error("The user aborted a request."), { name: "AbortError" })) === null,
    "picker cancel remains silent",
  );
  assert(
    folderConnectErrorMessage(Object.assign(new Error("Folder permission was not granted."), { code: "denied" })) ===
      folderConnectPermissionCopy(),
    "denied permission still becomes a recoverable notice",
  );
  assert(
    folderConnectErrorMessage(Object.assign(new Error("SuHuella could not open that folder."), { code: "failed" })) ===
      folderConnectFailedCopy(),
    "failed open still becomes a recoverable notice",
  );
  assert(
    sourceRemovedCopy("informes", { connectGrant: true }).includes("Connect it again"),
    "web can recover a removed source with Connect",
  );

  const homeCount = sources[0].fileCount;
  const searchCount = searchKnowledge({ query: "pdf", files, sources, workflows: [], activity: [] }).filter(
    (hit) => hit.kind === "file",
  ).length;
  assert(homeCount === files.length, "Home document count reads the same descriptors");
  assert(searchCount >= 1, "Search reads the same browser index as Home");

  runBrowserSearchRankingChecks();
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
