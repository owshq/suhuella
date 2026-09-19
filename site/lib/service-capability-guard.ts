import { productionLicensePersistenceReady } from "./license-persistence/store.ts";
import { isRateLimited, recordRateLimitEvent } from "./rate-limit.ts";
import {
  isServiceCapabilityAvailable,
  serviceUnavailableError,
  type ServiceCapability,
} from "./service-health.ts";
import { readServiceHealth } from "./service-health-store.ts";

const DURABLE_LICENSE_CAPABILITIES = new Set<ServiceCapability>([
  "license-recovery",
  "license-activation",
  "license-check",
  "checkout",
]);

export async function rejectIfDurableLicenseStateUnavailable(
  capability: ServiceCapability,
): Promise<Response | null> {
  if (!DURABLE_LICENSE_CAPABILITIES.has(capability)) return null;
  if (await productionLicensePersistenceReady()) return null;
  return Response.json(
    { ok: false, error: serviceUnavailableError() },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function rejectIfCapabilityLimited(capability: ServiceCapability): Promise<Response | null> {
  const durable = await rejectIfDurableLicenseStateUnavailable(capability);
  if (durable) return durable;

  const health = await readServiceHealth();
  if (isServiceCapabilityAvailable(capability, health)) return null;

  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (health.retryAfter) headers["Retry-After"] = String(health.retryAfter);

  return Response.json(
    {
      ok: false,
      error: serviceUnavailableError(),
      serviceState: health.serviceState,
      affectedCapabilities: health.affectedCapabilities,
      retryAfter: health.retryAfter,
    },
    { status: 503, headers },
  );
}

export async function rejectIfRateLimited(buckets: Array<{ key: string; limit: number }>): Promise<Response | null> {
  for (const bucket of buckets) {
    if (await isRateLimited(bucket.key, bucket.limit)) {
      return Response.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "900" } },
      );
    }
  }
  await Promise.all(buckets.map((bucket) => recordRateLimitEvent(bucket.key)));
  return null;
}
