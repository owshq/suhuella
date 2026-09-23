import { monthlyAmountCents } from "./business-config.ts";
import { businessService } from "./business-service.ts";
import { OCCUPIED_SEAT_STATUSES, type BusinessAccount, type BusinessActor } from "./business-types.ts";

export type BusinessOrganisationRow = {
  seatId: string | null;
  email: string;
  seatStatus: "active" | "available" | "invited" | "revoked" | "expired";
  deviceName: string;
  platform: string;
  lastActive: string;
};

export type BusinessOrganisationOverview = {
  organisationName: string;
  organisationId: string;
  plan: "Business";
  seats: number;
  assigned: number;
  available: number;
  monthlyAmountCents: number;
  currency: string;
  nextBilling: string | null;
  billingAction: "checkout_business" | "change_seats";
  rows: BusinessOrganisationRow[];
};

function seatStatusLabel(status: string): BusinessOrganisationRow["seatStatus"] {
  if (status === "active") return "active";
  if (status === "invited") return "invited";
  if (status === "suspended") return "revoked";
  return "available";
}

function formatPlatform(platform: string): string {
  if (platform === "darwin") return "macOS";
  if (platform === "win32") return "Windows";
  if (platform === "linux") return "Linux";
  return platform.trim();
}

export function organisationOverviewFromInspection(
  account: BusinessAccount,
  seats: Array<{
    seat: { seatId: string; email: string; status: string; lastSeenAt: string | null };
    activations: Array<{
      status: string;
      deviceName?: string;
      platform?: string;
      lastSeen?: string;
    }>;
  }>,
): BusinessOrganisationOverview {
  const occupied = seats.filter((item) =>
    OCCUPIED_SEAT_STATUSES.includes(item.seat.status as (typeof OCCUPIED_SEAT_STATUSES)[number]),
  );
  const available = Math.max(0, account.seatLimit - occupied.length);
  const rows: BusinessOrganisationRow[] = seats.map((item) => {
    const activeDevice = item.activations.find((activation) => activation.status === "active");
    return {
      seatId: item.seat.seatId,
      email: item.seat.email,
      seatStatus: seatStatusLabel(item.seat.status),
      deviceName: activeDevice?.deviceName?.trim() || "",
      platform: formatPlatform(activeDevice?.platform ?? ""),
      lastActive: activeDevice?.lastSeen || item.seat.lastSeenAt || "",
    };
  });
  for (let index = 0; index < available; index += 1) {
    rows.push({
      seatId: null,
      email: "",
      seatStatus: "available",
      deviceName: "",
      platform: "",
      lastActive: "",
    });
  }

  return {
    organisationName: account.name,
    organisationId: account.organisationId,
    plan: "Business",
    seats: account.seatLimit,
    assigned: occupied.length,
    available,
    monthlyAmountCents: account.recurringAmountCents ?? monthlyAmountCents(account.seatLimit),
    currency: account.currency,
    nextBilling: account.currentPeriodEnd ?? account.trialEndsAt,
    billingAction: account.stripeSubscriptionId ? "change_seats" : "checkout_business",
    rows,
  };
}

export async function organisationOverviewForActor(actor: BusinessActor) {
  const organisationId = actor.kind === "business_admin" ? actor.organisationId : "";
  if (!organisationId && actor.kind !== "superadmin") {
    return { ok: false as const, error: "forbidden" as const };
  }
  const inspected = await businessService.inspectLicense(actor, organisationId);
  if (!inspected.ok) return inspected;
  return {
    ok: true as const,
    organisation: organisationOverviewFromInspection(inspected.value.account, inspected.value.seats),
  };
}
