import { getBusinessPricingConfig, monthlyAmountCents } from "./business-config.ts";
import { createBusinessService, licenseContextFromBusinessSeat } from "./business-service.ts";
import { createMemoryBusinessStore } from "./business-store.ts";
import type { LicenseGrant } from "./license-context.ts";

const superadmin = { kind: "superadmin" as const };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runBusinessLicenseCheck(): Promise<void> {
  const pricing = getBusinessPricingConfig();
  assert(pricing.minSeats === 20, "minimum seats must be 20");
  assert(pricing.seatPriceCents === 200, "seat price must be €2 (200 cents)");
  assert(pricing.currency === "eur", "currency must be eur");
  assert(pricing.minMonthlyCents === 4000, "minimum monthly amount must be €40");
  assert(monthlyAmountCents(20, pricing) === 4000, "20 seats must bill €40");
  assert(monthlyAmountCents(25, pricing) === 5000, "25 seats must bill €50");

  const personalGrants: LicenseGrant[] = [
    {
      email: "gift@acme.test",
      customerId: "cust_gift",
      licenseId: "lic_gift",
      edition: "personal_lifetime",
      origin: "gift",
      status: "active",
    },
  ];
  const activations = new Map<string, { deviceId: string; status: string }[]>();

  const service = createBusinessService({
    store: createMemoryBusinessStore(),
    pricing,
    licenses: {
      findGrantByEmail: (email) => personalGrants.find((item) => item.email === email),
      findGrantByLicenseId: (licenseId) =>
        personalGrants.find((item) => item.licenseId === licenseId),
      upsertGrant: (grant) => {
        const index = personalGrants.findIndex((item) => item.licenseId === grant.licenseId);
        if (index === -1) personalGrants.push(grant);
        else personalGrants[index] = grant;
        return grant;
      },
      resetActivations: async (licenseId) => {
        const current = activations.get(licenseId) ?? [];
        const reset = current.filter((item) => item.status === "active").length;
        activations.set(
          licenseId,
          current.map((item) => ({ ...item, status: "revoked" })),
        );
        return reset;
      },
      listActivations: async (licenseId) => activations.get(licenseId) ?? [],
    },
  });

  const tooSmall = service.createAccount(superadmin, { name: "Tiny", seatLimit: 19 });
  assert(!tooSmall.ok && tooSmall.error === "min_seats", "reject fewer than 20 seats");

  const created = service.createAccount(superadmin, {
    name: "ACME Ltd",
    seatLimit: 25,
    ownerEmail: "owner@acme.test",
    billingCustomerId: "cust_acme",
  });
  assert(created.ok, "superadmin can create a Business account");
  const account = created.value.account;
  const owner = created.value.owner;
  assert(account.plan === "business", "plan is Business");
  assert(account.seatLimit === 25, "organisation can have more than the 20-seat minimum");
  assert(owner?.role === "owner" && owner.status === "invited", "owner seat is invited");

  const adminActor = {
    kind: "business_admin" as const,
    email: "owner@acme.test",
    organisationId: account.organisationId,
  };

  const invited = service.inviteSeat(adminActor, account.organisationId, "ada@acme.test", "admin");
  assert(invited.ok && invited.value.status === "invited", "owner can invite");
  const member = service.inviteSeat(adminActor, account.organisationId, "ben@acme.test", "member");
  assert(member.ok, "owner can invite a member");

  const duplicate = service.inviteSeat(
    adminActor,
    account.organisationId,
    "ADA@acme.test",
    "member",
  );
  assert(!duplicate.ok && duplicate.error === "duplicate_email", "email is unique in the organisation");

  for (let index = 0; index < 18; index += 1) {
    const extra = service.inviteSeat(
      adminActor,
      account.organisationId,
      `user${index}@acme.test`,
      "member",
    );
    assert(extra.ok, `fill seat ${index}`);
  }

  const shrink = service.setSeatCount(superadmin, account.organisationId, 20);
  assert(!shrink.ok && shrink.error === "seat_in_use", "cannot go below assigned seats");

  const belowMin = service.setSeatCount(superadmin, account.organisationId, 19);
  assert(!belowMin.ok && belowMin.error === "min_seats", "cannot go below 20 seats");

  const otherOrg = service.createAccount(superadmin, {
    name: "Other Co",
    ownerEmail: "pat@other.test",
  });
  assert(otherOrg.ok, "second organisation");
  const cross = service.inviteSeat(
    adminActor,
    otherOrg.value.account.organisationId,
    "spy@acme.test",
  );
  assert(
    !cross.ok && cross.error === "cannot_access_other_organisation",
    "business admin cannot access another organisation",
  );

  const pricingLock = service.changeGlobalPricing();
  assert(
    !pricingLock.ok && pricingLock.error === "cannot_change_pricing",
    "pricing is not writable from Business admin",
  );
  const lifetime = service.grantPersonalLifetime();
  assert(
    !lifetime.ok && lifetime.error === "cannot_grant_lifetime",
    "Business cannot grant personal lifetime licenses",
  );
  const engine = service.modifyRecommendationEngine();
  assert(
    !engine.ok && engine.error === "cannot_modify_recommendation_engine",
    "Business cannot modify the Recommendation Engine",
  );
  const files = service.modifyUserFiles();
  assert(!files.ok && files.error === "cannot_modify_user_files", "Business cannot modify user files");

  activations.set(invited.value.licenseId, [{ deviceId: "dev_1", status: "active" }]);
  const reset = await service.resetSeatDevices(
    adminActor,
    account.organisationId,
    invited.value.seatId,
  );
  assert(reset.ok && reset.value.reset === 1, "business admin can reset devices for a seat");

  const converted = await service.convertLicense(superadmin, {
    organisationId: account.organisationId,
    licenseId: "lic_gift",
    role: "member",
  });
  assert(converted.ok && converted.value.grant.edition === "business", "convert gift → Business seat");
  assert(converted.value.grant.origin === "gift", "origin is preserved on convert");
  assert(converted.value.seat.licenseId === "lic_gift", "converted seat keeps licenseId");

  const grant = service.findBusinessGrantByEmail("ada@acme.test");
  assert(grant?.edition === "business", "active seat resolves to Business edition");
  assert(grant?.organisationId === account.organisationId, "grant includes organisationId");
  assert(grant?.organisationName === "ACME Ltd", "grant includes organisationName");
  assert(grant?.seatId === invited.value.seatId, "grant includes seatId");
  assert(!("seatPriceCents" in (grant ?? {})), "LicenseContext/grant has no price");

  const context = licenseContextFromBusinessSeat(account, invited.value, 1);
  assert(context?.edition === "business", "LicenseContext edition is business");
  assert(context?.organisationId === account.organisationId, "LicenseContext has organisationId");
  assert(context?.organisationName === "ACME Ltd", "LicenseContext has organisationName");
  assert(context?.seatId === invited.value.seatId, "LicenseContext has seatId");
  assert((context?.capabilities.length ?? 0) > 0, "LicenseContext has capabilities");
  assert(context && !("seatPriceCents" in context), "LicenseContext has no price");
  assert(
    !JSON.stringify(context).toLowerCase().includes("stripe"),
    "LicenseContext has no Stripe",
  );

  const paidSuspend = service.setOrganisationStatus(
    superadmin,
    account.organisationId,
    "suspended",
  );
  assert(
    !paidSuspend.ok && paidSuspend.error === "cannot_revoke_paid_license",
    "paid organisation cannot be manually revoked",
  );
  const stillActive = service.findBusinessGrantByEmail("ada@acme.test");
  assert(stillActive?.status === "active", "paid organisation license stays active");

  const seatHold = service.setSeatStatus(
    superadmin,
    account.organisationId,
    invited.value.seatId,
    "suspended",
  );
  assert(seatHold.ok && seatHold.value.status === "suspended", "admin can suspend a seat");
  const held = service.findBusinessGrantByEmail("ada@acme.test");
  assert(held?.status === "revoked", "suspended seat stops that license");
  assert(held?.isRevocableByAdmin === false, "seat license is not admin-revocable");

  const seatBack = service.setSeatStatus(
    superadmin,
    account.organisationId,
    invited.value.seatId,
    "active",
  );
  assert(seatBack.ok, "admin can reactivate a seat");
  const trial = service.grantTrial(superadmin, account.organisationId, 14);
  assert(trial.ok && trial.value.status === "trial", "superadmin can grant trial");

  const memberActor = {
    kind: "business_admin" as const,
    email: "ben@acme.test",
    organisationId: account.organisationId,
  };
  const memberInvite = service.inviteSeat(memberActor, account.organisationId, "nope@acme.test");
  assert(!memberInvite.ok && memberInvite.error === "forbidden", "members cannot manage seats");

  const removed = service.removeSeat(adminActor, account.organisationId, member.value.seatId);
  assert(removed.ok && removed.value.status === "removed", "admin can remove a seat");
  assert(
    service.findBusinessGrantByEmail("ben@acme.test") === undefined,
    "removed seat does not resolve a license",
  );

  assert(account.ownerEmail === "owner@acme.test", "owner email is persisted on the account");
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const ownerLogo = service.setBranding("owner@acme.test", account.organisationId, { dataUrl: png });
  assert(ownerLogo.ok && ownerLogo.value.logoAssetRef?.startsWith("data:image/png"), "owner can set logo");
  const adminLogo = service.setBranding("ada@acme.test", account.organisationId, { dataUrl: png });
  assert(!adminLogo.ok && adminLogo.error === "forbidden", "non-owner cannot set logo");
  const svgLogo = service.setBranding("owner@acme.test", account.organisationId, {
    dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
  });
  assert(!svgLogo.ok && svgLogo.error === "invalid_branding_asset", "svg logo rejected");
  const personalLogo = service.setBranding("gift@acme.test", account.organisationId, { dataUrl: png });
  assert(!personalLogo.ok && personalLogo.error === "forbidden", "personal paid user cannot set logo");
  const unknownOrg = service.setBranding("owner@acme.test", "org_missing", { dataUrl: png });
  assert(!unknownOrg.ok && unknownOrg.error === "not_found", "unknown organisation cannot set logo");
  const restored = service.setBranding("owner@acme.test", account.organisationId, { dataUrl: null });
  assert(restored.ok && restored.value.logoAssetRef === null, "owner can restore SuHuella logo");

  const suspended = service.createAccount(superadmin, {
    name: "Suspended Co",
    ownerEmail: "sue@suspended.test",
    status: "suspended",
  });
  assert(suspended.ok, "suspended organisation");
  const expiredLogo = service.setBranding("sue@suspended.test", suspended.value.account.organisationId, {
    dataUrl: png,
  });
  assert(!expiredLogo.ok && expiredLogo.error === "forbidden", "inactive Business cannot set logo");

  const ownerless = service.createAccount(superadmin, { name: "No Owner Co" });
  assert(ownerless.ok && ownerless.value.account.ownerEmail === null, "owner is not inferred");
  const inferred = service.setBranding("anyone@acme.test", ownerless.value.account.organisationId, {
    dataUrl: png,
  });
  assert(!inferred.ok && inferred.error === "forbidden", "missing owner cannot mutate branding");

  const inspected = await service.inspectLicense(superadmin, account.organisationId);
  assert(inspected.ok, "superadmin can inspect license status");
  assert(
    inspected.value.seats.every((item) => item.context === null || item.context.edition === "business"),
    "inspected seats map to Business LicenseContext",
  );

  console.log("BUSINESS-LICENSE-001 check passed");
}

void runBusinessLicenseCheck();
