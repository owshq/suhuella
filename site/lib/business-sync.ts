import { getBusinessPricingConfig } from "./business-config.ts";
import type { BusinessAccount, BusinessSeat, BusinessSeatRole } from "./business-types.ts";
import { defaultBusinessStore } from "./business-store.ts";

type OperationsOrganisation = {
  id: string;
  name: string;
  adminCustomerId: string | null;
  seatCount: number;
  plan: string;
  status: string;
  createdAt: string;
};

type OperationsSeat = {
  id: string;
  organisationId: string;
  customerId: string | null;
  email: string;
  status: string;
  licenseId: string | null;
  createdAt: string;
};

/** Keep Business seats aligned with Superadmin Operations organisations. */
export function syncBusinessFromOperations(input: {
  organisations: OperationsOrganisation[];
  seats: OperationsSeat[];
}): void {
  const pricing = getBusinessPricingConfig();
  const data = defaultBusinessStore.load();
  const now = new Date().toISOString();

  for (const organisation of input.organisations) {
    if (organisation.plan !== "business") continue;

    const ownerSeat = input.seats.find(
      (seat) =>
        seat.organisationId === organisation.id &&
        seat.customerId &&
        seat.customerId === organisation.adminCustomerId,
    );
    const existing = data.accounts.find((item) => item.organisationId === organisation.id);
    const account: BusinessAccount = {
      organisationId: organisation.id,
      name: organisation.name,
      billingCustomerId: organisation.adminCustomerId ?? "",
      ownerEmail: ownerSeat?.email ?? existing?.ownerEmail ?? null,
      plan: "business",
      seatLimit: organisation.seatCount,
      seatPriceCents: pricing.seatPriceCents,
      currency: pricing.currency,
      status: organisation.status === "suspended" ? "suspended" : "active",
      trialEndsAt: null,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      stripeSubscriptionItemId: existing?.stripeSubscriptionItemId ?? null,
      stripeStatus: existing?.stripeStatus ?? null,
      currentPeriodEnd: existing?.currentPeriodEnd ?? null,
      recurringAmountCents: existing?.recurringAmountCents ?? null,
      billingInterval: existing?.billingInterval ?? null,
      billingNeedsReconciliation: existing?.billingNeedsReconciliation ?? false,
      lastStripeEventId: existing?.lastStripeEventId ?? null,
      lastStripeEventCreated: existing?.lastStripeEventCreated ?? null,
      stripeCheckoutSessionId: existing?.stripeCheckoutSessionId ?? null,
      createdAt: organisation.createdAt,
      updatedAt: now,
    };

    const accountIndex = data.accounts.findIndex(
      (item) => item.organisationId === organisation.id,
    );
    if (accountIndex === -1) data.accounts.push(account);
    else data.accounts[accountIndex] = { ...data.accounts[accountIndex], ...account };

    for (const seat of input.seats.filter((item) => item.organisationId === organisation.id)) {
      const role: BusinessSeatRole =
        seat.customerId && seat.customerId === organisation.adminCustomerId ? "owner" : "member";
      const mapped: BusinessSeat = {
        seatId: seat.id,
        organisationId: seat.organisationId,
        email: seat.email,
        role,
        status:
          seat.status === "suspended"
            ? "suspended"
            : seat.status === "active"
              ? "active"
              : "invited",
        licenseId: seat.licenseId ?? `lic_${seat.id}`,
        invitedAt: seat.createdAt,
        activatedAt: seat.status === "active" ? seat.createdAt : null,
        lastSeenAt: data.seats.find((item) => item.seatId === seat.id)?.lastSeenAt ?? null,
      };
      const seatIndex = data.seats.findIndex((item) => item.seatId === seat.id);
      if (seatIndex === -1) data.seats.push(mapped);
      else {
        data.seats[seatIndex] = {
          ...mapped,
          lastSeenAt: data.seats[seatIndex].lastSeenAt,
        };
      }
    }
  }

  defaultBusinessStore.save(data);
}
