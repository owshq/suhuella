/**
 * Commercial code-signing gate — business decision, not a build bug.
 * Authority: docs/governance/DECISION-PRIVATE-BETA-001.md
 * Config: brands/suhuella/commercial-signing.json
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "brands/suhuella/commercial-signing.json");

export function readCommercialSigningConfig() {
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return { status: "enabled" };
  }
}

export function isCommercialSigningDeferred() {
  return readCommercialSigningConfig().status === "deferred";
}

export function printCommercialSigningSkipped(platformLabel) {
  const config = readCommercialSigningConfig();
  console.log("ReleaseValidation SKIPPED");
  console.log(`Platform: ${platformLabel}`);
  console.log("");
  console.log("Commercial signing intentionally disabled.");
  console.log("");
  console.log(`Decision: ${config.decision ?? "DECISION-PRIVATE-BETA-001"}`);
  console.log("Release validation deferred until commercial signing is enabled.");
  console.log("");
  console.log("This is not FAIL. Private Beta is not being attempted.");
  console.log("Primary metric: Can a first-time user obtain a useful result without assistance?");
  console.log("See DECISION-PRIVATE-BETA-001.");
  if (config.reason) console.log(`Reason: ${config.reason}`);
  if (config.reopenOnlyBy) console.log(`Reopen only by: ${config.reopenOnlyBy}`);
}

export function assertCommercialSigningEnabledForPublish() {
  if (!isCommercialSigningDeferred()) return;
  const config = readCommercialSigningConfig();
  console.error("Publish blocked — commercial signing intentionally deferred.");
  console.error(`Decision: ${config.decision ?? "DECISION-PRIVATE-BETA-001"}`);
  console.error("Enable commercial signing in brands/suhuella/commercial-signing.json when ready.");
  process.exit(1);
}
