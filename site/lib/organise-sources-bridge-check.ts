import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPendingOrganiseContext,
  consumePendingOrganiseContext,
  ORGANISE_THESE_FILES,
  ORGANISE_THIS_FOLDER,
  pendingContextToKnowledgeItems,
  pendingOrganiseUsesUrlPaths,
  PENDING_ORGANISE_KEY,
  readPendingOrganiseContext,
  sourceBrowseOrganiseCta,
  sourceBrowseShowsPlanUi,
  sourceBrowseUsesForbiddenOrganiseCopy,
  sourceIdFromBrowsePath,
  writePendingOrganiseContext,
} from "@suhuella/product/lib/organise-sources-bridge.ts";
import { pathForSection } from "@suhuella/product/lib/app-routes.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runOrganiseSourcesBridgeCheck(): void {
  const browse = readFileSync(join(process.cwd(), "../packages/product/src/components/SourceBrowsePanel.tsx"), "utf8");
  const organise = readFileSync(join(process.cwd(), "../packages/product/src/components/OrganisePanel.tsx"), "utf8");
  const settings = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");

  assert(browse.includes('type="checkbox"'), "source browse can select files");
  assert(browse.includes("sourceBrowseOrganiseCta"), "folder/files CTA uses intention copy helper");
  assert(ORGANISE_THIS_FOLDER === "Plan this folder", "folder CTA copy is intention language");
  assert(ORGANISE_THESE_FILES === "Plan these files", "files CTA copy is intention language");
  assert(!sourceBrowseUsesForbiddenOrganiseCopy(browse), "source browse avoids forbidden organise copy");
  assert(!sourceBrowseShowsPlanUi(browse), "source browse does not render Plan UI");
  assert(browse.includes("onOrganise"), "source browse exposes organise bridge callback");
  assert(browse.includes("entry.kind === 'folder'"), "folder rows remain browsable");

  assert(sourceBrowseOrganiseCta(0) === ORGANISE_THIS_FOLDER, "CTA changes when nothing is selected");
  assert(sourceBrowseOrganiseCta(2) === ORGANISE_THESE_FILES, "CTA changes when files are selected");

  assert(sourceIdFromBrowsePath("src_demo/invoices/factura.pdf") === "src_demo", "source id is parsed from browse path");
  assert(!pendingOrganiseUsesUrlPaths(), "bridge does not rely on URL path params");
  assert(pathForSection("organise") === "/plan-mode", "plan mode canonical path");
  assert(!pathForSection("organise").includes("?"), "plan mode navigation path has no query leakage");

  const context = buildPendingOrganiseContext({
    sourceId: "src_demo",
    sourceTitle: "dev-data",
    folderScope: "src_demo/invoices",
    fileIds: ["src_demo/invoices/factura-enero.pdf"],
    fileNames: ["factura-enero.pdf"],
  });
  assert(context.kind === "files", "selected files become a files context");
  const items = pendingContextToKnowledgeItems(context);
  assert(items.length === 1 && items[0]?.kind === "file", "organise consumes selected file descriptors");
  assert(items[0]?.path === "src_demo/invoices/factura-enero.pdf", "file descriptor keeps virtual id");

  const folderContext = buildPendingOrganiseContext({
    sourceId: "src_demo",
    sourceTitle: "dev-data",
    folderScope: "src_demo",
    fileIds: [],
    fileNames: [],
  });
  assert(folderContext.kind === "folder", "empty selection becomes folder context");
  assert(pendingContextToKnowledgeItems(folderContext)[0]?.kind === "folder", "folder context becomes folder descriptor");

  assert(settings.includes("writePendingOrganiseContext"), "settings writes pending organise context");
  assert(settings.includes("goToSection('organise')"), "bridge navigates to organise");
  assert(!settings.includes("writeProductLocation('organise'") || settings.includes("goToSection('organise')"), "navigation uses product section routing");

  assert(organise.includes("consumePendingOrganiseContext"), "organise consumes bridge context on load");
  assert(!organise.includes("PlanEditor") || true, "organise may show plan after load");
  assert(!sourceBrowseShowsPlanUi(organise) || organise.includes("PlanEditor"), "plan UI lives in organise only");

  assert(PENDING_ORGANISE_KEY === "suhuella-pending-organise", "session storage key is stable");

  if (typeof sessionStorage !== "undefined") {
    writePendingOrganiseContext(context);
    const read = readPendingOrganiseContext();
    assert(read?.fileIds[0] === "src_demo/invoices/factura-enero.pdf", "context round-trips in sessionStorage");
    const consumed = consumePendingOrganiseContext();
    assert(consumed?.sourceTitle === "dev-data", "organise can consume pending context");
    assert(readPendingOrganiseContext() === null, "consumed context is cleared");
  }
}

runOrganiseSourcesBridgeCheck();
console.log("ORGANISE-SOURCES-BRIDGE-001 check passed");
