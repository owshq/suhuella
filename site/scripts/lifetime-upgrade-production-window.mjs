#!/usr/bin/env node
/**
 * Operator-controlled Lifetime Upgrade activation window.
 * Does NOT open sales unless --apply-window is passed after migrations + secrets validate.
 *
 * Usage:
 *   node scripts/lifetime-upgrade-production-window.mjs --check
 *   node scripts/lifetime-upgrade-production-window.mjs --migrate-remote
 *   node scripts/lifetime-upgrade-production-window.mjs --sync-registry
 *   node scripts/lifetime-upgrade-production-window.mjs --apply-window
 *   node scripts/lifetime-upgrade-production-window.mjs --close-window
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const siteRoot = join(import.meta.dirname, "..");
const configPath = join(siteRoot, "wrangler.jsonc");

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: siteRoot, stdio: "inherit" });
}

function wranglerVar(name) {
  const body = readFileSync(configPath, "utf8");
  const match = body.match(new RegExp(`"${name}":\\s*"([^"]+)"`));
  return match?.[1] ?? "";
}

const args = new Set(process.argv.slice(2));
if (args.size === 0 || args.has("--help")) {
  console.log(`Lifetime Upgrade production window

Steps (in order):
  1. Set Worker secrets from site/config/commercial-generation-production.example.json
  2. node scripts/lifetime-upgrade-production-window.mjs --check
  3. node scripts/lifetime-upgrade-production-window.mjs --migrate-remote
  4. node scripts/lifetime-upgrade-production-window.mjs --sync-registry
  5. npm run test:lifetime-upgrade-stripe-test --prefix site   (manual Stripe test checkout)
  6. node scripts/lifetime-upgrade-production-window.mjs --apply-window
  7. node scripts/lifetime-upgrade-production-window.mjs --close-window   (rollback)

Secrets to set (wrangler secret put):
  COMMERCIAL_GENERATION_REGISTRY
  COMMERCIAL_GENERATION_PRICE_MAP
  COMMERCIAL_GENERATION_UPGRADE_MAP
  STRIPE_LIFETIME_UPGRADE_PRICE_ID
  LICENSE_SIGNING_PRIVATE_KEY (or LICENSE_SIGNING_SECRET)

Window flags (wrangler secret put — not committed):
  LIFETIME_UPGRADE_CHECKOUT_ENABLED=true
  LICENSE_VERSION_MODEL_ACTIVE=true
  COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED=true
  PAID_CHECKOUT_ENABLED=true   (only if personal checkout should open too)
`);
  process.exit(0);
}

if (args.has("--check")) {
  run("npm run test:lifetime-upgrade-production-activation --prefix .");
  run("npm run test:lifetime-upgrade-checkout --prefix .");
  run("npm run test:generation-enforcement --prefix .");
  console.log("\nPAID_CHECKOUT_ENABLED in wrangler.jsonc:", wranglerVar("PAID_CHECKOUT_ENABLED"));
  console.log("Upgrade window flags must stay OFF in wrangler.jsonc until --apply-window.");
  process.exit(0);
}

if (args.has("--migrate-remote")) {
  console.log("\nApplying D1 migrations 0011 + both 0012 files to suhuella-license (remote)…");
  run("npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc");
  run("npx wrangler d1 migrations list suhuella-license --remote --config wrangler.jsonc");
  process.exit(0);
}

if (args.has("--sync-registry")) {
  run("node --experimental-strip-types --import ../brands/node-register.mjs --disable-warning=ExperimentalWarning scripts/sync-commercial-generation-registry.mjs");
  process.exit(0);
}

if (args.has("--apply-window")) {
  console.log("\nOpening controlled window via Worker secrets (interactive)…");
  console.log("Set each secret to exactly: true");
  for (const name of [
    "LICENSE_VERSION_MODEL_ACTIVE",
    "COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED",
    "LIFETIME_UPGRADE_CHECKOUT_ENABLED",
  ]) {
    run(`npx wrangler secret put ${name}`);
  }
  console.log("\nOptional: PAID_CHECKOUT_ENABLED=true if personal checkout should open.");
  run("npx wrangler secret put PAID_CHECKOUT_ENABLED");
  console.log("\nRedeploy Worker after secrets. Run manual Stripe test checkout before GA.");
  process.exit(0);
}

if (args.has("--close-window")) {
  console.log("\nClosing window — set secrets to false (interactive)…");
  for (const name of [
    "LIFETIME_UPGRADE_CHECKOUT_ENABLED",
    "COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED",
    "LICENSE_VERSION_MODEL_ACTIVE",
    "PAID_CHECKOUT_ENABLED",
  ]) {
    console.log(`\nSet ${name} to false:`);
    run(`npx wrangler secret put ${name}`);
  }
  process.exit(0);
}

console.error("Unknown args. Use --help");
process.exit(1);
