/**
 * Cloudflare for SaaS — Custom Hostnames client.
 * Secrets and zone/account IDs come only from env. Never hardcode partners.
 */

export type CustomHostnameEnv = {
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_SAAS_ZONE_ID?: string;
  /** Public CNAME target partners point at (fallback origin hostname). */
  CLOUDFLARE_SAAS_CNAME_TARGET?: string;
};

export type CustomHostnameSslStatus =
  | "initializing"
  | "pending_validation"
  | "pending_issuance"
  | "pending_deployment"
  | "active"
  | "active_redeploying"
  | "moved"
  | "expired"
  | "deleted"
  | "unknown";

export type CustomHostnameOwnershipStatus =
  | "pending"
  | "active"
  | "moved"
  | "deleted"
  | "blocked"
  | "unknown";

export type NormalizedCustomHostnameStatus =
  | "pending"
  | "active"
  | "failed"
  | "unknown";

export type CustomHostnameDnsInstruction = {
  type: "CNAME" | "TXT" | "ALIAS";
  name: string;
  value: string;
  purpose: "routing" | "ownership" | "ssl" | "apex";
};

export type CustomHostnameRecord = {
  id: string;
  hostname: string;
  status: NormalizedCustomHostnameStatus;
  ownershipStatus: CustomHostnameOwnershipStatus;
  sslStatus: CustomHostnameSslStatus;
  dnsTarget: string;
  instructions: CustomHostnameDnsInstruction[];
  validationErrors: string[];
};

export class CustomHostnameConfigError extends Error {
  constructor(message = "Cloudflare Custom Hostname configuration is incomplete.") {
    super(message);
    this.name = "CustomHostnameConfigError";
  }
}

export class CustomHostnameApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "CustomHostnameApiError";
    this.status = status;
  }
}

type FetchLike = typeof fetch;

let fetchOverride: FetchLike | null = null;
let envOverride: CustomHostnameEnv | null = null;

export function setCustomHostnameFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
}

export function setCustomHostnameEnvForTests(env: CustomHostnameEnv | null): void {
  envOverride = env;
}

function readEnv(env?: CustomHostnameEnv): CustomHostnameEnv {
  if (envOverride) return envOverride;
  if (env) return env;
  return {
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_SAAS_ZONE_ID: process.env.CLOUDFLARE_SAAS_ZONE_ID,
    CLOUDFLARE_SAAS_CNAME_TARGET: process.env.CLOUDFLARE_SAAS_CNAME_TARGET,
  };
}

export function readCustomHostnameCnameTarget(env?: CustomHostnameEnv): string | null {
  const cnameTarget = readEnv(env).CLOUDFLARE_SAAS_CNAME_TARGET?.trim() ?? "";
  return cnameTarget || null;
}

export function isCustomHostnameApiConfigured(env?: CustomHostnameEnv): boolean {
  try {
    requireCustomHostnameEnv(env);
    return true;
  } catch {
    return false;
  }
}

export function requireCustomHostnameEnv(env?: CustomHostnameEnv): {
  token: string;
  accountId: string;
  zoneId: string;
  cnameTarget: string;
} {
  const source = readEnv(env);
  const token = source.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const accountId = source.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const zoneId = source.CLOUDFLARE_SAAS_ZONE_ID?.trim() ?? "";
  const cnameTarget = source.CLOUDFLARE_SAAS_CNAME_TARGET?.trim() ?? "";
  if (!token || !accountId || !zoneId || !cnameTarget) {
    throw new CustomHostnameConfigError();
  }
  return { token, accountId, zoneId, cnameTarget };
}

