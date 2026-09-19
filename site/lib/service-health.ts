/**
 * Single operational state for SuHuella Web.
 *
 * HIGH TRAFFIC != BROWSER DISABLED
 * SERVICE HEALTH MAY TEMPORARILY LIMIT A CAPABILITY.
 * IT DOES NOT CREATE A DIFFERENT PRODUCT EDITION.
 *
 * effectiveCapability = product entitlement ∩ host capability ∩ service availability
 */

export const SERVICE_STATES = ["NORMAL", "DEGRADED", "WEB_CAPACITY_LIMITED"] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

/** Remote capabilities the service may temporarily limit. */
export const SERVICE_CAPABILITIES = [
  "license-check",
  "license-activation",
  "license-recovery",
  "checkout",
  "business-branding",
  "release-manifest",
  "remote-analysis",
  "connectors",
] as const;
export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number];

/** Always local. Never appear in affectedCapabilities. */
export const LOCAL_ONLY_CAPABILITIES = [
  "local-organise",
  "local-search",
  "local-home",
  "local-activity",
  "local-sources",
] as const;
export type LocalOnlyCapability = (typeof LOCAL_ONLY_CAPABILITIES)[number];

export const NEVER_SHED_CAPABILITIES = [
  ...LOCAL_ONLY_CAPABILITIES,
  "static-assets",
] as const;
export type NeverShedCapability = (typeof NEVER_SHED_CAPABILITIES)[number];

export type ServiceAvailability = "AVAILABLE" | "DEGRADED" | "TEMPORARILY_LIMITED";

export type ServiceHealthSnapshot = {
  serviceState: ServiceState;
  affectedCapabilities: ServiceCapability[];
  retryAfter: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PublicServiceHealth = {
  serviceState: ServiceState;
  affectedCapabilities: ServiceCapability[];
  retryAfter: number | null;
};

export const NORMAL_SERVICE_HEALTH: ServiceHealthSnapshot = {
  serviceState: "NORMAL",
  affectedCapabilities: [],
  retryAfter: null,
  updatedAt: null,
  updatedBy: null,
};

/** New browser-backend work we may pause at capacity. Completing a paid activation stays available. */
export const WEB_CAPACITY_DEFAULT_AFFECTED: ServiceCapability[] = [
  "license-recovery",
  "checkout",
  "remote-analysis",
];

export function isServiceState(value: string): value is ServiceState {
  return (SERVICE_STATES as readonly string[]).includes(value);
}

export function isServiceCapability(value: string): value is ServiceCapability {
  return (SERVICE_CAPABILITIES as readonly string[]).includes(value);
}

export function isNeverShedCapability(value: string): boolean {
  return (NEVER_SHED_CAPABILITIES as readonly string[]).includes(value);
}

export function isLocalOnlyCapability(value: string): boolean {
  return (LOCAL_ONLY_CAPABILITIES as readonly string[]).includes(value);
}

export function toPublicServiceHealth(snapshot: ServiceHealthSnapshot): PublicServiceHealth {
  return {
    serviceState: snapshot.serviceState,
    affectedCapabilities: [...snapshot.affectedCapabilities],
    retryAfter: snapshot.retryAfter,
  };
}

export function defaultAffectedForState(state: ServiceState): ServiceCapability[] {
  if (state === "WEB_CAPACITY_LIMITED") return [...WEB_CAPACITY_DEFAULT_AFFECTED];
  return [];
}

export function sanitizeAffectedCapabilities(
  state: ServiceState,
  requested?: readonly string[] | null,
): ServiceCapability[] {
  const source = requested && requested.length > 0 ? requested : defaultAffectedForState(state);
  const unique = new Set<ServiceCapability>();
  for (const item of source) {
    if (!isServiceCapability(item)) continue;
    if (isNeverShedCapability(item)) continue;
    if (item === "license-check" && state !== "WEB_CAPACITY_LIMITED") continue;
    unique.add(item);
  }
  if (state === "NORMAL") return [];
  return [...unique];
}

export function normalizeServiceHealth(input: {
  serviceState: ServiceState;
  affectedCapabilities?: readonly string[] | null;
  retryAfter?: number | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}): ServiceHealthSnapshot {
  const retryAfter =
    typeof input.retryAfter === "number" && Number.isFinite(input.retryAfter) && input.retryAfter > 0
      ? Math.round(input.retryAfter)
      : null;
  return {
    serviceState: input.serviceState,
    affectedCapabilities: sanitizeAffectedCapabilities(input.serviceState, input.affectedCapabilities),
    retryAfter: input.serviceState === "NORMAL" ? null : retryAfter,
    updatedAt: input.updatedAt ?? null,
    updatedBy: input.updatedBy ?? null,
  };
}

export function serviceAvailabilityFor(
  capability: ServiceCapability | LocalOnlyCapability | "static-assets",
  health: Pick<ServiceHealthSnapshot, "serviceState" | "affectedCapabilities">,
): ServiceAvailability {
  if (isNeverShedCapability(capability) || isLocalOnlyCapability(capability)) return "AVAILABLE";
  if (health.serviceState === "NORMAL") return "AVAILABLE";
  if (!health.affectedCapabilities.includes(capability as ServiceCapability)) return "AVAILABLE";
  return health.serviceState === "WEB_CAPACITY_LIMITED" ? "TEMPORARILY_LIMITED" : "DEGRADED";
}

export function isServiceCapabilityAvailable(
  capability: ServiceCapability | LocalOnlyCapability | "static-assets",
  health: Pick<ServiceHealthSnapshot, "serviceState" | "affectedCapabilities">,
): boolean {
  return serviceAvailabilityFor(capability, health) === "AVAILABLE";
}

/**
 * THE HOST NEVER DEFINES THE PRODUCT.
 * SERVICE HEALTH MAY TEMPORARILY LIMIT A CAPABILITY.
 */
export function effectiveCapabilityAvailable(input: {
  entitled: boolean;
  hostAllows: boolean;
  service: ServiceAvailability;
}): boolean {
  return input.entitled && input.hostAllows && input.service === "AVAILABLE";
}

export function serviceUnavailableError(): "service_unavailable" {
  return "service_unavailable";
}
