import {
  NORMAL_SERVICE_HEALTH,
  normalizeServiceHealth,
  type ServiceHealthSnapshot,
  type ServiceState,
} from "./service-health.ts";

export type ServiceHealthPersistence = "d1" | "file" | "memory";

export type ServiceHealthStore = {
  readonly kind: ServiceHealthPersistence;
  read(): Promise<ServiceHealthSnapshot>;
  write(snapshot: ServiceHealthSnapshot): Promise<void>;
};

class MemoryServiceHealthStore implements ServiceHealthStore {
  readonly kind: ServiceHealthPersistence = "memory";
  private snapshot = { ...NORMAL_SERVICE_HEALTH };

  async read(): Promise<ServiceHealthSnapshot> {
    return { ...this.snapshot, affectedCapabilities: [...this.snapshot.affectedCapabilities] };
  }

  async write(snapshot: ServiceHealthSnapshot): Promise<void> {
    this.snapshot = {
      ...snapshot,
      affectedCapabilities: [...snapshot.affectedCapabilities],
    };
  }
}

function parseCapabilities(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function fromRow(row: {
  service_state?: string;
  affected_capabilities?: string;
  retry_after?: number | null;
  updated_at?: string | null;
  updated_by?: string | null;
}): ServiceHealthSnapshot {
  const state = row.service_state;
  return normalizeServiceHealth({
    serviceState: state === "DEGRADED" || state === "WEB_CAPACITY_LIMITED" || state === "NORMAL" ? state : "NORMAL",
    affectedCapabilities: parseCapabilities(row.affected_capabilities ?? "[]"),
    retryAfter: typeof row.retry_after === "number" ? row.retry_after : null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  });
}

async function createFileStore(): Promise<ServiceHealthStore | null> {
  if (typeof process.versions?.node !== "string") return null;

  try {
    const [{ mkdir, readFile, writeFile }, pathMod] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);

    const filePath = pathMod.join(process.cwd(), ".data", "service-health.json");
    let snapshot: ServiceHealthSnapshot | null = null;
    let writeQueue = Promise.resolve();

    const load = async (): Promise<ServiceHealthSnapshot> => {
      if (snapshot) return snapshot;
      try {
        const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
        snapshot = normalizeServiceHealth({
          serviceState: (raw.serviceState as ServiceState) ?? "NORMAL",
          affectedCapabilities: Array.isArray(raw.affectedCapabilities)
            ? (raw.affectedCapabilities as string[])
            : [],
          retryAfter: typeof raw.retryAfter === "number" ? raw.retryAfter : null,
          updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
          updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
        });
      } catch {
        snapshot = { ...NORMAL_SERVICE_HEALTH };
      }
      return snapshot;
    };

    return {
      kind: "file",
      read: async () => {
        const current = await load();
        return { ...current, affectedCapabilities: [...current.affectedCapabilities] };
      },
      write: async (next) => {
        writeQueue = writeQueue.then(async () => {
          snapshot = { ...next, affectedCapabilities: [...next.affectedCapabilities] };
          await mkdir(pathMod.dirname(filePath), { recursive: true });
          await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
        });
        await writeQueue;
      },
    };
  } catch {
    return null;
  }
}

async function createD1Store(db: {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => { run: () => Promise<unknown>; first: <T>() => Promise<T | null> };
    first: <T>() => Promise<T | null>;
  };
}): Promise<ServiceHealthStore | null> {
  try {
    const row = await db.prepare(`SELECT * FROM service_health WHERE id = 1`).first<{
      service_state: string;
      affected_capabilities: string;
      retry_after: number | null;
      updated_at: string | null;
      updated_by: string | null;
    }>();

    let cached = row ? fromRow(row) : { ...NORMAL_SERVICE_HEALTH };

    return {
      kind: "d1",
      read: async () => {
        const current = await db.prepare(`SELECT * FROM service_health WHERE id = 1`).first<{
          service_state: string;
          affected_capabilities: string;
          retry_after: number | null;
          updated_at: string | null;
          updated_by: string | null;
        }>();
        cached = current ? fromRow(current) : cached;
        return { ...cached, affectedCapabilities: [...cached.affectedCapabilities] };
      },
      write: async (next) => {
        cached = { ...next, affectedCapabilities: [...next.affectedCapabilities] };
        await db
          .prepare(
            `INSERT OR REPLACE INTO service_health
             (id, service_state, affected_capabilities, retry_after, updated_at, updated_by)
             VALUES (1, ?, ?, ?, ?, ?)`,
          )
          .bind(
            next.serviceState,
            JSON.stringify(next.affectedCapabilities),
            next.retryAfter,
            next.updatedAt,
            next.updatedBy,
          )
          .run();
      },
    };
  } catch {
    return null;
  }
}

async function resolveD1Database(): Promise<any | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { LICENSE_DB?: unknown }).LICENSE_DB ?? null;
  } catch {
    return null;
  }
}

let storePromise: Promise<ServiceHealthStore> | null = null;

async function createStore(): Promise<ServiceHealthStore> {
  const d1 = await resolveD1Database();
  if (d1) {
    const d1Store = await createD1Store(d1);
    if (d1Store) return d1Store;
  }
  return (await createFileStore()) ?? new MemoryServiceHealthStore();
}

export function getServiceHealthStore(): Promise<ServiceHealthStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export async function readServiceHealth(): Promise<ServiceHealthSnapshot> {
  return (await getServiceHealthStore()).read();
}

export async function writeServiceHealth(snapshot: ServiceHealthSnapshot): Promise<ServiceHealthSnapshot> {
  const store = await getServiceHealthStore();
  const next = normalizeServiceHealth(snapshot);
  await store.write(next);
  return next;
}

export function resetServiceHealthStoreForTests(): void {
  storePromise = null;
}
