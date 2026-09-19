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
  sourceSightLabel,
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

  const panel = readFileSync(join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"), "utf8");
  assert(panel.includes("browserCapabilityCatalog"), "Sources renders the browser capability catalog");
  assert(panel.includes("browserConnectFolderLabel"), "Sources renders Connect folder");
  assert(!panel.includes("browserSystemFoldersLabel"), "system folders live under Local, not a separate section");
  assert(panel.includes('sight="limited"'), "system folders use limited, not fake Available");
  assert(panel.includes("browserChooseSubfolderLabel"), "limited folders offer Choose subfolder");
  assert(panel.includes("onAction={onAdd}"), "Choose subfolder opens the normal folder flow");
  assert(panel.includes('sight="coming_later"'), "cloud without connector is coming later");
  assert(!panel.includes("onAction={() => onAddSuggested(card.path)}"), "limited cards do not start a fake system-folder connect");
  assert(panel.includes("event.stopPropagation()"), "Remove stops the card click");
  assert(!panel.includes("sm:opacity-0 sm:group-hover:opacity-100"), "Remove is not hover-hidden");

  const settings = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settings.includes("indexWaitGeneration"), "remove is not overwritten by a stale index poll");
  assert(settings.includes("dismissedSourcePaths"), "removed sources stay dismissed after index refresh");
  assert(settings.includes("current.filter((item) => item.path !== location)"), "remove updates the list immediately");

  const developer = readFileSync(join(process.cwd(), "../packages/product/src/components/DeveloperSourcesPanel.tsx"), "utf8");
  assert(developer.includes("isBrowserDevHost()"), "Developer Sources is gated on localhost");
  assert(developer.includes("Load demo data"), "localhost can load demo data");
  assert(!isBrowserDevHost(), "this check process is not treated as production browser host");
}

runSourcesCapabilityMatrixCheck();
console.log("SOURCES-CAPABILITY-MATRIX-001 check passed");
