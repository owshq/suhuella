/**
 * Gatekeeper (spctl) assessment with explicit pre-rc unsigned semantics.
 *
 * Pre-rc-unsigned channel: spctl rejection without Developer ID/notarization is
 * EXPECTED_UNSIGNED_REJECTION — diagnostic only, never exit 1.
 * Commercial channel: spctl must pass when the artifact claims to be trusted.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { detectMacCodesignState } from "./mac-codesign-detect.mjs";
import { isPreRcUnsignedPublishChannel } from "./commercial-signing.mjs";

export const GATEKEEPER_PASS = "PASS";
export const EXPECTED_UNSIGNED_REJECTION = "EXPECTED_UNSIGNED_REJECTION";
export const GATEKEEPER_BLOCK = "BLOCK";

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 120_000 });
}

export function isSpctlToolFailure(output) {
  const text = output.toLowerCase();
  if (!text.trim()) return false;
  if (text.includes("command not found")) return true;
  if (text.includes("no such file or directory") && text.includes("spctl")) return true;
  return false;
}

/**
 * Classify spctl output. Does not run commands — safe for unit tests.
 */
export function classifyGatekeeperAssessment(input) {
  const {
    spctlStatus,
    spctlOutput = "",
    codesignVerifyPassed,
    appSignature = "unknown",
    notarized = false,
    channel = "commercial",
  } = input;

  if (!codesignVerifyPassed) {
    return {
      outcome: GATEKEEPER_BLOCK,
      reason: "Application bundle failed codesign --verify --deep --strict.",
    };
  }

  if (spctlStatus === 0) {
    return { outcome: GATEKEEPER_PASS };
  }

  const output = `${spctlOutput}`;
  if (isSpctlToolFailure(output)) {
    return {
      outcome: GATEKEEPER_BLOCK,
      reason: "spctl failed to run or returned a tool error (not an expected unsigned rejection).",
      detail: output.trim(),
    };
  }

  if (channel === "pre-rc-unsigned") {
    if (notarized) {
      return {
        outcome: GATEKEEPER_BLOCK,
        reason: "Notarized application failed Gatekeeper assessment.",
        detail: output.trim(),
      };
    }
    return {
      outcome: EXPECTED_UNSIGNED_REJECTION,
      detail: output.trim(),
    };
  }

  if (appSignature === "adhoc" || appSignature === "none" || !notarized) {
    return {
      outcome: GATEKEEPER_BLOCK,
      reason: "Commercial channel requires Developer ID, notarization, and Gatekeeper acceptance.",
      detail: output.trim(),
    };
  }

  return {
    outcome: GATEKEEPER_BLOCK,
    reason: "Application is not accepted by Gatekeeper (spctl --assess failed).",
    detail: output.trim(),
  };
}

export function resolveGatekeeperChannel(explicitChannel) {
  if (explicitChannel) return explicitChannel;
  return isPreRcUnsignedPublishChannel() ? "pre-rc-unsigned" : "commercial";
}

/**
 * Run codesign verify + spctl assess and classify for packaging or release validation.
 */
export function assessMacGatekeeper(appPath, options = {}) {
  if (!appPath || !existsSync(appPath)) {
    return {
      outcome: GATEKEEPER_BLOCK,
      reason: `Application bundle missing: ${appPath ?? "(empty path)"}`,
      codesignVerifyPassed: false,
      spctlStatus: null,
      spctlOutput: "",
      macState: { app: "none", dmg: "none", developerId: false, notarized: false, stapled: false },
      channel: resolveGatekeeperChannel(options.channel),
    };
  }

  const channel = resolveGatekeeperChannel(options.channel);
  const macState = detectMacCodesignState(appPath, options.dmgPath ?? "");

  const verify = run("codesign", ["--verify", "--deep", "--strict", appPath]);
  const codesignVerifyPassed = verify.status === 0;

  const assess = run("spctl", ["--assess", "--type", "execute", "-vv", appPath]);
  const spctlOutput = `${assess.stderr ?? ""}\n${assess.stdout ?? ""}`.trim();
  const spctlStatus = assess.status ?? 1;

  const classified = classifyGatekeeperAssessment({
    spctlStatus,
    spctlOutput,
    codesignVerifyPassed,
    appSignature: macState.app,
    notarized: macState.notarized,
    channel,
  });

  return {
    ...classified,
    codesignVerifyPassed,
    spctlStatus,
    spctlOutput,
    macState,
    channel,
  };
}

export function logGatekeeperAssessment(result, { prefix = "OK  " } = {}) {
  if (result.outcome === GATEKEEPER_PASS) {
    console.log(`${prefix} spctl --assess`);
    return;
  }
  if (result.outcome === EXPECTED_UNSIGNED_REJECTION) {
    console.log(
      `${prefix} spctl ${EXPECTED_UNSIGNED_REJECTION} (Gatekeeper rejects unsigned/unnotarized — pre-rc pipeline continues)`,
    );
    if (result.spctlOutput?.trim()) console.log(result.spctlOutput.trim());
    return;
  }
  console.error(result.reason ?? "Gatekeeper assessment blocked.");
  if (result.detail?.trim()) console.error(result.detail.trim());
}

export function assertGatekeeperAllowsPipeline(result) {
  if (result.outcome === GATEKEEPER_BLOCK) {
    console.error(result.reason ?? "Gatekeeper assessment blocked the pipeline.");
    if (result.detail?.trim()) console.error(result.detail.trim());
    process.exit(1);
  }
}
