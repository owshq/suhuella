import type { LicenseGrant } from "./license-context.ts";
import { normalizeEmail } from "./license-context.ts";
import { parseLicenseGrant } from "./license-entitlement.ts";
import type {
  BusinessAccount,
  BusinessAccountStatus,
  BusinessBillingInterval,
  BusinessBranding,
  BusinessSeat,
  BusinessSeatChangeRecord,
  BusinessSeatRole,
  BusinessSeatStatus,
  ProcessedStripeEvent,
} from "./business-types.ts";

export type BusinessStoreShape = {
  accounts: BusinessAccount[];
  seats: BusinessSeat[];
  grants: LicenseGrant[];
  brandings: BusinessBranding[];
  seatChanges: BusinessSeatChangeRecord[];
  stripeEvents: ProcessedStripeEvent[];
};

export type BusinessStore = {
  load(): BusinessStoreShape;
  save(store: BusinessStoreShape): void;
};

const memory: BusinessStoreShape = {
  accounts: [],
  seats: [],
  grants: [],
  brandings: [],
  seatChanges: [],
  stripeEvents: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function storePath(): string | null {
  const configured = process.env.BUSINESS_STORE_PATH?.trim();
  if (configured) return configured;
  if (typeof process.versions?.node === "string") {
    return ".data/business.json";
  }
  return null;
}

function nodeFs(): typeof import("node:fs") | null {
  try {
    return require("node:fs") as typeof import("node:fs");
  } catch {
    return null;
  }
}

function parseAccount(value: unknown): BusinessAccount | null {
  if (!isRecord(value)) return null;
  if (typeof value.organisationId !== "string" || typeof value.name !== "string") {
    return null;
  }
  const status: BusinessAccountStatus =
    value.status === "trial" || value.status === "suspended" ? value.status : "active";
  return {
    organisationId: value.organisationId,
    name: value.name,
    billingCustomerId:
      typeof value.billingCustomerId === "string" ? value.billingCustomerId : "",
    ownerEmail: typeof value.ownerEmail === "string" ? normalizeEmail(value.ownerEmail) : null,
    plan: value.plan === "enterprise" ? "enterprise" : "business",
    seatLimit: typeof value.seatLimit === "number" ? value.seatLimit : 0,
    seatPriceCents: typeof value.seatPriceCents === "number" ? value.seatPriceCents : 200,
    currency: typeof value.currency === "string" ? value.currency : "eur",
    status,
    trialEndsAt: typeof value.trialEndsAt === "string" ? value.trialEndsAt : null,
    stripeSubscriptionId:
      typeof value.stripeSubscriptionId === "string" ? value.stripeSubscriptionId : null,
    stripeSubscriptionItemId:
      typeof value.stripeSubscriptionItemId === "string" ? value.stripeSubscriptionItemId : null,
    stripeStatus: typeof value.stripeStatus === "string" ? value.stripeStatus : null,
    currentPeriodEnd: typeof value.currentPeriodEnd === "string" ? value.currentPeriodEnd : null,
    recurringAmountCents:
      typeof value.recurringAmountCents === "number" ? value.recurringAmountCents : null,
    billingInterval: parseInterval(value.billingInterval),
    billingNeedsReconciliation: value.billingNeedsReconciliation === true,
    lastStripeEventId: typeof value.lastStripeEventId === "string" ? value.lastStripeEventId : null,
    lastStripeEventCreated:
      typeof value.lastStripeEventCreated === "number" ? value.lastStripeEventCreated : null,
    stripeCheckoutSessionId:
      typeof value.stripeCheckoutSessionId === "string" ? value.stripeCheckoutSessionId : null,
    deviceLimitPerSeat:
      typeof value.deviceLimitPerSeat === "number" && Number.isInteger(value.deviceLimitPerSeat)
        ? value.deviceLimitPerSeat
        : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function parseInterval(value: unknown): BusinessBillingInterval | null {
  return value === "year" || value === "month" ? value : null;
}

function parseSeat(value: unknown): BusinessSeat | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.seatId !== "string" ||
    typeof value.organisationId !== "string" ||
    typeof value.email !== "string" ||
    typeof value.licenseId !== "string"
  ) {
    return null;
  }
  const role: BusinessSeatRole =
    value.role === "owner" || value.role === "admin" || value.role === "member"
      ? value.role
      : "member";
  const status: BusinessSeatStatus =
    value.status === "active" ||
    value.status === "suspended" ||
    value.status === "removed"
      ? value.status
      : "invited";
  return {
    seatId: value.seatId,
    organisationId: value.organisationId,
    email: normalizeEmail(value.email),
    role,
    status,
    licenseId: value.licenseId,
    invitedAt: typeof value.invitedAt === "string" ? value.invitedAt : new Date().toISOString(),
    activatedAt: typeof value.activatedAt === "string" ? value.activatedAt : null,
    lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : null,
  };
}

function parseGrant(value: unknown): LicenseGrant | null {
  return parseLicenseGrant(value);
}

function parseBranding(value: unknown): BusinessBranding | null {
  if (!isRecord(value) || typeof value.organisationId !== "string") return null;
  return {
    organisationId: value.organisationId,
    logoAssetRef: typeof value.logoAssetRef === "string" ? value.logoAssetRef : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    updatedByEmail: typeof value.updatedByEmail === "string" ? normalizeEmail(value.updatedByEmail) : "",
  };
}

function parseSeatChange(value: unknown): BusinessSeatChangeRecord | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.organisationId !== "string") {
    return null;
  }
  if (value.source !== "desktop" && value.source !== "ops" && value.source !== "webhook") {
    return null;
  }
  if (value.result !== "success" && value.result !== "rejected" && value.result !== "failed") {
    return null;
  }
  return {
    id: value.id,
    organisationId: value.organisationId,
    actorEmail: typeof value.actorEmail === "string" ? value.actorEmail : "",
    actorKind: value.actorKind === "business_admin" ? "business_admin" : "superadmin",
    actorRole: typeof value.actorRole === "string" ? value.actorRole : null,
    source: value.source,
    reason: typeof value.reason === "string" ? value.reason : null,
    previousQuantity: typeof value.previousQuantity === "number" ? value.previousQuantity : 0,
    requestedQuantity: typeof value.requestedQuantity === "number" ? value.requestedQuantity : 0,
    confirmedQuantity: typeof value.confirmedQuantity === "number" ? value.confirmedQuantity : null,
    stripeSubscriptionId:
      typeof value.stripeSubscriptionId === "string" ? value.stripeSubscriptionId : null,
    result: value.result,
    error: typeof value.error === "string" ? value.error : null,
    timestamp: typeof value.timestamp === "string" ? value.timestamp : new Date().toISOString(),
  };
}

