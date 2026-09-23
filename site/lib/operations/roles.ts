import type { OperationsAction, OperationsRole } from "./types";

export const OPERATIONS_OPERATOR_ROLES = ["ADMIN", "SUPPORT", "BILLING"] as const;

export type OperationsOperatorRole = (typeof OPERATIONS_OPERATOR_ROLES)[number];

/** Bootstrap Access role. Same authority as ADMIN until a role store exists. */
export function effectiveOperationsRole(
  role: OperationsRole,
): OperationsOperatorRole {
  if (role === "SUPPORT") return "SUPPORT";
  if (role === "BILLING") return "BILLING";
  return "ADMIN";
}

const SUPPORT_ACTIONS = new Set<OperationsAction["action"]>([
  "refresh_license",
  "deactivate_device",
  "rename_device",
  "reset_license_devices",
  "reset_seat_devices",
  "record_activation",
  "receive_diagnostic",
]);

const BILLING_ACTIONS = new Set<OperationsAction["action"]>([
  "refresh_license",
  "add_seats",
  "remove_seats",
  "create_organisation",
]);

export function operationsRoleLabel(role: OperationsRole): string {
  const effective = effectiveOperationsRole(role);
  if (effective === "SUPPORT") return "Support";
  if (effective === "BILLING") return "Billing";
  return "Admin";
}

export function canPerformOperationsAction(
  role: OperationsRole,
  action: OperationsAction["action"],
): boolean {
  const effective = effectiveOperationsRole(role);
  if (effective === "ADMIN") return true;
  if (effective === "SUPPORT") return SUPPORT_ACTIONS.has(action);
  return BILLING_ACTIONS.has(action);
}

export function operationsActionDeniedMessage(
  role: OperationsRole,
  action: OperationsAction["action"],
): string {
  return `${operationsRoleLabel(role)} cannot perform ${action}. Ops uses the same backend operations as the product — it does not bypass them.`;
}
