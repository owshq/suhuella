import type { OperationsDocument, PersistenceKind } from "./types";

export const emptyOperationsDocument = (): OperationsDocument => ({
  version: 1,
  diagnostics: [],
  audit: [],
});

function isOperationsDocument(value: unknown): value is OperationsDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<OperationsDocument>;
  return (
    record.version === 1 &&
    Array.isArray(record.diagnostics) &&
    Array.isArray(record.audit)
  );
}

export type OperationsStore = {
  persistence: PersistenceKind;
  read: () => Promise<OperationsDocument>;
  write: (document: OperationsDocument) => Promise<void>;
};

class MemoryOperationsStore implements OperationsStore {
  private document = emptyOperationsDocument();
  readonly persistence: PersistenceKind = "memory";

  async read(): Promise<OperationsDocument> {
    return structuredClone(this.document);
  }

  async write(document: OperationsDocument): Promise<void> {
    this.document = structuredClone(document);
  }
}

async function createFileStore(): Promise<OperationsStore | null> {
  if (typeof process.versions?.node !== "string") return null;

  try {
    const [{ mkdir, readFile, writeFile }, pathMod] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);

    const filePath = pathMod.join(process.cwd(), ".data", "operations-audit.json");
    let document: OperationsDocument | null = null;
    let writeQueue = Promise.resolve();

    const load = async (): Promise<OperationsDocument> => {
      if (document) return document;
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        document = isOperationsDocument(parsed)
          ? parsed
          : emptyOperationsDocument();
      } catch {
        document = emptyOperationsDocument();
      }
      return document;
    };

    return {
      persistence: "file",
      read: async () => structuredClone(await load()),
      write: async (next) => {
        writeQueue = writeQueue.then(async () => {
          document = structuredClone(next);
          await mkdir(pathMod.dirname(filePath), { recursive: true });
          await writeFile(filePath, JSON.stringify(document, null, 2), "utf8");
        });
        await writeQueue;
      },
    };
  } catch {
    return null;
  }
}

let storePromise: Promise<OperationsStore> | null = null;

async function createStore(): Promise<OperationsStore> {
  return (await createFileStore()) ?? new MemoryOperationsStore();
}

export function getOperationsStore(): Promise<OperationsStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}
