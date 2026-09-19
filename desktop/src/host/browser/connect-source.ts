import type { IndexedLocationSummary } from "../../types";
import type { WebKnowledgeSource } from "./types";

export type ConnectTraceStep =
  | "click"
  | "picker_start"
  | "handle_returned"
  | "source_id_created"
  | "source_persisted"
  | "memory_updated"
  | "ui_should_render"
  | "scan_start"
  | "scan_progress"
  | "scan_complete"
  | "scan_failed"
  | "cancelled";

export function connectTrace(step: ConnectTraceStep, extra?: Record<string, unknown>): void {
  if (typeof console === "undefined") return;
  console.info(`[suhuella-connect] ${step}`, extra ?? {});
}

export function isTechnicalSourceId(value: string): boolean {
  return /^src_[a-z0-9]+_[a-z0-9]+$/i.test(value.trim());
}

export function humanFolderName(handleName: string | undefined, fallback = "Folder"): string {
  const name = handleName?.trim();
  if (!name || isTechnicalSourceId(name)) return fallback;
  return name;
}

export function pendingBrowserSource(input: {
  id: string;
  name: string;
  access: "persistent" | "limited";
  wellKnownToken?: string;
}): WebKnowledgeSource {
  return {
    id: input.id,
    kind: "local",
    type: "local_folder",
    name: input.name,
    fileCount: 0,
    folderCount: 0,
    bytes: 0,
    lastIndexed: null,
    status: "indexing",
    access: input.access,
    wellKnownToken: input.wellKnownToken,
  };
}

export async function commitSourceBeforeScan(input: {
  source: WebKnowledgeSource;
  persist: (source: WebKnowledgeSource) => Promise<void>;
  remember: (source: WebKnowledgeSource) => void;
  startScan: (source: WebKnowledgeSource) => void;
}): Promise<WebKnowledgeSource> {
  await input.persist(input.source);
  connectTrace("source_persisted", { id: input.source.id, name: input.source.name });
  input.remember(input.source);
  connectTrace("memory_updated", { id: input.source.id });
  connectTrace("ui_should_render", { id: input.source.id, status: input.source.status });
  input.startScan(input.source);
  connectTrace("scan_start", { id: input.source.id });
  return input.source;
}

export function homeSourceCount(sources: Array<Pick<WebKnowledgeSource, "id">>): number {
  return sources.length;
}

export function mergeLiveSources<T extends { id: string }>(
  persisted: T[],
  memory: T[] | null,
  removed: Set<string>,
): T[] {
  const livePersisted = persisted.filter((source) => !removed.has(source.id));
  if (!memory) return livePersisted;
  const persistedById = new Map(livePersisted.map((source) => [source.id, source]));
  return memory
    .filter((source) => !removed.has(source.id))
    .map((source) => ({ ...persistedById.get(source.id), ...source }));
}

export function catalogCardHidden(
  catalogPath: string,
  locations: Array<Pick<IndexedLocationSummary, "path" | "name" | "catalogKey">>,
  sameName: (left: string, right: string) => boolean,
): boolean {
  return locations.some(
    (location) =>
      location.path === catalogPath ||
      (location.catalogKey && location.catalogKey === catalogPath) ||
      sameName(location.name, catalogPath.replace(/^suhuella:/, "")),
  );
}

export function locationFromPending(source: WebKnowledgeSource): IndexedLocationSummary {
  return {
    path: source.id,
    name: source.name,
    lastIndexed: source.lastIndexed,
    folderCount: source.folderCount,
    fileCount: source.fileCount,
    status: source.status === "indexing" ? "indexing" : "ready",
    usefulness: "useful",
    exists: true,
    catalogKey: source.wellKnownToken ?? null,
  };
}
