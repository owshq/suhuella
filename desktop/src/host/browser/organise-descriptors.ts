import type { IndexedFolderEntry, WebIndexedFile } from "./types";

let transientFiles: WebIndexedFile[] = [];
let transientFolders: IndexedFolderEntry[] = [];

export function rememberOrganiseDescriptors(files: WebIndexedFile[], folders: IndexedFolderEntry[] = []): void {
  const nextFiles = new Map(transientFiles.map((file) => [file.id, file]));
  for (const file of files) nextFiles.set(file.id, file);
  transientFiles = [...nextFiles.values()];

  const nextFolders = new Map(transientFolders.map((folder) => [folder.id, folder]));
  for (const folder of folders) nextFolders.set(folder.id, folder);
  transientFolders = [...nextFolders.values()];
}

export function listOrganiseDescriptors(): { files: WebIndexedFile[]; folders: IndexedFolderEntry[] } {
  return { files: transientFiles, folders: transientFolders };
}

export function clearOrganiseDescriptors(): void {
  transientFiles = [];
  transientFolders = [];
}
