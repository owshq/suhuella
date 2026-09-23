import type {
  IndexedFolderEntry,
  WebActivityRun,
  WebIndexedFile,
  WebKnowledgeSource,
  WebWorkflow,
} from "./types";
import type { SearchDocumentFilter } from "../../types";
import { sourceCapabilities } from "../../lib/source-capabilities.ts";
import { sourceAccessState } from "../../lib/source-host-vocabulary.ts";
import { sourceSearchUnavailableLine } from "../../lib/source-presentation.ts";
import { foldSearchText } from "../../lib/search-text.ts";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "svg"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);
const FILE_HIT_LIMIT = 24;
const FOLDER_HIT_LIMIT = 32;
const TOTAL_HIT_LIMIT = 40;

export function documentFilterForName(name: string): Exclude<SearchDocumentFilter, "all"> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (IMAGE_EXTENSIONS.has(ext)) return "images";
  if (ARCHIVE_EXTENSIONS.has(ext)) return "archives";
  return "other";
}

export type WebSearchHit = {
  id: string;
  kind: "file" | "folder" | "source" | "workflow" | "activity";
  title: string;
  subtitle: string;
};

function tokens(value: string): string[] {
  return foldSearchText(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
}

function matches(haystack: string, query: string): boolean {
  const hay = foldSearchText(haystack);
  const q = foldSearchText(query).trim();
  if (!q) return false;
  if (hay.includes(q)) return true;
  const queryTokens = tokens(q);
  if (queryTokens.length === 0) return false;
  return queryTokens.every((token) => hay.includes(token));
}

function fileBaseName(name: string): string {
  const folded = foldSearchText(name);
  const dot = folded.lastIndexOf(".");
  if (dot <= 0) return folded;
  return folded.slice(0, dot);
}

function pathDepth(relativePath: string): number {
  return relativePath.split(/[/\\]/).filter((part) => part && part !== ".").length;
}

function recencyBoost(iso: string | null): number {
  if (!iso) return 0;
  const age = Date.now() - Date.parse(iso);
  if (!Number.isFinite(age) || age < 0) return 0;
  const days = age / 86_400_000;
  if (days < 1) return 3;
  if (days < 7) return 2;
  if (days < 30) return 1;
  return 0;
}

/** Higher is better: exact name, prefix, contains, filename tokens, then path. */
export function rankBrowserFile(name: string, relativePath: string, query: string, lastModified: string | null = null): number {
  const foldedName = foldSearchText(name);
  const base = fileBaseName(name);
  const foldedPath = foldSearchText(relativePath);
  const q = foldSearchText(query).trim();
  const queryTokens = tokens(q);
  let score = 10;
  if (foldedName === q || base === q) score = 100;
  else if (foldedName.startsWith(q) || base.startsWith(q)) score = 80;
  else if (foldedName.includes(q)) score = 60;
  else if (queryTokens.length > 0 && queryTokens.every((token) => foldedName.includes(token))) score = 40;
  else if (queryTokens.some((token) => foldedName.includes(token))) score = 25;
  else if (foldedPath.includes(q) || queryTokens.some((token) => foldedPath.includes(token))) score = 20;
  return score + recencyBoost(lastModified) - Math.min(pathDepth(relativePath), 10);
}

export function searchKnowledge(input: {
  query: string;
  files: WebIndexedFile[];
  folders?: IndexedFolderEntry[];
  sources: WebKnowledgeSource[];
  workflows: WebWorkflow[];
  activity: WebActivityRun[];
}): WebSearchHit[] {
  const query = input.query.trim();
  if (!query) return [];
  const hits: WebSearchHit[] = [];

  const rankedFiles = input.files
    .map((file, index) => {
      if (!matches(`${file.name} ${file.relativePath}`, query)) return null;
      const source = input.sources.find((item) => item.id === file.sourceId);
      const sourceName = source?.name;
      const available = !source || sourceCapabilities(sourceAccessState(source.status)).openable;
      return {
        index,
        score: rankBrowserFile(file.name, file.relativePath, query, file.lastModified),
        hit: {
          id: file.id,
          kind: "file" as const,
          title: file.name,
          subtitle: available
            ? sourceName || file.relativePath
            : sourceSearchUnavailableLine(sourceName ?? "source"),
        },
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .slice(0, FILE_HIT_LIMIT);

  for (const ranked of rankedFiles) hits.push(ranked.hit);

  for (const folder of input.folders ?? []) {
    if (matches(`${folder.folderName} ${folder.relativePath}`, query)) {
      hits.push({
        id: folder.id,
        kind: "folder",
        title: folder.folderName,
        subtitle: folder.relativePath === "." ? folder.name : folder.relativePath,
      });
    }
    if (hits.length >= FOLDER_HIT_LIMIT) break;
  }

  for (const source of input.sources) {
    if (matches(source.name, query)) {
      hits.push({
        id: source.id,
        kind: "source",
        title: source.name,
        subtitle: `${source.fileCount.toLocaleString()} documents`,
      });
    }
  }

  for (const workflow of input.workflows) {
    if (matches(workflow.name, query)) {
      hits.push({
        id: workflow.id,
        kind: "workflow",
        title: workflow.name,
        subtitle: `${workflow.fileIds.length} files`,
      });
    }
  }

  for (const run of input.activity) {
    if (matches(run.message, query)) {
      hits.push({
        id: run.id,
        kind: "activity",
        title: run.message,
        subtitle: new Date(run.completedAt).toLocaleString(),
      });
    }
  }

  return hits.slice(0, TOTAL_HIT_LIMIT);
}

function rankingFile(
  name: string,
  relativePath: string,
  extras: Partial<WebIndexedFile> = {},
): WebIndexedFile {
  return {
    id: extras.id ?? relativePath,
    sourceId: extras.sourceId ?? "src",
    name,
    relativePath,
    parentRelative: extras.parentRelative ?? relativePath.split("/").slice(0, -1).join("/"),
    size: extras.size ?? 1,
    lastModified: extras.lastModified ?? null,
  };
}

export function runBrowserSearchRankingChecks(): void {
  const assert = (condition: unknown, message: string): void => {
    if (!condition) throw new Error(message);
  };
  const source = {
    id: "src",
    kind: "local" as const,
    type: "local_folder" as const,
    name: "informes",
    fileCount: 0,
    folderCount: 1,
    bytes: 0,
    lastIndexed: null,
    status: "ready" as const,
  };

  const joseFiles = [
    rankingFile("notes-garcia-old.txt", "jose/notes-garcia-old.txt"),
    rankingFile("random-jose-draft.pdf", "garcia/random-jose-draft.pdf"),
    rankingFile("Factura_José_García.pdf", "Factura_José_García.pdf"),
  ];
  const jose = searchKnowledge({
    query: "jose garcia",
    files: joseFiles,
    sources: [{ ...source, fileCount: joseFiles.length }],
    workflows: [],
    activity: [],
  });
  assert(jose[0]?.title === "Factura_José_García.pdf", "both filename tokens rank above a single-token path match");
  assert(
    jose.findIndex((hit) => hit.title === "Factura_José_García.pdf") <
      jose.findIndex((hit) => hit.title === "notes-garcia-old.txt"),
    "Factura_José_García.pdf ranks above notes-garcia-old.txt",
  );
  assert(
    jose.findIndex((hit) => hit.title === "Factura_José_García.pdf") <
      jose.findIndex((hit) => hit.title === "random-jose-draft.pdf"),
    "Factura_José_García.pdf ranks above random-jose-draft.pdf",
  );

  const invoiceFiles = [
    rankingFile("invoice-notes.txt", "folder/old/invoice-notes.txt"),
    rankingFile("Invoice_2026.pdf", "Invoice_2026.pdf"),
  ];
  const invoice = searchKnowledge({
    query: "invoice",
    files: invoiceFiles,
    sources: [{ ...source, fileCount: invoiceFiles.length }],
    workflows: [],
    activity: [],
  });
  assert(invoice[0]?.title === "Invoice_2026.pdf", "filename prefix ranks above a nested contains match");
  assert(
    invoice.findIndex((hit) => hit.title === "Invoice_2026.pdf") <
      invoice.findIndex((hit) => hit.title === "invoice-notes.txt"),
    "Invoice_2026.pdf ranks above folder/old/invoice-notes.txt",
  );

  const buried = [
    ...Array.from({ length: 24 }, (_, index) =>
      rankingFile(`scan-invoice-notes-${index}.txt`, `folder/old/scan-invoice-notes-${index}.txt`),
    ),
    rankingFile("Invoice_2026.pdf", "Invoice_2026.pdf"),
  ];
  const late = searchKnowledge({
    query: "invoice",
    files: buried,
    sources: [{ ...source, fileCount: buried.length }],
    workflows: [],
    activity: [],
  });
  assert(late[0]?.title === "Invoice_2026.pdf", "best filename match is not dropped when it is the 25th file");
  assert(late.filter((hit) => hit.kind === "file").length <= 24, "file hit limit is preserved");
}
