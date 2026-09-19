import type { LicenseGrant } from "./license-context.ts";
import {
  assertAdminCanRevokeLicense,
  classifyLicenseGrant,
  isAdminRevocableOrigin,
  paidRevokeError,
} from "./license-entitlement.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runOperationsAuditCheck(): void {
  assert(isAdminRevocableOrigin("gift") === true, "gift origin is admin-creatable");
  assert(isAdminRevocableOrigin("promo") === true, "promo origin is admin-creatable");
  assert(isAdminRevocableOrigin("stripe") === false, "admin cannot create a Stripe license");
  assert(isAdminRevocableOrigin("business") === false, "admin cannot create a paid business license");

  const paidLifetime: LicenseGrant = {
    email: "paid@acme.test",
    customerId: "cust_paid",
    licenseId: "lic_paid",
    edition: "personal_lifetime",
    origin: "stripe",
    status: "active",
  };
  assert(classifyLicenseGrant(paidLifetime).isRevocableByAdmin === false, "paid lifetime locked");
  let paidMessage = "";
  try {
    assertAdminCanRevokeLicense(paidLifetime);
  } catch (error) {
    paidMessage = error instanceof Error ? error.message : "";
  }
  assert(paidMessage === paidRevokeError(), "revoke API rejects paid lifetime");

  const paidMonthly: LicenseGrant = {
    ...paidLifetime,
    licenseId: "lic_monthly",
    edition: "personal_monthly",
  };
  try {
    assertAdminCanRevokeLicense(paidMonthly);
    throw new Error("monthly revoke should fail");
  } catch (error) {
    assert(
      error instanceof Error && error.message === paidRevokeError(),
      "revoke API rejects paid monthly",
    );
  }

  const paidBusiness: LicenseGrant = {
    ...paidLifetime,
    licenseId: "lic_biz",
    edition: "business",
    origin: "business",
  };
  try {
    assertAdminCanRevokeLicense(paidBusiness);
    throw new Error("business revoke should fail");
  } catch (error) {
    assert(
      error instanceof Error && error.message === paidRevokeError(),
      "revoke API rejects paid business",
    );
  }

  assertAdminCanRevokeLicense({
    email: "gift@acme.test",
    customerId: "cust_gift",
    licenseId: "lic_gift",
    edition: "personal_lifetime",
    origin: "gift",
    status: "active",
  });

  console.log("LICENSE-AUDIT-001 admin check passed");
}

runOperationsAuditCheck();
