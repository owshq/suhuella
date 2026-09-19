import type {
  IndexedFolderEntry,
  WebActivityRun,
  WebIndexedFile,
  WebKnowledgeSource,
  WebWorkflow,
} from "./types";
import type { SearchDocumentFilter } from "../../types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "tif", "tiff", "bmp", "svg"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);

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
  return value
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .filter((token) => token.length >= 2);
}

function matches(haystack: string, query: string): boolean {
  const hay = haystack.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (hay.includes(q)) return true;
  const queryTokens = tokens(q);
  if (queryTokens.length === 0) return false;
  return queryTokens.every((token) => hay.includes(token));
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

  for (const file of input.files) {
    if (matches(`${file.name} ${file.relativePath}`, query)) {
      const sourceName = input.sources.find((source) => source.id === file.sourceId)?.name;
      hits.push({
        id: file.id,
        kind: "file",
        title: file.name,
        subtitle: sourceName || file.relativePath,
      });
    }
    if (hits.length >= 24) break;
  }

  for (const folder of input.folders ?? []) {
    if (matches(`${folder.folderName} ${folder.relativePath}`, query)) {
      hits.push({
        id: folder.id,
        kind: "folder",
        title: folder.folderName,
        subtitle: folder.relativePath === "." ? folder.name : folder.relativePath,
      });
    }
    if (hits.length >= 32) break;
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

  return hits.slice(0, 40);
}