function apiBase(zoneId: string): string {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`;
}

function redactedHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeCustomHostnameStatus(input: {
  ownership?: string | null;
  ssl?: string | null;
}): NormalizedCustomHostnameStatus {
  const ownership = (input.ownership ?? "").toLowerCase();
  const ssl = (input.ssl ?? "").toLowerCase();
  if (ownership === "active" && (ssl === "active" || ssl === "active_redeploying")) {
    return "active";
  }
  if (
    ownership === "blocked" ||
    ownership === "deleted" ||
    ssl === "expired" ||
    ssl === "deleted"
  ) {
    return "failed";
  }
  if (!ownership && !ssl) return "unknown";
  return "pending";
}

function collectErrors(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const top = payload.errors;
  if (Array.isArray(top)) {
    for (const item of top) {
      const row = asRecord(item);
      if (typeof row.message === "string" && row.message.trim()) errors.push(row.message.trim());
    }
  }
  const result = asRecord(payload.result);
  const verification = result.verification_errors;
  if (Array.isArray(verification)) {
    for (const item of verification) {
      if (typeof item === "string" && item.trim()) errors.push(item.trim());
    }
  }
  return errors.slice(0, 12);
}

export function getDnsInstructions(
  hostname: string,
  cnameTarget: string,
  raw?: Record<string, unknown>,
): CustomHostnameDnsInstruction[] {
  const instructions: CustomHostnameDnsInstruction[] = [
    {
      type: "CNAME",
      name: hostname,
      value: cnameTarget,
      purpose: "routing",
    },
  ];

  const result = asRecord(raw);
  const ownership = Array.isArray(result.ownership_verification)
    ? result.ownership_verification
    : result.ownership_verification
      ? [result.ownership_verification]
      : [];
  for (const item of ownership) {
    const row = asRecord(item);
    if (typeof row.name === "string" && typeof row.value === "string") {
      instructions.push({
        type: "TXT",
        name: row.name,
        value: row.value,
        purpose: "ownership",
      });
    }
  }

  const ssl = asRecord(result.ssl);
  const validation = Array.isArray(ssl.validation_records) ? ssl.validation_records : [];
  for (const item of validation) {
    const row = asRecord(item);
    const name = typeof row.txt_name === "string" ? row.txt_name : typeof row.name === "string" ? row.name : "";
    const value =
      typeof row.txt_value === "string" ? row.txt_value : typeof row.value === "string" ? row.value : "";
    if (name && value) {
      instructions.push({ type: "TXT", name, value, purpose: "ssl" });
    }
  }

  const labels = hostname.split(".");
  if (labels.length === 2) {
    instructions.push({
      type: "ALIAS",
      name: hostname,
      value: cnameTarget,
      purpose: "apex",
    });
  }

  return instructions;
}

function mapRecord(
  raw: Record<string, unknown>,
  cnameTarget: string,
): CustomHostnameRecord {
  const ssl = asRecord(raw.ssl);
  const ownershipStatus = String(raw.status ?? "unknown") as CustomHostnameOwnershipStatus;
  const sslStatus = String(ssl.status ?? "unknown") as CustomHostnameSslStatus;
  return {
    id: String(raw.id ?? ""),
    hostname: String(raw.hostname ?? ""),
    status: normalizeCustomHostnameStatus({
      ownership: ownershipStatus,
      ssl: sslStatus,
    }),
    ownershipStatus: ownershipStatus || "unknown",
    sslStatus: sslStatus || "unknown",
    dnsTarget: cnameTarget,
    instructions: getDnsInstructions(String(raw.hostname ?? ""), cnameTarget, raw),
    validationErrors: collectErrors({ result: raw, errors: raw.errors }),
  };
}

async function parseCloudflareResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = asRecord(JSON.parse(text));
  } catch {
    payload = {};
  }
  if (!response.ok || payload.success === false) {
    const messages = collectErrors(payload);
    throw new CustomHostnameApiError(
      messages[0] ?? "Cloudflare Custom Hostname request failed.",
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }
  return payload;
}

export async function createCustomHostname(
  hostname: string,
  env?: CustomHostnameEnv,
): Promise<CustomHostnameRecord> {
  const { token, zoneId, cnameTarget } = requireCustomHostnameEnv(env);
  const doFetch = fetchOverride ?? fetch;
  const response = await doFetch(apiBase(zoneId), {
    method: "POST",
    headers: redactedHeaders(token),
    body: JSON.stringify({
      hostname,
      ssl: { method: "txt", type: "dv" },
    }),
  });
  const payload = await parseCloudflareResponse(response);
  return mapRecord(asRecord(payload.result), cnameTarget);
}

export async function getCustomHostname(
  id: string,
  env?: CustomHostnameEnv,
): Promise<CustomHostnameRecord> {
  const { token, zoneId, cnameTarget } = requireCustomHostnameEnv(env);
  const doFetch = fetchOverride ?? fetch;
  const response = await doFetch(`${apiBase(zoneId)}/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: redactedHeaders(token),
  });
  const payload = await parseCloudflareResponse(response);
  return mapRecord(asRecord(payload.result), cnameTarget);
}

export async function deleteCustomHostname(
  id: string,
  env?: CustomHostnameEnv,
): Promise<void> {
  const { token, zoneId } = requireCustomHostnameEnv(env);
  const doFetch = fetchOverride ?? fetch;
  const response = await doFetch(`${apiBase(zoneId)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: redactedHeaders(token),
  });
  await parseCloudflareResponse(response);
}
