import type { KnowledgeDescriptor, KnowledgeOrigin } from "./types";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function descriptorDisplayName(descriptor: KnowledgeDescriptor): string {
  return descriptor.suggestedName.trim() || descriptor.displayName.trim();
}

function descriptorId(origin: KnowledgeOrigin, displayName: string, locator: string): string {
  const raw = `${origin}:${locator || displayName}`;
  return `kd_${btoa(unescape(encodeURIComponent(raw))).replace(/[+/=]/g, "")}`;
}

export function describeLocalFile(displayName: string, locator: string): KnowledgeDescriptor {
  const extension = extensionOf(displayName);
  return {
    id: descriptorId("local_file", displayName, locator),
    kind: "file",
    source: "local_folder",
    origin: "local_file",
    displayName,
    suggestedName: displayName,
    mimeType: extension ? (MIME_BY_EXTENSION[extension] ?? null) : null,
    language: [],
    entities: [],
    dates: [],
    topics: [],
    hints: [],
    metadata: { filePath: locator },
  };
}
