import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isBrowserDevHost } from "@suhuella/product/host/browser/dev-host.ts";
import {
  browserCapabilityCatalog,
  browserChooseSubfolderLabel,
  browserCloudComingLaterCopy,
  browserConnectFolderLabel,
  browserLocalFoldersLabel,
  browserSystemFolderHint,
  browserSystemFoldersLabel,
  folderConnectErrorMessage,
  folderConnectFailedCopy,
  folderConnectPermissionCopy,
  sourceConnectWaitKind,
  sourceConnectWaitingHint,
  sourceConnectWaitingStatus,
  sourceRemoveFailedCopy,
  sourceRemovedCopy,
  sourceSightLabel,
  sourceWorkingActionLabel,
  sourcesWhatCanSeeCopy,
} from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runSourcesCapabilityMatrixCheck(): void {
  const catalog = browserCapabilityCatalog("darwin");
  const localNames = catalog.filter((card) => card.capability === "limited").map((card) => card.label);
  const cloudNames = catalog.filter((card) => card.capability === "coming_later").map((card) => card.label);

  assert(localNames.includes("Documents"), "system catalog includes Documents");
  assert(localNames.includes("Downloads"), "system catalog includes Downloads");
  assert(localNames.includes("Desktop"), "system catalog includes Desktop");
  assert(localNames.includes("Pictures"), "system catalog includes Pictures");
  assert(cloudNames.includes("Google Drive"), "cloud catalog includes Google Drive");
  assert(cloudNames.includes("OneDrive"), "cloud catalog includes OneDrive");
  assert(cloudNames.includes("Dropbox"), "cloud catalog includes Dropbox");
  assert(catalog.every((card) => card.capability !== undefined), "every catalog card has an honest capability");
  assert(
    catalog.filter((card) => card.group === "cloud").every((card) => card.capability === "coming_later"),
    "cloud providers are coming later until a real connector exists",
  );

  assert(sourceSightLabel("limited") === "Limited in browser", "system folders are Limited in browser");
  assert(sourceSightLabel("coming_later") === "Coming later", "unimplemented cloud is Coming later");
  assert(sourceSightLabel("indexed") === "Indexed", "connected sources stay Indexed, not Connected");
  assert(browserLocalFoldersLabel("en") === "Local", "browser shows Local");
  assert(browserConnectFolderLabel("en") === "Connect folder", "browser primary CTA is Connect folder");
  assert(browserSystemFoldersLabel("en") === "System folders", "browser shows System folders");
  assert(browserChooseSubfolderLabel("en") === "Choose subfolder", "limited folders use Choose subfolder");
  assert(
    browserSystemFolderHint("en").includes("regular subfolder"),
    "system hint tells the user to choose a subfolder",
  );
  assert(
    browserSystemFolderHint("es").includes("subcarpeta"),
    "Spanish system hint explains the browser limit",
  );
  assert(
    !browserSystemFolderHint("en").toLowerCase().includes("upload failed"),
    "system hint does not say upload failed",
  );
  assert(
    !browserSystemFolderHint("en").toLowerCase().includes("license"),
    "system hint does not require a license",
  );
  assert(
    browserCloudComingLaterCopy("en").includes("not available in this preview"),
    "cloud copy is honest",
  );
  assert(sourcesWhatCanSeeCopy("en") === "What SuHuella can see.", "Sources header stays short in English");
  assert(sourcesWhatCanSeeCopy("es") === "Qué puede ver SuHuella.", "Sources header stays short in Spanish");

  const denied = Object.assign(new Error("Folder permission was not granted."), { code: "denied" });
  assert(folderConnectErrorMessage(denied) === folderConnectPermissionCopy(), "denied permission is a recoverable notice");
  assert(
    folderConnectErrorMessage(new Error("Folder permission was not granted.")) === folderConnectPermissionCopy(),
    "permission copy is classified without a host error code",
  );
  const failed = Object.assign(new Error("SuHuella could not open that folder."), { code: "failed" });
  assert(folderConnectErrorMessage(failed) === folderConnectFailedCopy(), "generic open failure stays recoverable");
  assert(
    !folderConnectFailedCopy().toLowerCase().includes("use chrome"),
    "generic open failure does not tell a Chrome user to switch browsers",
  );
  assert(
    folderConnectErrorMessage(Object.assign(new Error("The user aborted a request."), { name: "AbortError" })) === null,
    "picker cancel stays out of the notice",
  );
  assert(
    folderConnectErrorMessage(Object.assign(new Error("This folder is not available in this browser."), { code: "protected" })) ===
      null,
    "protected folders stay with the recovery dialog",
  );
  assert(sourceWorkingActionLabel("Connect folder", true) === "Connecting…", "browser connect shows Connecting");
  assert(sourceWorkingActionLabel("Add", true) === "Adding…", "desktop add shows Adding");
  assert(sourceWorkingActionLabel("Restore permission", true) === "Restoring…", "restore shows Restoring");
  assert(sourceWorkingActionLabel("Retry", true) === "Trying again…", "retry shows Trying again");
  assert(sourceWorkingActionLabel("Remove", true) === "Removing…", "remove shows Removing");
  assert(sourceWorkingActionLabel("Connect folder") === "Connect folder", "idle connect keeps its label");
  assert(sourceConnectWaitKind("Connect folder", true) === "picker", "web connect waits on the picker");
  assert(sourceConnectWaitKind("Add", true) === "picker", "desktop choose-folder waits on the picker");
  assert(sourceConnectWaitKind("Add", false) === "add", "desktop available folder does not invent picker progress");
  assert(sourceConnectWaitKind("Restore permission", false) === "restore", "restore is its own wait");
  assert(sourceConnectWaitKind("Retry", false) === "retry", "retry is its own wait");
  assert(sourceConnectWaitKind("Remove", false) === "remove", "remove is its own wait");
  assert(
    sourceConnectWaitingStatus("Connecting…", "picker") === "Opening folder picker…",
    "picker wait is indeterminate copy",
  );
  assert(sourceConnectWaitingStatus("Adding…", "add") === "Adding folder…", "known-folder add does not claim a picker");
  assert(
    sourceConnectWaitingHint("Adding…", "picker") === "Choose a folder to add to SuHuella.",
    "desktop picker explains the wait",
  );
  assert(
    sourceConnectWaitingHint("Connecting…", "picker") === "Choose a folder so SuHuella can see it.",
    "web picker explains the wait",
  );
  assert(sourceConnectWaitingHint("Adding…", "add") === null, "catalog add has no fake picker hint");
  assert(sourceConnectWaitingStatus("Removing…", "remove") === "Removing this source…", "remove wait is announced");
  assert(
    sourceRemovedCopy("Documents", { connectGrant: false }).includes("Add it again"),
    "desktop remove recovery says Add",
  );
  assert(
    sourceRemovedCopy("Documents", { connectGrant: true }).includes("Connect it again"),
    "web remove recovery says Connect",
  );
  assert(
    !sourceRemovedCopy("Documents", { connectGrant: false }).includes("Connect it again"),
    "desktop remove does not say Connect",
  );
  assert(sourceRemoveFailedCopy("Documents").includes("Try again"), "failed remove stays recoverable");

  const panel = readFileSync(join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"), "utf8");
  assert(panel.includes("hostCapabilityCatalog"), "Sources renders the host capability catalog");
  assert(panel.includes("browserConnectFolderLabel"), "Sources renders Connect folder");
  assert(!panel.includes("browserSystemFoldersLabel"), "system folders live under Local, not a separate section");
  assert(panel.includes('sight="limited"'), "system folders use limited, not fake Available");
  assert(panel.includes("browserChooseSubfolderLabel"), "limited folders offer Choose subfolder");
  assert(
    panel.includes("onLimitedSystemFolder ?? requestAdd"),
    "Choose subfolder opens the limitation dialog before the normal folder flow",
  );
  assert(panel.includes('sight="coming_later"'), "cloud without connector is coming later");
  assert(!panel.includes("onAction={() => onAddSuggested(card.path)}"), "limited cards do not start a fake system-folder connect");
  assert(panel.includes("event.stopPropagation()"), "Remove stops the card click");
  assert(!panel.includes("sm:opacity-0 sm:group-hover:opacity-100"), "Remove is not hover-hidden");
  assert(panel.includes("sourceWorkingActionLabel"), "connect actions show a busy label");
  assert(panel.includes("SourceConnectBusyStatus"), "connect wait shows a loading status");
  assert(panel.includes("source-connect-busy-track"), "connect wait shows an indeterminate indicator");
  assert(panel.includes("data-source-connect-busy"), "loading status is marked for tests");
  assert(panel.includes('role="status"'), "connect wait and errors are announced as status");
  assert(panel.includes("aria-live"), "loading text is announced");
  assert(panel.includes("requestRemove"), "Remove uses the source wait path");
  assert(panel.includes("noticeKind"), "remove success is a status, not an error");

  const settings = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settings.includes("indexWaitGeneration"), "remove is not overwritten by a stale index poll");
  assert(settings.includes("dismissedSourcePaths"), "removed sources stay dismissed after index refresh");
  assert(settings.includes("current.filter((item) => item.path !== location)"), "remove updates the list immediately");
  assert(settings.includes("sourceRemovedCopy"), "successful remove explains how to add the source again");
  assert(settings.includes("sourceRemoveFailedCopy"), "failed remove stays on screen");
  assert(
    !/setIndexHydrated\(true\)\s*\n\s*setSourcesNotice\(null\)/.test(settings),
    "index refresh does not erase a remove or connect notice",
  );

  const developer = readFileSync(join(process.cwd(), "../packages/product/src/components/DeveloperSourcesPanel.tsx"), "utf8");
  assert(developer.includes("isBrowserDevHost()"), "Developer Sources is gated on localhost");
  assert(developer.includes("Load demo data"), "localhost can load demo data");
  assert(!isBrowserDevHost(), "this check process is not treated as production browser host");
}

runSourcesCapabilityMatrixCheck();
console.log("SOURCES-CAPABILITY-MATRIX-001 check passed");
