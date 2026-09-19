import {
  LOCAL_ONLY_CAPABILITIES,
  NEVER_SHED_CAPABILITIES,
  NORMAL_SERVICE_HEALTH,
  WEB_CAPACITY_DEFAULT_AFFECTED,
  effectiveCapabilityAvailable,
  isLocalOnlyCapability,
  isNeverShedCapability,
  isServiceCapabilityAvailable,
  normalizeServiceHealth,
  sanitizeAffectedCapabilities,
  serviceAvailabilityFor,
} from "./service-health.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runServiceHealthAuditCheck(): void {
  assert(NORMAL_SERVICE_HEALTH.serviceState === "NORMAL", "default state is NORMAL");
  assert(NORMAL_SERVICE_HEALTH.affectedCapabilities.length === 0, "NORMAL sheds nothing");

  assert(
    sanitizeAffectedCapabilities("NORMAL", ["license-recovery", "checkout"]).length === 0,
    "NORMAL ignores requested sheds — high traffic is not browser-disabled",
  );

  const degraded = normalizeServiceHealth({
    serviceState: "DEGRADED",
    affectedCapabilities: ["license-recovery", "local-organise", "static-assets", "license-check"],
  });
  assert(degraded.affectedCapabilities.includes("license-recovery"), "DEGRADED may limit OTP");
  assert(!degraded.affectedCapabilities.includes("license-check"), "license-check is not shed in DEGRADED");
  assert(
    !degraded.affectedCapabilities.some((item) => isNeverShedCapability(item) || isLocalOnlyCapability(item)),
    "local and static capabilities cannot be shed",
  );

  const capacity = normalizeServiceHealth({ serviceState: "WEB_CAPACITY_LIMITED" });
  for (const item of WEB_CAPACITY_DEFAULT_AFFECTED) {
    assert(capacity.affectedCapabilities.includes(item), `WEB_CAPACITY_LIMITED defaults include ${item}`);
  }
  assert(!capacity.affectedCapabilities.includes("license-activation"), "paid activation is not shed by default");
  assert(!capacity.affectedCapabilities.includes("license-check"), "existing license check stays available");

  for (const local of LOCAL_ONLY_CAPABILITIES) {
    assert(
      serviceAvailabilityFor(local, capacity) === "AVAILABLE",
      `${local} stays available during WEB_CAPACITY_LIMITED`,
    );
  }
  for (const never of NEVER_SHED_CAPABILITIES) {
    assert(isServiceCapabilityAvailable(never, capacity), `${never} is never shed`);
  }

  assert(
    isServiceCapabilityAvailable("license-recovery", capacity) === false,
    "OTP can be limited at capacity",
  );
  assert(
    isServiceCapabilityAvailable("license-check", capacity) === true,
    "OTP/Stripe saturation must not block license-check",
  );
  assert(
    isServiceCapabilityAvailable("local-organise", degraded) === true,
    "Organise must not depend on OTP/Stripe health",
  );
  assert(
    isServiceCapabilityAvailable("local-search", degraded) === true,
    "Search must not depend on OTP/Stripe health",
  );

  assert(
    effectiveCapabilityAvailable({
      entitled: true,
      hostAllows: true,
      service: "TEMPORARILY_LIMITED",
    }) === false,
    "service health can hide a capability without changing edition",
  );
  assert(
    effectiveCapabilityAvailable({
      entitled: true,
      hostAllows: true,
      service: "AVAILABLE",
    }) === true,
    "healthy service does not invent a new edition",
  );
  assert(
    effectiveCapabilityAvailable({
      entitled: false,
      hostAllows: true,
      service: "AVAILABLE",
    }) === false,
    "entitlement still gates the product",
  );
  assert(
    effectiveCapabilityAvailable({
      entitled: true,
      hostAllows: false,
      service: "AVAILABLE",
    }) === false,
    "host capability still gates the host",
  );

  console.log("BROWSER-CAPACITY-AND-GRACEFUL-DEGRADATION-AUDIT-001 passed");
}

runServiceHealthAuditCheck();
