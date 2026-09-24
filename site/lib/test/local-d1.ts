import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

export type SqliteD1Statement = {
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  bind(...values: unknown[]): SqliteD1Statement;
};

export type SqliteD1Adapter = {
  prepare(query: string): SqliteD1Statement;
  batch(statements: SqliteD1Statement[]): Promise<void>;
};

type DatabaseSyncLike = {
  prepare(query: string): {
    run(...values: unknown[]): unknown;
    all(...values: unknown[]): unknown[];
    get(...values: unknown[]): unknown;
  };
  exec(sql: string): void;
  close(): void;
};

const require = createRequire(import.meta.url);

function loadDatabaseSync(path: string): DatabaseSyncLike {
  try {
    const sqlite = require("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseSyncLike };
    return new sqlite.DatabaseSync(path);
  } catch {
    throw new Error("node:sqlite is required for local D1 durability tests (Node 22+).");
  }
}

export function applyLocalD1Migrations(cwd: string): void {
  execSync("npx wrangler d1 migrations apply suhuella-license --local", {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });
}

export function findLocalD1SqlitePath(cwd: string): string {
  const root = join(cwd, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(root)) {
    throw new Error(`Local D1 state not found under ${root}. Run wrangler d1 migrations apply --local first.`);
  }
  const candidates = readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".sqlite") &&
        entry.name !== "metadata.sqlite",
    )
    .map((entry) => join(root, entry.name));
  if (candidates.length === 0) {
    throw new Error(`No D1 database .sqlite file under ${root}. Run wrangler d1 migrations apply --local first.`);
  }
  if (candidates.length === 1) return candidates[0];
  // Wrangler also writes metadata.sqlite; prefer the content database (long hash filename).
  candidates.sort((left, right) => right.length - left.length);
  return candidates[0];
}

export function sqliteAsD1Adapter(db: DatabaseSyncLike): SqliteD1Adapter {
  // Business + license persistence share one sqlite connection in harness tests.
  let batchChain: Promise<void> = Promise.resolve();

  const statementFor = (query: string, values: unknown[]): SqliteD1Statement => {
    const bound: SqliteD1Statement = {
      run: async () => {
        const result = db.prepare(query).run(...values) as { changes?: number; lastInsertRowid?: number };
        return {
          meta: { changes: result.changes ?? 0 },
          lastInsertRowid: result.lastInsertRowid,
        };
      },
      all: async <T = unknown>() => ({ results: db.prepare(query).all(...values) as T[] }),
      first: async <T = unknown>() => (db.prepare(query).get(...values) as T | undefined) ?? null,
      bind(...next: unknown[]) {
        return statementFor(query, next);
      },
    };
    return bound;
  };

  return {
    prepare(query: string) {
      return statementFor(query, []);
    },
    async batch(statements: SqliteD1Statement[]) {
      const run = async () => {
        db.exec("BEGIN");
        try {
          for (const statement of statements) await statement.run();
          db.exec("COMMIT");
        } catch (error) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // ignore rollback failure
          }
          throw error;
        }
      };
      const next = batchChain.then(run, run);
      batchChain = next.catch(() => {});
      await next;
    },
  };
}

export function openIsolatedSqliteAdapter(sqlitePath: string): {
  db: DatabaseSyncLike;
  adapter: SqliteD1Adapter;
} {
  const db = loadDatabaseSync(sqlitePath);
  return { db, adapter: sqliteAsD1Adapter(db) };
}

export function openFreshLocalD1Adapter(cwd: string): { db: DatabaseSyncLike; adapter: SqliteD1Adapter } {
  applyLocalD1Migrations(cwd);
  const sqlitePath = findLocalD1SqlitePath(cwd);
  const db = loadDatabaseSync(sqlitePath);
  return { db, adapter: sqliteAsD1Adapter(db) };
}
