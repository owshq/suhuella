import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canPerformOperationsAction,
  effectiveOperationsRole,
  operationsRoleLabel,
} from "./operations/roles.ts";
import { operationsSectionFromSlug } from "./operations/routes.ts";
import { searchOperationsSnapshot } from "./operations/search.ts";
import type { OperationsSnapshot } from "./operations/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const consoleSource = readFileSync(
  path.join(root, "components/operations/OperationsConsole.tsx"),
  "utf8",
);

assert(operationsSectionFromSlug("dashboard") === "dashboard", "dashboard is primary");
assert(operationsSectionFromSlug("customers") === "customers", "customers is primary");
assert(operationsSectionFromSlug("partners") === "partners", "partners is primary");
assert(operationsSectionFromSlug("onboarding") === "partners", "onboarding folds into Partners");
assert(operationsSectionFromSlug("business") === "business", "business is primary");
assert(operationsSectionFromSlug("licenses") === "licenses", "licenses is primary");
assert(operationsSectionFromSlug("billing") === "billing", "billing is primary");
assert(operationsSectionFromSlug("activity") === "activity", "activity is primary");
assert(operationsSectionFromSlug("seats") === "business", "seats fold into Business");
assert(operationsSectionFromSlug("gifts") === "licenses", "gifts fold into Licenses");
assert(operationsSectionFromSlug("audit") === "activity", "audit folds into Activity");

assert(effectiveOperationsRole("SUPER_ADMIN") === "ADMIN", "Access bootstrap is Admin");
assert(operationsRoleLabel("SUPER_ADMIN") === "Admin", "bootstrap label is Admin");
assert(canPerformOperationsAction("ADMIN", "add_seats") === true, "Admin can change seats");
assert(canPerformOperationsAction("SUPPORT", "add_seats") === false, "Support cannot change seats");
assert(
  canPerformOperationsAction("SUPPORT", "deactivate_device") === true,
  "Support can deactivate a device",
);
assert(canPerformOperationsAction("BILLING", "revoke_license") === false, "Billing cannot revoke");
assert(canPerformOperationsAction("BILLING", "add_seats") === true, "Billing can change seats");
assert(
  canPerformOperationsAction("SUPPORT", "set_service_health") === false,
  "Support cannot change infrastructure",
);

