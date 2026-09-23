import {
  getDnsInstructions,
  isCustomHostnameApiConfigured,
  readCustomHostnameCnameTarget,
  type CustomHostnameDnsInstruction,
} from "../cloudflare/custom-hostnames.ts";
import { LOCAL_DEV_PARTNER_CNAME_TARGET, isNonProductionRuntime } from "../dev/env-defaults.ts";

/** Local dev without Cloudflare API — show real instructions; Refresh can activate. */
export function isPartnerDnsLocalSimMode(): boolean {
  return isNonProductionRuntime() && !isCustomHostnameApiConfigured();
}

export function resolvePartnerCnameTarget(cfTarget?: string | null): string {
  return (
    cfTarget?.trim() ||
    readCustomHostnameCnameTarget() ||
    (isNonProductionRuntime() ? LOCAL_DEV_PARTNER_CNAME_TARGET : "")
  );
}

export function localDevPartnerDnsInstructions(
  hostname: string,
  cnameTarget: string,
): CustomHostnameDnsInstruction[] {
  const instructions = getDnsInstructions(hostname, cnameTarget);
  if (instructions.some((row) => row.type === "TXT")) return instructions;
  instructions.push(
    {
      type: "TXT",
      name: `_cf-custom-hostname.${hostname}`,
      value: "local-dev-ownership-fixture",
      purpose: "ownership",
    },
    {
      type: "TXT",
      name: `_acme-challenge.${hostname}`,
      value: "local-dev-tls-fixture",
      purpose: "ssl",
    },
  );
  return instructions;
}

export function resolvePartnerDnsInstructions(input: {
  hostname: string;
  cnameTarget: string;
  cfInstructions?: CustomHostnameDnsInstruction[];
}): CustomHostnameDnsInstruction[] {
  if (input.cfInstructions?.length) return input.cfInstructions;
  if (isPartnerDnsLocalSimMode()) {
    return localDevPartnerDnsInstructions(input.hostname, input.cnameTarget);
  }
  return getDnsInstructions(input.hostname, input.cnameTarget);
}
