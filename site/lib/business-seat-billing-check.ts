import { createMemoryBusinessBillingClient } from "./business-billing.ts";
import { getBusinessPricingConfig } from "./business-config.ts";
import { organisationOverviewFromInspection } from "./business-organisation.ts";
import { createBusinessService } from "./business-service.ts";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { createMemoryBusinessStore } from "./business-store.ts";
import { applyStripeBusinessWebhook } from "./business-webhooks.ts";
import {
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
} from "./license-persistence/store.ts";
import { resetStripeEventProcessingForTests } from "./stripe-event-processing.ts";
import { canPerformOperationsAction } from "./operations/roles.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pricing = getBusinessPricingConfig();
const superadmin = { kind: "superadmin" as const };

function seedSubscription() {
  return createMemoryBusinessBillingClient({
    subscriptionId: "sub_acme",
    subscriptionItemId: "si_acme",
    customerId: "cus_acme",
    quantity: 25,
    status: "active",
    currentPeriodEnd: "2026-10-21T00:00:00.000Z",
    amountCents: 5000,
    currency: "eur",
    interval: "month",
    priceId: "price_business",
  });
}

function attachStripe(store: ReturnType<typeof createMemoryBusinessStore>, organisationId: string) {
  const data = store.load();
  const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
  data.accounts[index] = {
    ...data.accounts[index],
    billingCustomerId: "cus_acme",
    stripeSubscriptionId: "sub_acme",
    stripeSubscriptionItemId: "si_acme",
    stripeStatus: "active",
    recurringAmountCents: 5000,
  };
  store.save(data);
}

