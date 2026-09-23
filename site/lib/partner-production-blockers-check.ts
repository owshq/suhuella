/**
 * PARTNER-PUBLIC-PROGRAM-001 — production blocker preflight (code + operator checklist).
 * Does not apply remote migrations or flip checkout flags.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PARTNER_MIGRATIONS: Array<{ file: string; needle: string }> = [
  { file: "0007_partners.sql", needle: "CREATE TABLE IF NOT EXISTS partner" },
  { file: "0008_partner_domain.sql", needle: "ALTER TABLE partner_domain" },
  { file: "0009_partner_application.sql", needle: "CREATE TABLE IF NOT EXISTS partner_application" },
  { file: "0010_partner_stripe_ledger.sql", needle: "CREATE TABLE IF NOT EXISTS partner_stripe_fulfillment" },
];

const REMOTE_TABLE_CHECK =
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('partner','partner_domain','partner_application','partner_stripe_fulfillment');";

function readWrangler(): string {
  return readFileSync(path.join(siteRoot, "wrangler.jsonc"), "utf8");
}

function tryRemoteMigrationList(): { ok: true; output: string } | { ok: false; reason: string } {
  try {
    const output = execSync("npx wrangler d1 migrations list suhuella-license --remote", {
      cwd: siteRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: message.split("\n").slice(0, 6).join("\n") };
  }
}

function runPartnerProductionBlockersCheck(): void {
  const wrangler = readWrangler();
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner checkout stays off in wrangler");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "personal checkout stays off in wrangler");

  for (const migration of PARTNER_MIGRATIONS) {
    const sql = readFileSync(path.join(siteRoot, "migrations", migration.file), "utf8");
    assert(sql.includes(migration.needle), `${migration.file} defines ${migration.needle}`);
  }

  const remote = tryRemoteMigrationList();
  console.log("PARTNER-PUBLIC-PROGRAM-001 production blockers — code preflight PASS");
  console.log("B1 (D1 0009–0010 remote): operator must confirm `migrations list --remote` shows none pending.");
  console.log("");
  console.log("Checkout flags (must stay off until commercial enablement):");
  console.log("  PARTNER_CHECKOUT_ENABLED=false");
  console.log("  PAID_CHECKOUT_ENABLED=false");
  console.log("");
  console.log("Operator steps still manual:");
  console.log("  1. wrangler login  (account with D1 suhuella-license access)");
  console.log("  2. cd site && npx wrangler d1 migrations list suhuella-license --remote");
  console.log("  3. cd site && npx wrangler d1 migrations apply suhuella-license --remote");
  console.log(`  4. cd site && npx wrangler d1 execute suhuella-license --remote --command "${REMOTE_TABLE_CHECK}"`);
  console.log("  5. Deploy Worker candidate (flags unchanged). Roll back = previous version.");
  console.log("  6. GET https://suhuella.com/partners → program page 200");
  console.log("  7. POST /api/partners/apply on platform host → not 503 (table present)");
  console.log("  8. Ops: approve test application → manual onboarding URL in notice");
  console.log("");
  console.log("Stripe enablement (after sandbox E2E + commercial approval):");
  console.log("  9. PARTNER_CHECKOUT_ENABLED=true in wrangler + redeploy");
  console.log(" 10. PAID_CHECKOUT_ENABLED=true only if personal plans sell too");
  console.log("     See SUHUELLA-STRIPE-CLOUDFLARE-PRODUCTION-READINESS-001.md");
  console.log("");

  if (remote.ok) {
    console.log("Remote D1 migration list (wrangler):");
    console.log(remote.output.trim());
    if (/Migrations to be applied:/i.test(remote.output)) {
      console.log("");
      console.log("ACTION: run `npx wrangler d1 migrations apply suhuella-license --remote` before enabling /partners apply.");
    } else {
      console.log("");
      console.log("Remote migrations appear applied (no pending list). Verify tables with step 4.");
    }
  } else {
    console.log("Remote D1 status: not verified from this environment.");
    console.log(remote.reason);
    console.log("Run steps 1–4 on an authorized operator machine to close the D1 blocker.");
  }
}

runPartnerProductionBlockersCheck();
