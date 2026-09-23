import type { PartnerDnsInstructions } from "./types.ts";

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Production SuHuella hosts that resolve to the platform brand. */
export const PLATFORM_PUBLIC_HOSTNAMES = [
  "suhuella.com",
  "www.suhuella.com",
  "ops.suhuella.com",
] as const;

/** Platform hosts that partners may never claim. Same set as public platform hosts. */
export const PLATFORM_RESERVED_HOSTNAMES = PLATFORM_PUBLIC_HOSTNAMES;

const DEVELOPMENT_LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function authorizedWorkerName(): string {
  const configured = process.env.CF_WORKER_NAME?.trim();
  return (configured || "suhuella").toLowerCase();
}

/**
 * Normalize a hostname from a Host / X-Forwarded-Host value.
 * Strips scheme, path, query, fragment, port, trailing dot, and lowercases.
 * Accepts loopback literals without a dot (localhost, 127.0.0.1, ::1).
 * Rejects wildcards, spaces, and malformed values.
 *
 * Full URLs are tolerated defensively (scheme/path stripped) but callers that
 * expect a registrable partner hostname must reject values that contained a path.
 */
export function normalizeHostname(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] ?? "";
  value = value.split("?")[0] ?? "";
  value = value.split("#")[0] ?? "";
  if (value.includes("*") || value.includes(" ")) return null;

  if (value.startsWith("[") && value.includes("]")) {
    const inner = value.slice(1, value.indexOf("]"));
    if (!inner || !DEVELOPMENT_LOOPBACK_HOSTNAMES.has(inner)) return null;
    return inner;
  }

  if (value.includes(":")) {
    value = value.split(":")[0] ?? "";
  }
  if (value.endsWith(".")) value = value.slice(0, -1);
  if (!value) return null;

  if (DEVELOPMENT_LOOPBACK_HOSTNAMES.has(value) || value.endsWith(".localhost")) {
    return value;
  }

  if (!HOSTNAME_RE.test(value)) return null;
  return value;
}

/** True when the normalized hostname is local loopback used for development. */
export function isDevelopmentLoopbackHostname(normalized: string): boolean {
  return (
    DEVELOPMENT_LOOPBACK_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost")
  );
}

/** Any `*.workers.dev` hostname (authorized or not). */
export function isWorkersDevHostname(normalized: string): boolean {
  return normalized.endsWith(".workers.dev");
}

/**
 * Worker `suhuella` dev origin only — `suhuella.<account>.workers.dev`.
 * Arbitrary `*.workers.dev` hostnames are not platform SuHuella.
 */
export function isAuthorizedWorkersDevHostname(normalized: string): boolean {
  if (!isWorkersDevHostname(normalized)) return false;
  const worker = authorizedWorkerName();
  return normalized.split(".")[0] === worker;
}

/**
 * Hostnames that resolve to the SuHuella platform brand (never a partner overlay).
 * Does not include unknown or pending partner domains.
 */
export function isPlatformPublicHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if ((PLATFORM_PUBLIC_HOSTNAMES as readonly string[]).includes(normalized)) return true;
  if (isDevelopmentLoopbackHostname(normalized)) return true;
  if (isAuthorizedWorkersDevHostname(normalized)) return true;
  return false;
}

/**
 * Hostnames partners may never register.
 * Includes all platform hosts, all loopback/dev hosts, and every `*.workers.dev`.
 */
export function isReservedPlatformHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if ((PLATFORM_RESERVED_HOSTNAMES as readonly string[]).includes(normalized)) return true;
  if (isWorkersDevHostname(normalized)) return true;
  if (isDevelopmentLoopbackHostname(normalized)) return true;
  return false;
}

/** Partner onboarding / Custom Hostname registration input validation. */
export function isPartnerRegisterableHostname(raw: string): boolean {
  const normalized = normalizeHostname(raw);
  if (!normalized) return false;
  if (isReservedPlatformHostname(normalized)) return false;
  return true;
}

export function isApexHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  return normalized.split(".").length === 2;
}

export function dnsInstructionsFor(
  hostname: string,
  cnameTarget: string,
): PartnerDnsInstructions {
  const apex = isApexHostname(hostname);
  return {
    hostname,
    txtName: "",
    txtValueHint: "",
    cnameTarget,
    notes: [
      apex
        ? "Apex domains may require ALIAS/ANAME, DNS delegation, or a Cloudflare apex mode. Universal CNAME compatibility is not guaranteed."
        : `Create a CNAME for ${hostname} pointing to ${cnameTarget}.`,
      "Keep your nameservers at your current DNS provider. SuHuella does not move nameservers.",
      "Do not put Cloudflare Access on the public partner site — only on ops hostnames.",
    ],
  };
}

export function opsHostnameForPrimary(primaryHostname: string): string {
  const host = normalizeHostname(primaryHostname);
  if (!host) return "";
  if (host.startsWith("ops.")) return host;
  return `ops.${host}`;
}

/**
 * Standard partner subdomains (e.g. documents.example.com) use only the
 * Custom Hostname traffic CNAME + ownership/SSL TXT that Cloudflare returns.
 * DCV Delegation is optional advanced config — never required for these hosts.
 */
export function partnerHostnameUsesStandardCustomHostnameDns(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (normalized.startsWith("*.")) return false;
  if (isApexHostname(normalized)) return false;
  return normalized.split(".").length >= 3;
}

/**
 * DCV Delegation is an optional Cloudflare account/zone feature for apex,
 * wildcards, non-proxied hosts, or long-lived ACME without repeating TXT.
 * This codebase never invents a DCV zone id — if enabled later, use the value
 * returned by Cloudflare or a dedicated secret (never hardcode account hashes).
 */
export function partnerHostnameMayUseOptionalDcvDelegation(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  return isApexHostname(normalized) || normalized.startsWith("*.");
}