function parseStripeEvent(value: unknown): ProcessedStripeEvent | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    receivedAt: typeof value.receivedAt === "string" ? value.receivedAt : new Date().toISOString(),
  };
}

function emptyStore(): BusinessStoreShape {
  return {
    accounts: [...memory.accounts],
    seats: [...memory.seats],
    grants: [...memory.grants],
    brandings: [...memory.brandings],
    seatChanges: [...memory.seatChanges],
    stripeEvents: [...memory.stripeEvents],
  };
}

function defaultLoad(): BusinessStoreShape {
  if (isProductionRuntime()) {
    return emptyBusinessStoreShape();
  }
  const filePath = storePath();
  const fs = nodeFs();
  if (!filePath || !fs?.existsSync(filePath)) {
    return emptyStore();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(parsed)) return emptyStore();
    return {
      accounts: Array.isArray(parsed.accounts)
        ? parsed.accounts.map(parseAccount).filter((item): item is BusinessAccount => item !== null)
        : [...memory.accounts],
      seats: Array.isArray(parsed.seats)
        ? parsed.seats.map(parseSeat).filter((item): item is BusinessSeat => item !== null)
        : [...memory.seats],
      grants: Array.isArray(parsed.grants)
        ? parsed.grants.map(parseGrant).filter((item): item is LicenseGrant => item !== null)
        : [...memory.grants],
      brandings: Array.isArray(parsed.brandings)
        ? parsed.brandings.map(parseBranding).filter((item): item is BusinessBranding => item !== null)
        : [...memory.brandings],
      seatChanges: Array.isArray(parsed.seatChanges)
        ? parsed.seatChanges
            .map(parseSeatChange)
            .filter((item): item is BusinessSeatChangeRecord => item !== null)
        : [...memory.seatChanges],
      stripeEvents: Array.isArray(parsed.stripeEvents)
        ? parsed.stripeEvents
            .map(parseStripeEvent)
            .filter((item): item is ProcessedStripeEvent => item !== null)
        : [...memory.stripeEvents],
    };
  } catch {
    return emptyStore();
  }
}

function defaultSave(store: BusinessStoreShape): void {
  memory.accounts = store.accounts;
  memory.seats = store.seats;
  memory.grants = store.grants;
  memory.brandings = store.brandings ?? [];
  memory.seatChanges = store.seatChanges ?? [];
  memory.stripeEvents = store.stripeEvents ?? [];
  const filePath = storePath();
  const fs = nodeFs();
  if (!filePath || !fs) return;
  try {
    fs.mkdirSync(require("node:path").dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    // Worker / read-only runtime — memory only.
  }
}

export const defaultBusinessStore: BusinessStore = {
  load: defaultLoad,
  save: defaultSave,
};

export function emptyBusinessStoreShape(): BusinessStoreShape {
  return { accounts: [], seats: [], grants: [], brandings: [], seatChanges: [], stripeEvents: [] };
}

export function createMemoryBusinessStore(
  seed: Partial<BusinessStoreShape> = {},
): BusinessStore {
  let current: BusinessStoreShape = {
    accounts: [...(seed.accounts ?? [])],
    seats: [...(seed.seats ?? [])],
    grants: [...(seed.grants ?? [])],
    brandings: [...(seed.brandings ?? [])],
    seatChanges: [...(seed.seatChanges ?? [])],
    stripeEvents: [...(seed.stripeEvents ?? [])],
  };
  return {
    load: () => ({
      accounts: [...current.accounts],
      seats: [...current.seats],
      grants: [...current.grants],
      brandings: [...current.brandings],
      seatChanges: [...current.seatChanges],
      stripeEvents: [...current.stripeEvents],
    }),
    save: (next) => {
      current = {
        accounts: [...next.accounts],
        seats: [...next.seats],
        grants: [...next.grants],
        brandings: [...(next.brandings ?? [])],
        seatChanges: [...(next.seatChanges ?? [])],
        stripeEvents: [...(next.stripeEvents ?? [])],
      };
    },
  };
}
