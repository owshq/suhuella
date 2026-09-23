export const UNKNOWN_SOURCE_NAME = "Unknown source";

export function isTechnicalSourceId(value: string): boolean {
  return /^src_[a-z0-9]+_[a-z0-9]+$/i.test(value.trim());
}

export function isPlaceholderFolderName(value: string | undefined): boolean {
  const name = value?.trim().toLowerCase();
  return name === "folder" || name === "carpeta" || name === "unknown folder";
}

export function usableSourceFolderName(value: string | undefined): string | undefined {
  const name = value?.trim();
  if (!name || isTechnicalSourceId(name) || isPlaceholderFolderName(name)) return undefined;
  return name;
}

/** Pure: given already-known strings, what text should the UI show? Never IO. */
export function resolveSourceDisplayName(
  ...candidates: Array<string | undefined | null>
): string {
  for (const candidate of candidates) {
    const usable = usableSourceFolderName(candidate ?? undefined);
    if (usable) return usable;
  }
  return UNKNOWN_SOURCE_NAME;
}

export function sourceNameNeedsRecovery(name: string | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  return isTechnicalSourceId(trimmed) || isPlaceholderFolderName(trimmed);
}
