import {
  deviceLimitForEdition,
  type LicenseEdition,
  type LicenseGrant,
} from "./license-context.ts";
import { businessDeviceLimitForAccount, businessService } from "./business-service.ts";

/** Effective device cap for enforcement and signed license context. */
export function effectiveDeviceLimitForGrant(grant: LicenseGrant): number {
  if (
    (grant.edition === "business" || grant.edition === "enterprise") &&
    grant.organisationId
  ) {
    const account = businessService.findAccount(grant.organisationId);
    if (account) return businessDeviceLimitForAccount(account);
  }
  return deviceLimitForEdition(grant.edition, grant.deviceLimit);
}

export function effectiveDeviceLimitForBusinessAccount(
  edition: LicenseEdition,
  account: Parameters<typeof businessDeviceLimitForAccount>[0],
): number {
  if (edition === "business" || edition === "enterprise") {
    return businessDeviceLimitForAccount(account);
  }
  return deviceLimitForEdition(edition);
}