const snapshot = {
  persistence: "memory",
  actor: { email: "ops@suhuella.com", role: "SUPER_ADMIN" },
  customers: [
    {
      id: "cus_acme",
      email: "owner@acme.test",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: null,
    },
  ],
  licenses: [
    {
      id: "lic_acme",
      customerId: "cus_acme",
      email: "owner@acme.test",
      edition: "business",
      origin: "stripe",
      status: "active",
      entitlementStatus: "active",
      isPaid: true,
      isGifted: false,
      isRevocableByAdmin: false,
      validUntil: null,
      currentPeriodEnd: "2026-10-21T00:00:00.000Z",
      deviceLimit: 3,
      deviceCount: 1,
      capabilities: [],
      lastCheckedAt: null,
      paymentProvider: "stripe",
      paymentReference: "sub_123",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    },
  ],
  organisations: [
    {
      id: "org_acme",
      name: "ACME Ltd",
      billingEmail: "owner@acme.test",
      seatCount: 25,
      assignedSeatCount: 21,
      availableSeatCount: 4,
      monthlyAmountCents: 5000,
      currency: "eur",
      plan: "business",
      status: "active",
      adminCustomerId: "cus_acme",
      isPaid: true,
      stripeSubscriptionStatus: "Active",
      currentPeriodEnd: "2026-10-21T00:00:00.000Z",
      deviceLimitPerSeat: 3,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  partners: [],
  partnerApplications: [
    {
      applicationId: "ptr_app_test",
      normalizedEmail: "apply@example.com",
      displayName: "Apply Co",
      status: "pending",
      partnerId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    },
  ],
  seats: [],
  activations: [
    {
      id: "dev_1",
      licenseId: "lic_acme",
      customerId: "cus_acme",
      deviceId: "device-support-ref",
      deviceName: "MacBook de Ana",
      platform: "darwin",
      appVersion: "0.1.0",
      lastSeenAt: "2026-09-01T00:00:00.000Z",
      status: "active",
    },
  ],
  diagnostics: [],
  audit: [],
  serviceHealth: {
    serviceState: "NORMAL",
    affectedCapabilities: [],
    retryAfter: null,
    updatedAt: null,
    updatedBy: null,
    persistence: "memory",
  },
} as OperationsSnapshot;

const byCompany = searchOperationsSnapshot(snapshot, "ACME Ltd");
assert(byCompany.some((hit) => hit.kind === "business" && hit.section === "business"), "search finds company name");

const byLicense = searchOperationsSnapshot(snapshot, "lic_acme");
assert(byLicense.some((hit) => hit.kind === "license"), "search finds license key");

const byStripe = searchOperationsSnapshot(snapshot, "sub_123");
assert(byStripe.some((hit) => hit.kind === "stripe"), "search finds Stripe ID");
assert(byStripe[0]?.section === "billing", "Stripe ID opens Billing");

const byDevice = searchOperationsSnapshot(snapshot, "device-support-ref");
assert(byDevice.some((hit) => hit.kind === "device"), "search finds device / support ref");

assert(consoleSource.includes("control center"), "console presents as control center");
assert(
  consoleSource.includes("Search email, company, license key, device, support ref, Stripe ID"),
  "global search is in the header",
);
assert(consoleSource.includes('["partners", "Partners"]'), "Partners is a top-level area");
assert(consoleSource.includes("/partners/portal"), "Ops directs partners to self-service portal");
assert(consoleSource.includes("self-service"), "Partners section documents self-service DNS");
assert(consoleSource.includes("partner_admin"), "Partners documents partner_admin role");
assert(consoleSource.includes("partner_member"), "Partners documents partner_member role");
assert(consoleSource.includes("valid_until"), "Partners create can set optional valid_until");
assert(consoleSource.includes("license_grant"), "Partners clarifies entitlement vs license_grant");
assert(consoleSource.includes("validationErrors"), "Partners show DNS validation lines");
assert(consoleSource.includes("Partner configures hostname"), "Ops does not register domains");
assert(consoleSource.includes("onboarding"), "Partners flow mentions onboarding");
assert(consoleSource.includes("Applications ("), "Partners lists public applications");
assert(consoleSource.includes("approve_partner_application"), "Ops can approve applications");
assert(consoleSource.includes("reject_partner_application"), "Ops can reject applications");
assert(consoleSource.includes("set_partner_application_status"), "Ops can mark applications in review");
assert(
  consoleSource.includes("register interest only") &&
    consoleSource.includes("do not grant entitlements"),
  "Ops clarifies interest is not entitlement",
);
const opsService = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "operations/service.ts"),
  "utf8",
);
assert(
  opsService.includes("Manual onboarding invite delivery"),
  "Ops approve copy mentions manual invite delivery",
);
assert(
  opsService.includes("Partner self-service only"),
  "Ops blocks hostname and branding configuration",
);
assert(!consoleSource.includes("fca590"), "Ops UI never hardcodes a DCV zone hash");
assert(!consoleSource.includes("app.your-domain.com"), "Ops UI does not mandate app. hostname");
assert(consoleSource.includes("documents.example.com"), "Ops UI uses reserved example hostname");
assert(!consoleSource.includes('"full"'), "Ops console does not invent a full edition");
assert(consoleSource.includes('["billing", "Billing"]'), "Billing is a top-level area");
assert(consoleSource.includes('["activity", "Activity"]'), "Activity is a top-level area");
assert(!consoleSource.includes("Business Accounts"), "Business is not a Settings-style extra tab");
assert(consoleSource.includes("assignedSeatCount"), "Business card shows assigned seats");
assert(consoleSource.includes("Stripe subscription"), "Business card shows Stripe state");

console.log("OPERATIONS control-center check passed");
