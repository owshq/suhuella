function token(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function createCustomerId(): string {
  return `cust_${token()}`;
}

export function createLicenseId(): string {
  return `lic_${token()}`;
}

export function createOrganisationId(): string {
  return `org_${token()}`;
}

export function createSeatId(): string {
  return `seat_${token()}`;
}

export function createActivationId(): string {
  return `act_${token()}`;
}

export function createDeviceId(): string {
  return `dev_${token()}`;
}

export function createDiagnosticId(): string {
  return `diag_${token()}`;
}

export function createAuditId(): string {
  return `aud_${token()}`;
}

export function createRequestId(): string {
  return `req_${token()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
