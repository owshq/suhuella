import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getPartnerApplicationStore } from "./application-store.ts";
import type { PartnerApplicationRecord } from "./application-types.ts";

type LegacyApplication = {
  id?: string;
  normalizedEmail?: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

function legacyPaths(): string[] {
  const paths: string[] = [];
  const configured = process.env.LICENSE_STORE_PATH?.trim();
  if (configured) paths.push(configured);
  paths.push(join(process.cwd(), ".data", "license-state.json"));
  return paths;
}

export function readLegacyPartnerApplicationsFromFiles(): LegacyApplication[] {
  const found: LegacyApplication[] = [];
  for (const filePath of legacyPaths()) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
        partnerApplications?: LegacyApplication[];
      };
      if (Array.isArray(raw.partnerApplications)) {
        found.push(...raw.partnerApplications);
      }
    } catch {
      // ignore unreadable files
    }
  }
  return found;
}

/** Import file-backed interest records into D1/memory once. Skips duplicates and rejected conflicts. */
export async function migrateLegacyPartnerApplicationsIfPresent(): Promise<{
  scanned: number;
  imported: number;
  skipped: number;
}> {
  const legacy = readLegacyPartnerApplicationsFromFiles();
  if (legacy.length === 0) return { scanned: 0, imported: 0, skipped: 0 };

  const store = await getPartnerApplicationStore();
  let imported = 0;
  let skipped = 0;

  for (const item of legacy) {
    const email = item.normalizedEmail?.trim().toLowerCase() ?? "";
    const displayName = item.displayName?.trim() ?? "";
    if (!email || displayName.length < 2) {
      skipped += 1;
      continue;
    }
    const existing = await store.findByEmail(email);
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      await store.submitInterest({ email, displayName });
      imported += 1;
    } catch {
      skipped += 1;
    }
  }

  return { scanned: legacy.length, imported, skipped };
}

export function legacyApplicationMigrationReport(): string {
  const legacy = readLegacyPartnerApplicationsFromFiles();
  if (legacy.length === 0) {
    return "No legacy partnerApplications found in local license persistence files.";
  }
  const emails = legacy
    .map((item) => item.normalizedEmail)
    .filter(Boolean)
    .join(", ");
  return `Found ${legacy.length} legacy partnerApplications in local files (${emails}). Run migrateLegacyPartnerApplicationsIfPresent() before dropping the legacy field. Data never written to D1 cannot be recovered automatically.`;
}

export type { PartnerApplicationRecord };
