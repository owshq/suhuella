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
const releaseJsonPath = path.join(root, "brands/suhuella/release.json");

export function readReleaseVersion() {
  try {
    const manifest = JSON.parse(readFileSync(releaseJsonPath, "utf8"));
    return String(manifest.version ?? "").trim();
  } catch {
    return "";
  }
}

/** PRE-RC-RELEASE-SEMANTICS-001 — signing deferred does not block pre-rc publication. */
export function isPreRcReleaseVersion(version = readReleaseVersion()) {
  return version.includes("-pre-rc");
}

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

/** Pre-rc version while commercial signing is intentionally deferred. */
export function isPreRcUnsignedPublishChannel(version = readReleaseVersion()) {
  return isCommercialSigningDeferred() && isPreRcReleaseVersion(version);
}

/**
 * Honest distribution metadata (written to release.json on publish only).
 * @param {{ mac?: { app?: string, dmg?: string, developerId?: boolean, notarized?: boolean, stapled?: boolean }, windows?: { authenticode?: string } }} [detected]
 */
export function buildDistributionRecord(version = readReleaseVersion(), detected = {}) {
  const config = readCommercialSigningConfig();
  const preRc = isPreRcUnsignedPublishChannel(version);
  const mac = detected.mac ?? {};
  const windows = detected.windows ?? {};
  return {
    channel: preRc ? "pre-rc-deferred-commercial-signing" : config.publishChannel ?? "commercial",
    commercialCodeSigning: {
      mac: {
        app: mac.app ?? (preRc ? "adhoc" : "developer-id-required"),
        dmg: mac.dmg ?? (preRc ? "adhoc" : "developer-id-required"),
        developerId: mac.developerId === true,
        notarized: mac.notarized === true,
        stapled: mac.stapled === true,
      },
      windows: {
        authenticode: windows.authenticode ?? (preRc ? "none" : "valid-required"),
      },
      cleanMachineInstallVerified: false,
    },
    decision: config.decision ?? "DECISION-PRIVATE-BETA-001",
  };
}

export function stampDistributionMetadata(manifest, version = readReleaseVersion(), detected = {}) {
  manifest.distribution = buildDistributionRecord(version, detected);
  return manifest;
}

export function printCommercialSigningSkipped(platformLabel) {
  const config = readCommercialSigningConfig();
  console.log("CommercialReleaseValidation SKIPPED");
  console.log(`Platform: ${platformLabel}`);
  console.log("");
  console.log("Developer ID / notarization / Authenticode are intentionally deferred.");
  console.log("");
  console.log(`Decision: ${config.decision ?? "DECISION-PRIVATE-BETA-001"}`);
  console.log("Gate 6 (trusted install) is not attempted for this publish.");
  console.log("Pre-RC integrity validation runs separately — see PreRcReleaseValidation.");
  console.log("");
  if (config.reason) console.log(`Reason: ${config.reason}`);
  if (config.reopenOnlyBy) console.log(`Reopen only by: ${config.reopenOnlyBy}`);
}

export function assertCommercialSigningEnabledForPublish() {
  if (!isCommercialSigningDeferred()) return;
  if (isPreRcUnsignedPublishChannel()) {
    console.log("Pre-RC unsigned publish channel — commercial code signing not required.");
    console.log("License Ed25519 public keys are still required at desktop build time.");
    console.log("Artifacts are unsigned / not notarized; OS may warn. Clean-machine install is not verified until tested.");
    console.log("See docs/governance/PRE-RC-RELEASE-SEMANTICS.md");
    return;
  }
  const config = readCommercialSigningConfig();
  console.error("Publish blocked — commercial signing intentionally deferred.");
  console.error(`Decision: ${config.decision ?? "DECISION-PRIVATE-BETA-001"}`);
  console.error("Only pre-rc versions may publish unsigned. Promotion to rc1 requires Gate 6.");
  console.error("Enable commercial signing in brands/suhuella/commercial-signing.json when ready.");
  process.exit(1);
}
