/**
 * BROWSER-CAPABILITY-DIALOGS-001
 * Classifies notices. Does not open the operating-system folder picker.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDesktopDownloadOffer } from "@suhuella/product/lib/desktop-download-cta.ts";
import {
  browserCapabilityDialogCopy,
  presentOrganiseLimitation,
  presentUnimplemented,
} from "@suhuella/product/lib/browser-capability-notice.ts";
import {
  COPY_UNVERIFIED_REASON,
  CROSS_SOURCE_REASON,
  PARTIAL_DELETE_REASON,
  PERMISSION_REASON,
  UNCERTAIN_NOTE,
} from "@suhuella/product/host/browser/organise-integrity.ts";
import { presentFolderConnectError } from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function codeError(code: string, message = code): Error {
  return Object.assign(new Error(message), { code, name: code === "abort" ? "AbortError" : "Error" });
}

const dialogSource = readFileSync(
  join(process.cwd(), "../packages/product/src/components/BrowserFolderConnectDialog.tsx"),
  "utf8",
);
const sourcesSource = readFileSync(
  join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"),
  "utf8",
);
const organiseSource = readFileSync(
  join(process.cwd(), "../packages/product/src/components/OrganisePanel.tsx"),
  "utf8",
);
const settingsSource = readFileSync(
  join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"),
  "utf8",
);

const limited = presentFolderConnectError(codeError("protected", "This folder is not available in this browser."));
assert(limited.kind === "desktop_dialog" && limited.notice.id === "protected_folder", "limited folder opens the desktop dialog");
assert(limited.kind === "desktop_dialog" && limited.notice.primary === "Choose subfolder", "subfolder stays available");
assert(limited.kind === "desktop_dialog" && limited.notice.offerDesktop, "desktop download is offered for a blocked folder");

const aborted = presentFolderConnectError(Object.assign(new Error("The user aborted a request."), { name: "AbortError" }));
assert(aborted.kind === "silent", "cancelling the picker stays silent");

const denied = presentFolderConnectError(codeError("denied", "Folder permission was not granted."));
assert(denied.kind === "desktop_dialog" && denied.notice.id === "permission_denied", "denied permission opens the retry dialog");
assert(
  denied.kind === "desktop_dialog" && denied.notice.primary === "Choose folder again" && denied.notice.offerDesktop,
  "denied permission offers retry and desktop",
);
assert(
  denied.kind === "desktop_dialog" && !denied.notice.body.toLowerCase().includes("every function"),
  "denied permission does not promise every function",
);

const unsupported = presentFolderConnectError(codeError("unsupported", "Folder access is not available in this browser."));
assert(
  unsupported.kind === "desktop_dialog" && unsupported.notice.id === "browser_unsupported",
  "unsupported browser opens the desktop dialog",
);
assert(
  unsupported.kind === "desktop_dialog" && unsupported.notice.primary === null && unsupported.notice.offerDesktop,
  "unsupported browser does not fake a folder picker",
);

const compatible = presentFolderConnectError(codeError("failed"));
assert(compatible.kind === "inline", "a normal open failure is not the desktop dialog");

const desktopHost = presentFolderConnectError(codeError("protected"), "electron");
assert(desktopHost.kind === "silent", "desktop does not show the browser-only dialog");

const noWrite = presentOrganiseLimitation({ host: "browser", canWrite: false, locale: "en" });
assert(noWrite.kind === "desktop_dialog" && noWrite.notice.id === "no_write_support", "confirm without write explains the limit");
assert(noWrite.kind === "desktop_dialog" && noWrite.notice.primary === "Keep preparing the plan", "the plan can stay open");

const cross = presentOrganiseLimitation({ host: "browser", skipReasons: [CROSS_SOURCE_REASON], locale: "es" });
assert(cross.kind === "desktop_dialog" && cross.notice.id === "cross_source", "cross-source explains desktop");
assert(
  cross.kind === "desktop_dialog" && cross.notice.body.includes("nube") && cross.notice.body.includes("mismo disco"),
  "cross-source states the desktop limits",
);

const permission = presentOrganiseLimitation({ host: "browser", skipReasons: [PERMISSION_REASON], locale: "en" });
assert(permission.kind === "desktop_dialog" && permission.notice.id === "permission_denied", "write permission opens the retry dialog");
assert(
  permission.kind === "desktop_dialog" && permission.notice.primary === "Keep preparing the plan",
  "organise permission keeps the plan open",
);

for (const reason of [UNCERTAIN_NOTE, PARTIAL_DELETE_REASON, COPY_UNVERIFIED_REASON]) {
  const partial = presentOrganiseLimitation({ host: "browser", skipReasons: [reason] });
  assert(partial.kind === "silent", `partial or uncertain stays a recovery record: ${reason}`);
}

const cloud = presentUnimplemented("en");
assert(cloud.kind === "inline" && !cloud.message.toLowerCase().includes("desktop"), "unimplemented work does not offer desktop");

const spanish = browserCapabilityDialogCopy("protected_folder", "es", "SuHuella");
const english = browserCapabilityDialogCopy("protected_folder", "en", "DbaseNet");
assert(spanish.title.includes("SuHuella Desktop"), "Spanish title uses the active brand");
assert(english.title.includes("DbaseNet Desktop"), "English title uses the active brand");
assert(spanish.secondary === "Ahora no" && english.secondary === "Not now", "dismiss copy is localized");
assert(spanish.body.includes("subcarpeta") && spanish.body.includes("permisos de tu sistema"), "Spanish copy explains the browser limit");
assert(english.body.includes("subfolder") && english.body.includes("system permissions"), "English copy explains the browser limit");
assert(!spanish.body.toLowerCase().includes("licencia") && !english.body.toLowerCase().includes("license"), "capability copy does not turn into a license pitch");
assert(!spanish.body.toLowerCase().includes("todas las funciones"), "Spanish copy does not promise every feature");
assert(!english.body.toLowerCase().includes("every function"), "English copy does not promise every feature");

const mac = buildDesktopDownloadOffer({ mac: "https://example.test/mac", windows: "" }, "mac");
const windows = buildDesktopDownloadOffer({ mac: "", windows: "https://example.test/win" }, "windows");
const missing = buildDesktopDownloadOffer({ mac: "", windows: "" }, "mac");
const phone = buildDesktopDownloadOffer({ mac: "https://example.test/mac", windows: "https://example.test/win" }, "unknown");
assert(mac?.label === "Download for Mac" && mac.href.includes("platform=mac"), "Mac gets the Mac offer");
assert(windows?.label === "Download for Windows" && windows.href.includes("platform=windows"), "Windows gets the Windows offer");
assert(missing === null, "a missing build does not invent an installer");
assert(phone?.href === "/download", "an unknown system goes to the options page, not a binary");

assert(dialogSource.includes('role="dialog"') && dialogSource.includes('aria-modal="true"'), "dialog is modal");
assert(dialogSource.includes("Escape") && dialogSource.includes("previous?.focus()"), "Escape closes and focus returns");
assert(sourcesSource.includes("onLimitedSystemFolder"), "a limited source opens the notice instead of failing silently");
assert(organiseSource.includes("browserCapabilityDialogCopy('no_write_support'"), "confirm without write opens the notice");
assert(organiseSource.includes("setCapabilityNotice(null)"), "closing the notice does not clear the plan by itself");
assert(settingsSource.includes("appInfo.host === 'browser' && capabilityNotice"), "desktop does not mount the browser notice");
assert(!settingsSource.includes("isFolderPickAbort(error) || isProtectedFolderConnectError"), "cancel no longer opens the download dialog");

console.log("BROWSER-CAPABILITY-DIALOGS-001 checks passed");
