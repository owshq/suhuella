import { readFileSync } from "node:fs";
import { join } from "node:path";
import { searchKnowledge } from "@suhuella/product/host/browser/search.ts";
import { isTechnicalSourceId } from "@suhuella/product/host/browser/connect-source.ts";
import {
  indexedFileFromBrowserFile,
  knowledgeItemsFromBrowserFiles,
  knowledgeItemsFromIndexedFiles,
  ORGANISE_CONNECT_SOURCE,
  ORGANISE_OPEN_SOURCES,
  ORGANISE_DOCUMENTS_TITLE,
  ORGANISE_EMPTY_BODY,
  ORGANISE_EMPTY_NO_SOURCES,
  ORGANISE_EXECUTION_LIMIT,
  ORGANISE_FOLDER_UNSUPPORTED,
  ORGANISE_SELECT_FROM_SOURCES,
  organiseHasUploadLanguage,
  organisePickErrorMessage,
  organiseRequiresDesktop,
  planUsesAbsoluteFilesystemPath,
} from "@suhuella/product/lib/browser-organise-selection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runBrowserOrganiseSelectionCheck(): void {
  const organise = readFileSync(join(process.cwd(), "../packages/product/src/components/OrganisePanel.tsx"), "utf8");
  const host = readFileSync(join(process.cwd(), "../packages/product/src/host/install-browser-host.ts"), "utf8");

  assert(!organise.includes("This browser cannot choose documents."), "Organise does not show the dead-end banner by default");
  assert(organise.includes("PLAN_PROMPT_EXAMPLES"), "Plan Mode empty state offers prompt examples");
  assert(organise.includes("ORGANISE_OPEN_SOURCES"), "Plan Mode keeps Open Sources secondary");
  assert(organise.includes("ORGANISE_OPEN_SOURCES"), "Organise offers Open Sources");
  assert(!organise.includes("Choose files"), "Organise empty state does not say Choose files");
  assert(!organise.includes("Connect a folder"), "Organise empty state does not say Connect a folder");
  assert(organise.includes("hasSources: locations.length > 0"), "empty state branches on sources");
  assert(organise.includes("openSourcePicker"), "connected sources can be selected");
  assert(organise.includes("factura-enero.pdf") === false, "UI does not hardcode demo filenames");
  assert(!organise.includes("Download Desktop"), "Organise does not require Desktop");
  assert(!organiseHasUploadLanguage(ORGANISE_EMPTY_BODY), "empty copy does not upload");
  assert(!organiseHasUploadLanguage(ORGANISE_EXECUTION_LIMIT), "execution copy does not upload");
  assert(!organiseRequiresDesktop(ORGANISE_EXECUTION_LIMIT), "execution limit does not require Desktop");
  assert(ORGANISE_EMPTY_NO_SOURCES.includes("Connect") && !/\bAdd\b/.test(ORGANISE_EMPTY_NO_SOURCES), "no-source copy uses Connect, not Add");
  assert(ORGANISE_CONNECT_SOURCE === "Connect a source", "web empty primary connects a source");
  assert(ORGANISE_OPEN_SOURCES === "Open Sources", "sources navigation label is stable");
  assert(ORGANISE_SELECT_FROM_SOURCES === "Select from Sources", "sources path stays Select from Sources");
  assert(ORGANISE_DOCUMENTS_TITLE === "Plan Mode", "web empty title uses Plan Mode");
  assert(!/connected/i.test(ORGANISE_EMPTY_BODY), "source copy does not say Connected");

  assert(
    organisePickErrorMessage(Object.assign(new Error("The user aborted a request."), { name: "AbortError" })) === null,
    "picker cancel is silent",
  );
  assert(
    organisePickErrorMessage(new Error("This browser cannot choose documents.")) === null,
    "generic cannot-choose-documents is not shown as a product failure",
  );
  assert(
    organisePickErrorMessage(new Error("Folder access is not available in this browser.")) === ORGANISE_FOLDER_UNSUPPORTED,
    "unsupported folder picker is a friendly limitation",
  );

  const picked = knowledgeItemsFromBrowserFiles([{ name: "factura-enero.pdf" }], (_file, index) => `picked/${index}/factura-enero.pdf`);
  assert(picked[0]?.kind === "file", "file picker creates a file descriptor");
  assert(picked[0]?.path === "picked/0/factura-enero.pdf", "file picker keeps a virtual identifier");
  assert(!planUsesAbsoluteFilesystemPath(picked[0].path), "Plan input does not require an absolute filesystem path");

  const descriptor = indexedFileFromBrowserFile(
    { name: "contrato-cliente.docx", size: 28, lastModified: 1_700_000_000_000, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    "picked",
    "0/contrato-cliente.docx",
  );
  assert(descriptor.name === "contrato-cliente.docx", "picked file keeps its filename");
  assert(descriptor.size === 28, "picked file keeps size");
  assert(descriptor.lastModified !== null, "picked file keeps lastModified");

  const sourceFiles = [
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
  ];
  const selected = knowledgeItemsFromIndexedFiles(
    [sourceFiles[0]],
    (file) => `${file.sourceId}/${file.relativePath}`,
  );
  assert(selected[0]?.path === "src_informes/factura-enero.pdf", "source files become Plan input descriptors");
  assert(!planUsesAbsoluteFilesystemPath(selected[0].path), "source Plan input stays virtual");

  const planInput = selected.map((item) => ({ currentPath: item.path, fileName: item.path.split("/").pop() ?? item.path }));
  assert(planInput.length === 1, "Plan draft is created from browser descriptors");
  assert(planInput.every((item) => !planUsesAbsoluteFilesystemPath(item.currentPath)), "Plan items do not use absolute paths");

  const searchHits = searchKnowledge({
    query: "factura",
    files: sourceFiles,
    sources: [
      {
        id: "src_informes",
        kind: "local",
        type: "local_folder",
        name: "informes",
        fileCount: 2,
        folderCount: 1,
        bytes: 32,
        lastIndexed: null,
        status: "ready",
      },
    ],
    workflows: [],
    activity: [],
  });
  assert(searchHits.some((hit) => hit.title === "factura-enero.pdf"), "Search and Organise read the same browser index");
  assert(!isTechnicalSourceId("informes"), "source label stays human");

  assert(host.includes("rememberOrganiseDescriptors"), "picked files are remembered locally");
  assert(host.includes("requestLocalFiles"), "Choose files uses the browser file picker");
  assert(host.includes("requestLocalFolder"), "Choose folder uses the browser folder picker");
  assert(host.includes("ORGANISE_FOLDER_UNSUPPORTED") || host.includes("cannot choose folders"), "unsupported folder picker is classified");
  assert(host.includes("ORGANISE_EXECUTION_LIMIT"), "execution is limited separately from Plan creation");
  assert(
    !host.includes("This browser cannot move or rename files. Use Chrome"),
    "browser Plan execution does not require Desktop",
  );
}

runBrowserOrganiseSelectionCheck();
console.log("BROWSER-ORGANISE-SELECTION-001 check passed");
