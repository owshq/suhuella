import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openIsolatedSqliteAdapter, type SqliteD1Adapter } from "../test/local-d1.ts";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production";
}

function tryFindLocalD1SqlitePath(cwd: string): string | null {
  const root = join(cwd, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".sqlite")) {
      return join(root, entry.name);
    }
  }
  return null;
}

let cached: SqliteD1Adapter | null | undefined;

/**
 * When `npm run dev` runs without OpenNext, reuse wrangler local D1 if provisioned.
 * `npm run dev:cf` uses LICENSE_DB from getCloudflareContext instead.
 */
export function resolveDevWranglerD1Adapter(): SqliteD1Adapter | null {
  if (cached !== undefined) return cached;
  if (isProductionRuntime() || process.env.SUHUELLA_DEV_OPENNEXT === "1") {
    cached = null;
    return null;
  }
  const sqlitePath = tryFindLocalD1SqlitePath(process.cwd());
  if (!sqlitePath) {
    cached = null;
    return null;
  }
  cached = openIsolatedSqliteAdapter(sqlitePath).adapter;
  return cached;
}
