import { isServiceCapability, isServiceState, type ServiceCapability } from "../service-health.ts";
import {
  isAdminCreateOrigin,
  isLicenseEdition,
  isLicenseOrigin,
  isOrganisationPlan,
} from "./catalog.ts";
import type { OperationsAction } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Action payload must be an object.");
  }
  return value as Record<string, unknown>;
}

function asString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function asOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }
  return value;
}

function asNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number.`);
  }
  return value;
}

export function parseOperationsAction(value: unknown): OperationsAction {
  const record = asRecord(value);
  const action = asString(record, "action");
  const reason = asString(record, "reason");

  switch (action) {
    case "create_license": {
      const edition = asString(record, "edition");
      const origin = asString(record, "origin");
      if (!isLicenseEdition(edition)) throw new Error("Unknown edition.");
      if (!isLicenseOrigin(origin)) throw new Error("Unknown origin.");
      if (!isAdminCreateOrigin(origin)) {
        throw new Error("Admin can only create gift, promo, manual, internal, or test licenses.");
      }
      return {
        action,
        reason,
        email: asString(record, "email"),
        edition,
        origin,
        issuedByOperator: asOptionalString(record, "issuedByOperator"),
      };
    }
    case "update_customer_email":
      return {
        action,
        reason,
        customerId: asString(record, "customerId"),
        email: asString(record, "email"),
      };
    case "suspend_license":
    case "revoke_license":
    case "reactivate_license":
    case "restore_license":
    case "expire_license":
    case "refresh_license":
    case "reset_license_devices":
      return {
        action,
        reason,
        licenseId: asString(record, "licenseId"),
      };
    case "extend_license":
      return {
        action,
        reason,
        licenseId: asString(record, "licenseId"),
        validUntil: asString(record, "validUntil"),
      };
    case "create_organisation": {
      const plan = asString(record, "plan");
      if (!isOrganisationPlan(plan)) throw new Error("Unknown plan.");
      return {
        action,
        reason,
        name: asString(record, "name"),
        billingEmail: asString(record, "billingEmail"),
        seatCount: asNumber(record, "seatCount"),
        plan,
      };
    }
    case "add_seats":
    case "remove_seats":
      return {
        action,
        reason,
        organisationId: asString(record, "organisationId"),
        count: asNumber(record, "count"),
      };
    case "invite_user":
      return {
        action,
        reason,
        organisationId: asString(record, "organisationId"),
        email: asString(record, "email"),
      };
    case "suspend_seat":
    case "remove_seat":
    case "reactivate_seat":
    case "reset_seat_devices":
      return { action, reason, seatId: asString(record, "seatId") };
    case "change_admin":
      return {
        action,
        reason,
        organisationId: asString(record, "organisationId"),
        customerId: asString(record, "customerId"),
      };
    case "suspend_organisation":
    case "reactivate_organisation":
      return {
        action,
        reason,
        organisationId: asString(record, "organisationId"),
      };
    case "set_organisation_device_limit":
      return {
        action,
        reason,
        organisationId: asString(record, "organisationId"),
        deviceLimitPerSeat: asNumber(record, "deviceLimitPerSeat"),
      };
    case "deactivate_device":
      return {
        action,
        reason,
        activationId: asString(record, "activationId"),
      };
    case "rename_device":
      return {
        action,
        reason,
        activationId: asString(record, "activationId"),
        deviceName: asString(record, "deviceName"),
      };
    case "record_activation":
      return {
        action,
        reason,
        licenseId: asString(record, "licenseId"),
        deviceName: asString(record, "deviceName"),
        platform: asString(record, "platform"),
        appVersion: asString(record, "appVersion"),
      };
    case "receive_diagnostic":
      return {
        action,
        reason,
        source: asString(record, "source"),
        customerEmail: asOptionalString(record, "customerEmail"),
        payload: record.payload,
      };
    case "set_service_health": {
      const serviceState = asString(record, "serviceState");
      if (!isServiceState(serviceState)) throw new Error("Unknown service state.");
      const rawCapabilities = record.affectedCapabilities;
      let affectedCapabilities: ServiceCapability[] | undefined;
      if (rawCapabilities !== undefined) {
        if (!Array.isArray(rawCapabilities) || rawCapabilities.some((item) => typeof item !== "string" || !isServiceCapability(item))) {
          throw new Error("Unknown service capability.");
        }
        affectedCapabilities = rawCapabilities.filter(isServiceCapability);
      }
      const retryAfter = record.retryAfter;
      if (retryAfter !== undefined && retryAfter !== null && (typeof retryAfter !== "number" || !Number.isFinite(retryAfter))) {
        throw new Error("retryAfter must be a number or null.");
      }
      return {
        action,
        reason,
        serviceState,
        affectedCapabilities,
        retryAfter: retryAfter === undefined ? undefined : (retryAfter as number | null),
      };
    }
    case "create_partner": {
      const origin = asString(record, "origin");
      if (origin === "stripe") {
        throw new Error("Operations cannot create stripe partner entitlements.");
      }
      if (!["gift", "manual", "internal", "test"].includes(origin)) {
        throw new Error("Partner origin must be gift, manual, internal, or test.");
      }
      return {
        action,
        reason,
        slug: asString(record, "slug"),
        displayName: asString(record, "displayName"),
        ownerEmail: asString(record, "ownerEmail"),
        origin: origin as "gift" | "manual" | "internal" | "test",
        primaryDomain: asOptionalString(record, "primaryDomain"),
        validUntil: asOptionalString(record, "validUntil"),
      };
    }
    case "create_partner_invite": {
      const roleRaw = asOptionalString(record, "role");
      const role =
        roleRaw === "partner_member" || roleRaw === "partner_admin" ? roleRaw : "partner_admin";
      return {
        action,
        reason,
        partnerId: asString(record, "partnerId"),
        email: asString(record, "email"),
        role,
      };
    }
    case "suspend_partner":
    case "revoke_partner":
    case "reactivate_partner":
      return {
        action,
        reason,
        partnerId: asString(record, "partnerId"),
      };
    case "register_partner_domain":
      return {
        action,
        reason,
        partnerId: asString(record, "partnerId"),
        hostname: asString(record, "hostname"),
      };
    case "refresh_partner_domain":
    case "revoke_partner_domain":
      return {
        action,
        reason,
        partnerId: asString(record, "partnerId"),
        domainId: asString(record, "domainId"),
      };
    case "update_partner_branding": {
      if ("brandId" in record && record.brandId != null && record.brandId !== "") {
        throw new Error("brand_id from the client is not trusted.");
      }
      return {
        action,
        reason,
        partnerId: asString(record, "partnerId"),
        displayName: asOptionalString(record, "displayName"),
        logoUrl:
          record.logoUrl === null
            ? null
            : typeof record.logoUrl === "string"
              ? record.logoUrl.trim() || null
              : undefined,
        accent:
          record.accent === null
            ? null
            : typeof record.accent === "string"
              ? record.accent.trim() || null
              : undefined,
        onAccent:
          record.onAccent === null
            ? null
            : typeof record.onAccent === "string"
              ? record.onAccent.trim() || null
              : undefined,
      };
    }
    case "set_partner_application_status": {
      const status = asString(record, "status");
      if (status !== "pending" && status !== "in_review") {
        throw new Error("Application status must be pending or in_review.");
      }
      return {
        action,
        reason,
        applicationId: asString(record, "applicationId"),
        status,
      };
    }
    case "reject_partner_application":
      return {
        action,
        reason,
        applicationId: asString(record, "applicationId"),
        rejectionReason: asString(record, "rejectionReason"),
      };
    case "approve_partner_application": {
      const origin = asString(record, "origin");
      if (!["gift", "manual", "internal", "test"].includes(origin)) {
        throw new Error("Partner origin must be gift, manual, internal, or test.");
      }
      return {
        action,
        reason,
        applicationId: asString(record, "applicationId"),
        slug: asString(record, "slug"),
        origin: origin as "gift" | "manual" | "internal" | "test",
        displayName: asOptionalString(record, "displayName"),
      };
    }
    default:
      throw new Error("Unknown operations action.");
  }
}
