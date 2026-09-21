import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOST_ACCESS_PROFILES, hostAccessFor } from "@suhuella/product/lib/platform-capabilities.ts";
import { sourceRecommendedAction } from "@suhuella/product/lib/source-actions.ts";
import { sourceCapabilities } from "@suhuella/product/lib/source-capabilities.ts";
import { buildSourcePresentation } from "@suhuella/product/lib/source-presentation.ts";
import { hostCapabilityCatalog, searchNoSourcesCopy, sourcePickActionLabel } from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function runSourcePlatformReadinessCheck(): void {
  const electron = hostAccessFor("electron");
  const browser = hostAccessFor("browser");
  const ios = hostAccessFor("ios");
  const android = hostAccessFor("android");

  assert(electron.connectGrant === false, "Desktop Adds folders the OS already sees");
  assert(electron.filesystemAvailability, "Desktop already sees local folders");
  assert(electron.directoryCatalog, "Desktop shows Available from the OS catalog");
  assert(electron.permanentPermissions, "Desktop permissions survive restart");
  assert(electron.backgroundIndexing, "Desktop may index in the background");
  assert(electron.synchronousAccess, "Desktop may walk the tree synchronously");
  assert(electron.largeLocalStorage, "Desktop may keep a large local index");
  assert(!electron.folderWatching, "folder watching stays reserved");
  assert(!electron.limitedSystemFolders, "Desktop does not show Limited in browser");
  assert(electron.saveAsOverlay, "Desktop keeps the Save As overlay");

  assert(browser.connectGrant, "Web asks the user to Connect");
  assert(!browser.filesystemAvailability, "Web does not see folders until a grant");
  assert(!browser.directoryCatalog, "Web does not list OS Available folders");
  assert(browser.limitedSystemFolders, "Web marks system folders Limited in browser");
  assert(browser.ephemeralPicker, "Web may have a one-shot picker");
  assert(!browser.backgroundIndexing, "Web does not assume background indexing");
  assert(!browser.permanentPermissions, "Web does not assume permanent permission");
  assert(!browser.synchronousAccess, "Web access is async");
  assert(!browser.largeLocalStorage, "Web does not assume large local storage");
  assert(browser.organiseFromIndexedSources, "Web Organise can pick from indexed sources");
  assert(!browser.saveAsOverlay, "Web has no Save As overlay");

  assert(ios.connectGrant, "iOS asks the user to Connect");
  assert(ios.scopedDocuments, "iOS uses a scoped document picker");
  assert(!ios.persistentHandles, "iOS does not persist directory handles");
  assert(!ios.filesystemAvailability, "iOS does not assume a local filesystem");
  assert(!ios.folderWatching, "iOS does not watch folders");
  assert(!ios.limitedSystemFolders, "iOS does not inherit Chrome Limited cards");
  assert(!ios.directoryCatalog, "iOS has no Desktop Available catalog");
  assert(ios.organiseFromIndexedSources, "iOS Organise can pick from indexed sources");

  assert(android.connectGrant, "Android asks the user to Connect");
  assert(android.persistentHandles, "Android SAF can persist a URI");
  assert(android.scopedDocuments, "Android uses scoped documents");
  assert(!android.filesystemAvailability, "Android does not assume Desktop folders");
  assert(!android.folderWatching, "Android does not watch folders");
  assert(!android.limitedSystemFolders, "Android does not inherit Chrome Limited cards");

  assert(
    sourceRecommendedAction("unavailable", null, electron) === "retry",
    "Desktop unavailable recommends retry from connectGrant",
  );
  assert(
    sourceRecommendedAction("unavailable", null, browser) === "restore_permission",
    "Web unavailable recommends restore_permission from connectGrant",
  );
  assert(
    sourceRecommendedAction("unavailable", null, ios) === "restore_permission",
    "iOS unavailable uses the same grant action as Web",
  );
  assert(
    sourceRecommendedAction("unavailable", null, android) === "restore_permission",
    "Android unavailable uses the same grant action as Web",
  );
  assert(sourceRecommendedAction("missing") === "locate_folder", "missing still locates");
  assert(
    sourceRecommendedAction("unavailable", "disk_offline", browser) === "retry",
    "health observation wins over host grant when the disk is offline",
  );
  assert(
    sourceRecommendedAction("unavailable", "folder_moved") === "locate_folder",
    "moved folder locates again on every platform",
  );

  assert(sourceCapabilities("indexed", electron).openable, "indexed sources stay openable");
  assert(sourceCapabilities("indexed", electron).organisable, "indexed sources stay organisable");
  assert(sourceCapabilities("unavailable", ios).searchable, "documents stay searchable without a filesystem");
  assert(!sourceCapabilities("unavailable", ios).openable, "unavailable is not openable on iOS");
  assert(!sourceCapabilities("indexed", electron).watchable, "watchable follows folderWatching");
  assert(
    sourceCapabilities("indexed", { folderWatching: true }).watchable,
    "watchable becomes true only when the host declares it",
  );

  assert(sourcePickActionLabel(electron) === "Add", "Desktop CTA stays Add");
  assert(sourcePickActionLabel(browser) === "Connect", "Web CTA stays Connect");
  assert(sourcePickActionLabel(ios) === "Connect", "iOS CTA is Connect, never Add");
  assert(searchNoSourcesCopy(electron) === "Add a folder first.", "Desktop Search empty state uses Add");
  assert(searchNoSourcesCopy(browser) === "Connect a folder first.", "Web Search empty state uses Connect");
  assert(searchNoSourcesCopy(ios) === "Connect a folder first.", "iOS Search empty state uses Connect");
  const searchPanel = source("../packages/product/src/components/SearchPanel.tsx");
  assert(searchPanel.includes("searchNoSourcesCopy"), "Search empty state asks connectGrant, not a hardcoded Connect");
  assert(searchPanel.includes("hostAccessFor"), "Search empty state uses host access capabilities");
  assert(!searchPanel.includes("'Connect a folder first.'"), "Search no longer hardcodes Connect for every host");
  const homeCopy = source("../packages/product/src/host/capabilities.ts");
  assert(homeCopy.includes("connectGrant"), "Home empty line asks connectGrant, not host kind");
  assert(homeCopy.includes("Connect a source to begin"), "Web empty line is unchanged");
  assert(homeCopy.includes("Add a source to begin"), "Desktop empty line is unchanged");
  assert(!/args\.host === ['"]browser['"]/.test(homeCopy), "homeKnowledgeLine no longer branches on host");

  const browserCatalog = hostCapabilityCatalog(browser, "darwin");
  const electronCatalog = hostCapabilityCatalog(electron, "darwin");
  const iosCatalog = hostCapabilityCatalog(ios, "darwin");
  assert(
    browserCatalog.some((card) => card.capability === "limited" && card.label === "Documents"),
    "Web still shows Limited Documents",
  );
  assert(
    browserCatalog.some((card) => card.capability === "coming_later" && card.label === "Google Drive"),
    "Web still shows Coming later cloud",
  );
  assert(electronCatalog.length === 0, "Desktop catalog stays empty here — Available comes from the OS");
  assert(
    !iosCatalog.some((card) => card.capability === "limited"),
    "iOS does not inherit Limited in browser",
  );
  assert(
    iosCatalog.some((card) => card.capability === "coming_later"),
    "iOS can still show Coming later cloud",
  );

  const desktopUnavailable = buildSourcePresentation({
    id: "src_desk",
    displayName: "Facturas 2026",
    locationStatus: "unavailable",
    documentCount: 12,
    access: electron,
  });
  assert(desktopUnavailable.actions.includes("retry"), "Desktop presentation recommends retry");
  assert(!desktopUnavailable.capabilities.watchable, "presentation watchable follows host access");

  const webUnavailable = buildSourcePresentation({
    id: "src_web",
    displayName: "Facturas 2026",
    locationStatus: "unavailable",
    documentCount: 12,
    access: browser,
  });
  assert(webUnavailable.actions.includes("restore_permission"), "Web presentation recommends restore");

  const kinds = Object.keys(HOST_ACCESS_PROFILES);
  assert(kinds.includes("electron") && kinds.includes("browser"), "current hosts have profiles");
  assert(kinds.includes("ios") && kinds.includes("android"), "mobile profiles are reserved");

  const domainFiles = [
    "../packages/product/src/lib/source-actions.ts",
    "../packages/product/src/lib/source-capabilities.ts",
    "../packages/product/src/lib/source-presentation.ts",
    "../packages/product/src/lib/platform-capabilities.ts",
  ];
  for (const file of domainFiles) {
    const text = source(file);
    assert(!text.includes("if (browserHandle)"), `${file} does not branch on browserHandle`);
    assert(!text.includes("FileSystemDirectoryHandle"), `${file} does not assume a browser handle`);
    assert(!/\bhandle\.kind\s*===/.test(text), `${file} does not switch on handle.kind`);
    if (!file.endsWith("platform-capabilities.ts")) {
      assert(!text.includes('host === "browser"'), `${file} does not branch on host kind`);
      assert(!text.includes("host === 'browser'"), `${file} does not branch on host kind`);
    }
  }
  const platformModule = source("../packages/product/src/lib/platform-capabilities.ts");
  assert(
    platformModule.includes("HOST_ACCESS_PROFILES"),
    "only the platform module maps host kind to a profile",
  );

  const actions = source("../packages/product/src/lib/source-actions.ts");
  assert(!actions.includes("browser ?"), "recommended action no longer branches on a browser boolean");
  assert(actions.includes("connectGrant"), "recommended action asks connectGrant");

  const home = source("../packages/product/src/components/HomePanel.tsx");
  assert(home.includes("hostAccessFor"), "Home asks host access capabilities");
  assert(!home.includes("host === 'browser'"), "Home does not branch on host kind");

  const sources = source("../packages/product/src/components/SourcesPanel.tsx");
  assert(sources.includes("hostAccessFor"), "Sources asks host access capabilities");
  assert(sources.includes("hostCapabilityCatalog"), "Sources catalog is capability filtered");
  assert(!sources.includes("host === 'browser'"), "Sources does not branch on host kind");

  const organise = source("../packages/product/src/components/OrganisePanel.tsx");
  assert(organise.includes("hostAccessFor"), "Organise asks host access capabilities");
  assert(organise.includes("organiseFromIndexedSources"), "Organise selection is capability driven");
  assert(!organise.includes("host === 'browser'"), "Organise does not branch on host kind");
  assert(!organise.includes("const isWeb"), "Organise no longer aliases the host as isWeb");

  const capabilities = source("../packages/product/src/lib/source-capabilities.ts");
  assert(capabilities.includes("folderWatching"), "source watchable is derived from host access");

  const doc = source("../SOURCE-PLATFORM-READINESS-001.md");
  assert(doc.includes("STATUS = CLOSED"), "track is closed");
  assert(doc.includes("No mobile UI"), "track forbids implementing mobile");
  assert(doc.includes("connectGrant"), "track names the grant capability");

  console.log("SOURCE-PLATFORM-READINESS-001 check passed");
}

runSourcePlatformReadinessCheck();
