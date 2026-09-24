/**
 * MAC-GATEKEEPER-ASSESS-001 — pre-rc spctl must not block unsigned builds.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_UNSIGNED_REJECTION,
  GATEKEEPER_BLOCK,
  GATEKEEPER_PASS,
  classifyGatekeeperAssessment,
} from "./mac-gatekeeper-assess.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const rejected = classifyGatekeeperAssessment({
    spctlStatus: 1,
    spctlOutput: `${root}/SuHuella.app: rejected\nsource=Unnotarized Developer ID`,
    codesignVerifyPassed: true,
    appSignature: "adhoc",
    notarized: false,
    channel: "pre-rc-unsigned",
  });
  assert(
    rejected.outcome === EXPECTED_UNSIGNED_REJECTION,
    "pre-rc unsigned + spctl rejected must continue pipeline",
  );

  const invalid = classifyGatekeeperAssessment({
    spctlStatus: 1,
    spctlOutput: "rejected",
    codesignVerifyPassed: false,
    appSignature: "adhoc",
    notarized: false,
    channel: "pre-rc-unsigned",
  });
  assert(invalid.outcome === GATEKEEPER_BLOCK, "pre-rc with invalid adhoc codesign must block");

  const commercial = classifyGatekeeperAssessment({
    spctlStatus: 1,
    spctlOutput: "rejected",
    codesignVerifyPassed: true,
    appSignature: "adhoc",
    notarized: false,
    channel: "commercial",
  });
  assert(commercial.outcome === GATEKEEPER_BLOCK, "commercial channel must block unsigned spctl rejection");

  const pass = classifyGatekeeperAssessment({
    spctlStatus: 0,
    spctlOutput: "accepted",
    codesignVerifyPassed: true,
    appSignature: "developer-id",
    notarized: true,
    channel: "commercial",
  });
  assert(pass.outcome === GATEKEEPER_PASS, "commercial notarized pass is PASS");

  const verifyBundle = readFileSync(
    path.join(root, "desktop/scripts/verify-mac-bundle.mjs"),
    "utf8",
  );
  assert(
    verifyBundle.includes("assessMacGatekeeper") && !verifyBundle.includes("resolveMacCodesignIdentity"),
    "verify-mac-bundle must use actual gatekeeper assess, not keychain identity guess",
  );

  const publishGuard = spawnSync(process.execPath, ["scripts/pre-rc-publish-guard-check.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert(publishGuard.status === 0, "compile-only must not become publishable");

  console.log("MAC-GATEKEEPER-ASSESS-001 check passed");
  console.log("Blocking script before fix: desktop/scripts/verify-mac-bundle.mjs");
  console.log("  used resolveMacCodesignIdentity() — Dev ID in keychain + unnotarized app → spctl fail → exit 1");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
