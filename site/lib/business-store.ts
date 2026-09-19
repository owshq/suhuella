import type { LicenseGrant } from "./license-context.ts";
import { normalizeEmail } from "./license-context.ts";
import { parseLicenseGrant } from "./license-entitlement.ts";
import type {
  BusinessAccount,
  BusinessAccountStatus,
  BusinessBranding,
  BusinessSeat,
  BusinessSeatRole,
  BusinessSeatStatus,
} from "./business-types.ts";

export type BusinessStoreShape = {
  accounts: BusinessAccount[];
  seats: BusinessSeat[];
  grants: LicenseGrant[];
  brandings: BusinessBranding[];
};

export type BusinessStore = {
  load(): BusinessStoreShape;
  save(store: BusinessStoreShape): void;
};

const memory: BusinessStoreShape = { accounts: [], seats: [], grants: [], brandings: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
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
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
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

function emptyStore(): BusinessStoreShape {
  return {
    accounts: [...memory.accounts],
    seats: [...memory.seats],
    grants: [...memory.grants],
    brandings: [...memory.brandings],
  };
}

function defaultLoad(): BusinessStoreShape {
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

export function createMemoryBusinessStore(
  seed: BusinessStoreShape = { accounts: [], seats: [], grants: [], brandings: [] },
): BusinessStore {
  let current: BusinessStoreShape = {
    accounts: [...seed.accounts],
    seats: [...seed.seats],
    grants: [...seed.grants],
    brandings: [...(seed.brandings ?? [])],
  };
  return {
    load: () => ({
      accounts: [...current.accounts],
      seats: [...current.seats],
      grants: [...current.grants],
      brandings: [...current.brandings],
    }),
    save: (next) => {
      current = {
        accounts: [...next.accounts],
        seats: [...next.seats],
        grants: [...next.grants],
        brandings: [...(next.brandings ?? [])],
      };
    },
  };
}
