import type {
  LicenseEdition,
  LicenseOrigin,
  LicenseStatus,
} from "@/lib/license-context";
import type {
  ServiceCapability,
  ServiceHealthSnapshot,
  ServiceState,
} from "../service-health";

export type { LicenseEdition, LicenseOrigin, LicenseStatus, ServiceCapability, ServiceState };

export const LICENSE_EDITIONS = [
  "personal_lifetime",
  "personal_monthly",
  "business",
  "enterprise",
] as const;

export const LICENSE_ORIGINS = [
  "stripe",
  "gift",
  "promo",
  "manual",
  "internal",
  "test",
  "partner",
  "migration",
  "education",
  "enterprise",
] as const;

export const LICENSE_STATUSES = [
  "active",
  "suspended",
  "expired",
  "revoked",
] as const;

export const ORGANISATION_PLANS = ["business", "enterprise"] as const;

export const ORGANISATION_STATUSES = ["active", "suspended"] as const;

export const SEAT_STATUSES = ["invited", "active", "suspended"] as const;

export const ACTIVATION_STATUSES = ["active", "deactivated"] as const;

export type OrganisationPlan = (typeof ORGANISATION_PLANS)[number];
export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];
export type SeatStatus = (typeof SEAT_STATUSES)[number];
export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];
export type PersistenceKind = "file" | "d1" | "memory";

export type OperationsRole = "SUPER_ADMIN";

export type OperationsActor = {
  email: string;
  role: OperationsRole;
};

export type Customer = {
  id: string;
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export type License = {
  id: string;
  customerId: string;
  email: string;
  edition: LicenseEdition;
  origin: LicenseOrigin;
  status: LicenseStatus | "suspended";
  entitlementStatus: string;
  isPaid: boolean;
  isGifted: boolean;
  isRevocableByAdmin: boolean;
  validUntil: string | null;
  currentPeriodEnd: string | null;
  deviceLimit: number;
  deviceCount: number;
  capabilities: string[];
  lastCheckedAt: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  createdAt: string;
  createdBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
};

export type Organisation = {
  id: string;
  name: string;
  billingEmail: string;
  seatCount: number;
  plan: OrganisationPlan;
  status: OrganisationStatus;
  adminCustomerId: string | null;
  isPaid: boolean;
  createdAt: string;
};

export type Seat = {
  id: string;
  organisationId: string;
  customerId: string | null;
  email: string;
  status: SeatStatus;
  licenseId: string | null;
  createdAt: string;
};

export type Activation = {
  id: string;
  licenseId: string;
  customerId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  lastSeenAt: string;
  status: ActivationStatus;
};

export type DiagnosticExport = {
  id: string;
  receivedAt: string;
  source: string;
  customerEmail: string | null;
  payload: unknown;
  compatibilityStatus: string | null;
};

export type AuditEntry = {
  id: string;
  actor: string;
  adminEmail: string;
  adminRole: OperationsRole;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  reason: string;
  requestId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

export type OperationsSnapshot = {
  persistence: PersistenceKind;
  actor: OperationsActor;
  customers: Customer[];
  licenses: License[];
  organisations: Organisation[];
  seats: Seat[];
  activations: Activation[];
  diagnostics: DiagnosticExport[];
  audit: AuditEntry[];
  serviceHealth: ServiceHealthSnapshot & { persistence: PersistenceKind };
};

export type OperationsAction =
  | {
      action: "create_license";
      reason: string;
      email: string;
      edition: LicenseEdition;
      origin: LicenseOrigin;
    }
  | {
      action: "update_customer_email";
      reason: string;
      customerId: string;
      email: string;
    }
  | {
      action: "suspend_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "revoke_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "reactivate_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "restore_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "expire_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "extend_license";
      reason: string;
      licenseId: string;
      validUntil: string;
    }
  | {
      action: "refresh_license";
      reason: string;
      licenseId: string;
    }
  | {
      action: "create_organisation";
      reason: string;
      name: string;
      billingEmail: string;
      seatCount: number;
      plan: OrganisationPlan;
    }
  | {
      action: "add_seats";
      reason: string;
      organisationId: string;
      count: number;
    }
  | {
      action: "remove_seats";
      reason: string;
      organisationId: string;
      count: number;
    }
  | {
      action: "invite_user";
      reason: string;
      organisationId: string;
      email: string;
    }
  | {
      action: "suspend_seat";
      reason: string;
      seatId: string;
    }
  | {
      action: "remove_seat";
      reason: string;
      seatId: string;
    }
    | {
      action: "reactivate_seat";
      reason: string;
      seatId: string;
    }
  | {
      action: "change_admin";
      reason: string;
      organisationId: string;
      customerId: string;
    }
  | {
      action: "suspend_organisation";
      reason: string;
      organisationId: string;
    }
  | {
      action: "reactivate_organisation";
      reason: string;
      organisationId: string;
    }
  | {
      action: "deactivate_device";
      reason: string;
      activationId: string;
    }
  | {
      action: "rename_device";
      reason: string;
      activationId: string;
      deviceName: string;
    }
  | {
      action: "reset_license_devices";
      reason: string;
      licenseId: string;
    }
  | {
      action: "reset_seat_devices";
      reason: string;
      seatId: string;
    }
  | {
      action: "record_activation";
      reason: string;
      licenseId: string;
      deviceName: string;
      platform: string;
      appVersion: string;
    }
    | {
      action: "receive_diagnostic";
      reason: string;
      source: string;
      customerEmail?: string;
      payload: unknown;
    }
    | {
      action: "set_service_health";
      reason: string;
      serviceState: ServiceState;
      affectedCapabilities?: ServiceCapability[];
      retryAfter?: number | null;
    };

export type OperationsDocument = {
  version: 1;
  diagnostics: DiagnosticExport[];
  audit: AuditEntry[];
};
