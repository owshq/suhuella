export const DEV_DEMO_HINT = "suhuella:dev-demo";
export const DEV_DEMO_SOURCE_ID = "src_dev_demo";
export const DEV_DEMO_DISPLAY_NAME = "dev-data";

export type DevDemoFile = {
  name: string;
  relativePath: string;
  size: number;
};

export const DEV_DEMO_FILES: readonly DevDemoFile[] = [
  { name: "factura-enero.pdf", relativePath: "invoices/factura-enero.pdf", size: 24 },
  { name: "factura-febrero.pdf", relativePath: "invoices/factura-febrero.pdf", size: 24 },
  { name: "contrato-cliente.docx", relativePath: "contracts/contrato-cliente.docx", size: 28 },
  { name: "captura-yala.png", relativePath: "pictures/captura-yala.png", size: 32 },
  { name: "nota-reunion.txt", relativePath: "mixed/nota-reunion.txt", size: 18 },
];

export function isBrowserDevHost(hostname?: string): boolean {
  const host =
    hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function isDevDemoHint(hint?: string): boolean {
  return hint === DEV_DEMO_HINT;
}

export function demoFileDescriptors(sourceId = DEV_DEMO_SOURCE_ID): Array<{
  id: string;
  sourceId: string;
  name: string;
  relativePath: string;
  parentRelative: string;
  size: number;
  lastModified: string | null;
}> {
  return DEV_DEMO_FILES.map((file) => ({
    id: `${sourceId}:${file.relativePath}`,
    sourceId,
    name: file.name,
    relativePath: file.relativePath,
    parentRelative: file.relativePath.includes("/")
      ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
      : "",
    size: file.size,
    lastModified: null,
  }));
}

export function demoFolderDescriptors(sourceId = DEV_DEMO_SOURCE_ID) {
  const folders = new Map<string, { relativePath: string; name: string; depth: number }>();
  folders.set("", { relativePath: ".", name: DEV_DEMO_DISPLAY_NAME, depth: 0 });
  for (const file of DEV_DEMO_FILES) {
    const parent = file.relativePath.includes("/")
      ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
      : "";
    if (parent && !folders.has(parent)) {
      folders.set(parent, {
        relativePath: parent,
        name: parent.split("/").at(-1) ?? parent,
        depth: parent.split("/").length,
      });
    }
  }
  return [...folders.values()].map((folder) => ({
    id: `${sourceId}:${folder.relativePath}`,
    sourceId,
    sourceType: "local_folder" as const,
    kind: "folder" as const,
    name: folder.name,
    locator: folder.relativePath === "." ? DEV_DEMO_DISPLAY_NAME : folder.relativePath,
    absolutePath: folder.relativePath === "." ? DEV_DEMO_DISPLAY_NAME : folder.relativePath,
    relativePath: folder.relativePath,
    folderName: folder.name,
    parentTokens: folder.relativePath === "." ? [] : folder.relativePath.split("/").slice(0, -1).map((part) => part.toLowerCase()),
    depth: folder.depth,
    extensions: DEV_DEMO_FILES.filter((file) => {
      const parent = file.relativePath.includes("/")
        ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
        : "";
      return folder.relativePath === "." || parent === folder.relativePath;
    })
      .map((file) => file.name.split(".").pop() ?? "")
      .filter(Boolean),
    fileCount: DEV_DEMO_FILES.filter((file) => {
      const parent = file.relativePath.includes("/")
        ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
        : "";
      return folder.relativePath === "." ? true : parent === folder.relativePath;
    }).length,
    fileNames: DEV_DEMO_FILES.filter((file) => {
      const parent = file.relativePath.includes("/")
        ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/"))
        : "";
      return folder.relativePath === "." || parent === folder.relativePath;
    }).map((file) => file.name),
    lastModified: null,
  }));
}