export async function runBusinessSeatBillingCheck(): Promise<void> {
  const stripeEventStorePath = join(process.cwd(), ".data", "business-seat-billing-check-stripe-events.json");
  try {
    unlinkSync(stripeEventStorePath);
  } catch {
    /* first run */
  }
  process.env.LICENSE_STORE_PATH = stripeEventStorePath;
  setLicensePersistenceDatabaseForTests(null);
  resetLicensePersistenceStoreForTests();
  resetStripeEventProcessingForTests();
  assert(canPerformOperationsAction("ADMIN", "add_seats"), "Ops Admin may change seats");
  assert(canPerformOperationsAction("BILLING", "add_seats"), "Ops Billing may change seats");
  assert(!canPerformOperationsAction("SUPPORT", "add_seats"), "Ops Support cannot change seats");

  const store = createMemoryBusinessStore();
  const billing = seedSubscription();
  const service = createBusinessService({ store, billing, pricing });

  const created = service.createAccount(superadmin, {
    name: "ACME Ltd",
    seatLimit: 25,
    ownerEmail: "owner@acme.test",
    billingCustomerId: "cus_acme",
  });
  assert(created.ok, "create Business account");
  const organisationId = created.value.account.organisationId;
  attachStripe(store, organisationId);

  const owner = {
    kind: "business_admin" as const,
    email: "owner@acme.test",
    organisationId,
  };
  const invited = service.inviteSeat(owner, organisationId, "ada@acme.test", "admin");
  assert(invited.ok, "owner can invite admin");
  const member = service.inviteSeat(owner, organisationId, "ben@acme.test", "member");
  assert(member.ok, "owner can invite member");

  const memberActor = {
    kind: "business_admin" as const,
    email: "ben@acme.test",
    organisationId,
  };
  const memberChange = await service.changeSeatQuantity(memberActor, organisationId, 30, {
    source: "desktop",
  });
  assert(!memberChange.ok && memberChange.error === "forbidden", "Business member cannot change seats");
  assert(service.findAccount(organisationId)?.seatLimit === 25, "rejected member change leaves entitlement");

  const belowMin = await service.changeSeatQuantity(owner, organisationId, 19, {
    source: "desktop",
  });
  assert(!belowMin.ok && belowMin.error === "min_seats", "below minimum rejected");
  assert(billing.updates === 0, "validation failure never calls Stripe");

  for (let index = 0; index < 22; index += 1) {
    assert(
      service.inviteSeat(owner, organisationId, `user${index}@acme.test`).ok,
      `assign extra ${index}`,
    );
  }
  const assigned = service.assignedSeatCount(organisationId);
  assert(assigned > 20, "enough seats assigned to block a decrease to 20");
  const tooLow = await service.changeSeatQuantity(owner, organisationId, 20, { source: "desktop" });
  assert(!tooLow.ok && tooLow.error === "seat_in_use", "cannot decrease below assigned");
  assert(billing.updates === 0, "assigned-count rejection never calls Stripe");
  assert(
    service.listSeatChanges(organisationId).some((item) => item.result === "rejected" && item.error === "seat_in_use"),
    "rejection is audited",
  );

  billing.failNext = "stripe_unavailable";
  const failed = await service.changeSeatQuantity(superadmin, organisationId, 30, {
    source: "ops",
    reason: "Need more seats for onboarding",
    actorRole: "ADMIN",
  });
  assert(!failed.ok && failed.error === "stripe_unavailable", "Stripe failure is returned");
  assert(service.findAccount(organisationId)?.seatLimit === 25, "Stripe failure leaves entitlement unchanged");
  assert(
    service.listSeatChanges(organisationId).some((item) => item.result === "failed" && item.source === "ops"),
    "failed Ops change is audited",
  );

  const increased = await service.changeSeatQuantity(owner, organisationId, 30, {
    source: "desktop",
  });
  assert(increased.ok && increased.value.seatLimit === 30, "valid increase becomes purchased seats");
  assert(billing.current?.quantity === 30, "Stripe quantity is 30");
  assert(increased.value.recurringAmountCents === 6000, "monthly amount follows Stripe quantity");
  assert(service.assignedSeatCount(organisationId) === assigned, "assigned seats unchanged after purchase increase");
  assert(increased.value.seatLimit - assigned === 30 - assigned, "available = purchased - assigned");

  const retry = await service.changeSeatQuantity(owner, organisationId, 30, {
    source: "desktop",
  });
  assert(retry.ok && retry.value.seatLimit === 30, "duplicate request is safe");
  assert(billing.updates === 1, "matching Stripe quantity does not mutate again");

  billing.current = {
    ...billing.current!,
    quantity: 28,
    amountCents: 5600,
  };
  const qtyEventId = "evt_qty_28_business_seat_billing_check";
  const webhook = await applyStripeBusinessWebhook({
    id: qtyEventId,
    type: "customer.subscription.updated",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        object: "subscription",
        id: "sub_acme",
        customer: "cus_acme",
        status: "active",
        current_period_end: Math.floor(Date.parse("2026-11-21T00:00:00.000Z") / 1000),
        items: {
          data: [
            {
              id: "si_acme",
              quantity: 28,
              price: { id: "price_business", unit_amount: 200, currency: "eur", recurring: { interval: "month" } },
            },
          ],
        },
      },
    },
  }, service, { skipPersistenceRequirement: true });
  assert(webhook.ok, "webhook reconciles subscription quantity");
  assert(service.findAccount(organisationId)?.seatLimit === 28, "purchased seats follow confirmed Stripe state");

  const duplicateEvent = await applyStripeBusinessWebhook({
    id: qtyEventId,
    type: "customer.subscription.updated",
    data: { object: { id: "sub_acme" } },
  }, service, { skipPersistenceRequirement: true });
  assert(duplicateEvent.ok && duplicateEvent.duplicate === true, "duplicate webhook is idempotent");

  billing.current = null;
  const noSub = await service.changeSeatQuantity(owner, organisationId, 32, {
    source: "desktop",
  });
  assert(!noSub.ok && noSub.error === "subscription_missing", "missing subscription is rejected");

  const inspected = await service.inspectLicense(owner, organisationId);
  assert(inspected.ok, "owner can inspect after billing");
  const overview = organisationOverviewFromInspection(inspected.value.account, inspected.value.seats);
  assert(overview.billingAction === "change_seats", "subscription-backed orgs change seats in Desktop");
  assert(overview.monthlyAmountCents === inspected.value.account.recurringAmountCents, "overview uses billing amount");
  assert(overview.available === overview.seats - overview.assigned, "available remains purchased minus assigned");

  const successAudit = service.listSeatChanges(organisationId).find((item) => item.result === "success");
  assert(successAudit?.source === "desktop", "success audit records Desktop source");
  assert(successAudit?.stripeSubscriptionId === "sub_acme", "success audit stores Stripe reference");

  console.log("BUSINESS seat billing lifecycle check passed");
}

void runBusinessSeatBillingCheck();
