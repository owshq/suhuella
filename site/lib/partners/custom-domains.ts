import {
  createCustomHostname,
  CustomHostnameApiError,
  CustomHostnameConfigError,
  deleteCustomHostname,
  getCustomHostname,
  isCustomHostnameApiConfigured,
  type CustomHostnameDnsInstruction,
  type CustomHostnameRecord,
} from "../cloudflare/custom-hostnames.ts";
import { applyLocalDevEnvDefaults } from "../dev/env-defaults.ts";
import { assertPartnerScope, assertPlatformActor } from "./authz.ts";
import {
  dnsInstructionsFor,
  isReservedPlatformHostname,
  normalizeHostname,
} from "./domains.ts";
import { createPartnerDomainId, nowIso } from "./ids.ts";
import { getPartnerStore } from "./store.ts";
import {
  type PartnerActor,
  type PartnerDnsInstructions,
  type PartnerDomainKind,
  type PartnerDomainRecord,
  type PartnerDomainStatus,
} from "./types.ts";
import { PartnerError } from "./errors.ts";
import {
  buildPartnerDnsPackage,
  type PartnerDnsActivationStep,
  type PartnerDnsRecordView,
} from "./partner-dns-activation.ts";
import {
  isPartnerDnsLocalSimMode,
  resolvePartnerCnameTarget,
  resolvePartnerDnsInstructions,
} from "./partner-dns-local-dev.ts";

export type PartnerCustomDomainView = {
  domain: PartnerDomainRecord;
  dns: PartnerDnsInstructions;
  instructions: PartnerDnsRecordView[];
  steps: PartnerDnsActivationStep[];
  localDevMode: boolean;
  sslStatus: string | null;
  ownershipStatus: string | null;
};

function assertPartnerSelfServiceActor(actor: PartnerActor): void {
  if (actor.kind === "platform") {
    throw new PartnerError(
      "Partners configure brand, hostname, and DNS in their own panel at /partners/portal.",
      403,
      "partner_self_service_only",
    );
  }
}

async function syncCloudflareCustomHostname(
  hostname: string,
  existingId: string | null | undefined,
): Promise<CustomHostnameRecord | null> {
  if (!isCustomHostnameApiConfigured()) return null;
  try {
    if (existingId) return await getCustomHostname(existingId);
    return await createCustomHostname(hostname);
  } catch (error) {
    if (error instanceof CustomHostnameConfigError) return null;
    throw error;
  }
}

function domainKey(domain: PartnerDomainRecord): string {
  return domain.normalizedHostname || domain.hostname;
}

async function mutateDomains(
  fn: (domains: PartnerDomainRecord[], ctx: {
    partners: { partnerId: string; status: string }[];
    brands: { partnerId: string; brandId: string; canonicalDomain: string | null; updatedAt: string }[];
  }) => Promise<void> | void,
): Promise<void> {
  const store = await getPartnerStore();
  const doc = await store.read();
  await fn(doc.domains, { partners: doc.partners, brands: doc.brands });
  await store.write(doc);
}

function formatDnsInstructionLines(
  instructions: CustomHostnameDnsInstruction[],
): string {
  return instructions
    .map((row) => `${row.type} ${row.name} → ${row.value} (${row.purpose})`)
    .join("\n");
}

function toView(
  domain: PartnerDomainRecord,
  cf?: CustomHostnameRecord | null,
): PartnerCustomDomainView {
  applyLocalDevEnvDefaults();
  const localDevMode = isPartnerDnsLocalSimMode();
  const target = resolvePartnerCnameTarget(domain.dnsTarget || cf?.dnsTarget);
  const instructionRows = resolvePartnerDnsInstructions({
    hostname: domain.hostname,
    cnameTarget: target,
    cfInstructions: cf?.instructions,
  });
  const dnsPackage = buildPartnerDnsPackage({
    hostname: domain.hostname,
    status: domain.status,
    cnameTarget: target || null,
    instructions: instructionRows,
    localDevMode,
  });
  return {
    domain,
    dns: dnsInstructionsFor(domain.hostname, target || "configure CLOUDFLARE_SAAS_CNAME_TARGET"),
    instructions: dnsPackage.instructions,
    steps: dnsPackage.steps,
    localDevMode,
    sslStatus: cf?.sslStatus ?? (localDevMode && domain.status === "active" ? "active" : null),
    ownershipStatus:
      cf?.ownershipStatus ?? (localDevMode && domain.status === "active" ? "active" : null),
  };
}

function mapCfStatus(status: CustomHostnameRecord["status"]): PartnerDomainStatus {
  if (status === "active") return "active";
  if (status === "failed") return "failed";
  return "pending";
}

/**
 * Register a Custom Hostname for a partner. Idempotent on normalized hostname.
 * partner_id / brand_id are taken from the authorized actor + partner brand row.
 */
export async function registerPartnerCustomDomain(
  actor: PartnerActor,
  input: {
    partnerId: string;
    hostname: string;
    kind?: PartnerDomainKind;
  },
): Promise<PartnerCustomDomainView> {
  assertPartnerSelfServiceActor(actor);
  assertPartnerScope(actor, input.partnerId, "partner_admin");
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PartnerError("Invalid hostname.");
  if (isReservedPlatformHostname(hostname)) {
    throw new PartnerError("That hostname is reserved by the platform.");
  }

  applyLocalDevEnvDefaults();
  if (!isPartnerDnsLocalSimMode() && !isCustomHostnameApiConfigured()) {
    throw new PartnerError(
      "Cloudflare Custom Hostname API is not configured. Hostname registration is unavailable until all platform Cloudflare SaaS secrets are set.",
      503,
      "cloudflare_not_configured",
    );
  }

  const store = await getPartnerStore();
  const doc = await store.read();
  const existing = doc.domains.find(
    (item) => item.normalizedHostname === hostname || item.hostname === hostname,
  );
  if (existing && existing.partnerId !== input.partnerId) {
    throw new PartnerError("Domain is already associated with a partner.");
  }
  if (existing && existing.status !== "revoked") {
    const cf = await syncCloudflareCustomHostname(
      hostname,
      existing.cloudflareCustomHostnameId,
    );
    return toView(existing, cf);
  }

  const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
  if (!partner) throw new PartnerError("Partner not found.", 404);
  if (partner.status === "revoked" || partner.status === "suspended") {
    throw new PartnerError("Partner cannot register domains in this state.", 409);
  }
  const brand = doc.brands.find((item) => item.partnerId === input.partnerId);
  if (!brand) throw new PartnerError("Partner brand missing.", 500);

  let cf: CustomHostnameRecord | null = null;
  try {
    cf = await syncCloudflareCustomHostname(hostname, null);
  } catch (error) {
    if (error instanceof CustomHostnameApiError) {
      throw new PartnerError(error.message, error.status === 409 ? 409 : 502);
    }
    throw error;
  }

  applyLocalDevEnvDefaults();
  const cnameTarget = resolvePartnerCnameTarget(cf?.dnsTarget);
  if (!cnameTarget) {
    throw new PartnerError(
      "SuHuella cannot show DNS targets yet. Hostname registration opens when CLOUDFLARE_SAAS_CNAME_TARGET is configured on the platform.",
      503,
      "cloudflare_not_configured",
    );
  }

  const now = nowIso();
  const kind = input.kind ?? "primary";
  const instructionRows = resolvePartnerDnsInstructions({
    hostname,
    cnameTarget,
    cfInstructions: cf?.instructions,
  });
  const dnsPackage = buildPartnerDnsPackage({
    hostname,
    status: cf ? mapCfStatus(cf.status) : "pending",
    cnameTarget,
    instructions: instructionRows,
    localDevMode: isPartnerDnsLocalSimMode(),
  });
  let domain!: PartnerDomainRecord;

  await mutateDomains(async (domains, ctx) => {
    const again = domains.find((item) => item.normalizedHostname === hostname);
    if (again && again.partnerId !== input.partnerId) {
      throw new PartnerError("Domain is already associated with a partner.");
    }
    const validationErrors = cf
      ? formatDnsInstructionLines(cf.instructions) || cf.validationErrors.join("; ") || null
      : formatDnsInstructionLines(
          dnsPackage.instructions.map(({ purposeLabel: _p, ...row }) => row),
        );

    if (again) {
      again.status = cf ? mapCfStatus(cf.status) : "pending";
      again.cloudflareCustomHostnameId = cf?.id ?? again.cloudflareCustomHostnameId;
      again.dnsTarget = cnameTarget;
      again.validationErrors = validationErrors;
      again.updatedAt = now;
      if (cf?.status === "active") again.verifiedAt = now;
      domain = again;
      return;
    }
    domain = {
      domainId: createPartnerDomainId(),
      partnerId: input.partnerId,
      brandId: brand.brandId,
      hostname,
      normalizedHostname: hostname,
      kind,
      status: cf ? mapCfStatus(cf.status) : "pending",
      cloudflareCustomHostnameId: cf?.id ?? null,
      dnsTarget: cnameTarget,
      validationErrors,
      verificationTokenHash: null,
      verifiedAt: cf?.status === "active" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    domains.push(domain);
    const brandRow = ctx.brands.find((item) => item.partnerId === input.partnerId);
    if (brandRow && kind === "primary" && !brandRow.canonicalDomain) {
      brandRow.canonicalDomain = hostname;
      brandRow.updatedAt = now;
    }
  });

  return toView(domain, cf);
}

export async function listPartnerCustomDomains(
  actor: PartnerActor,
  partnerId: string,
): Promise<PartnerCustomDomainView[]> {
  assertPartnerScope(actor, partnerId);
  const store = await getPartnerStore();
  const doc = await store.read();
  return doc.domains
    .filter((item) => item.partnerId === partnerId && item.status !== "revoked")
    .map((domain) => toView(domain));
}

export async function refreshPartnerCustomDomain(
  actor: PartnerActor,
  input: { partnerId: string; domainId: string },
): Promise<PartnerCustomDomainView> {
  assertPartnerSelfServiceActor(actor);
  assertPartnerScope(actor, input.partnerId, "partner_admin");
  const store = await getPartnerStore();
  const doc = await store.read();
  const domain = doc.domains.find(
    (item) => item.domainId === input.domainId && item.partnerId === input.partnerId,
  );
  if (!domain) throw new PartnerError("Domain not found.", 404);

  let cf: CustomHostnameRecord | null = null;
  try {
    cf = await syncCloudflareCustomHostname(domain.hostname, domain.cloudflareCustomHostnameId);
  } catch (error) {
    if (error instanceof CustomHostnameApiError) {
      throw new PartnerError(error.message, 502);
    }
    throw error;
  }

  applyLocalDevEnvDefaults();
  const localDevMode = isPartnerDnsLocalSimMode();
  const cnameTarget = resolvePartnerCnameTarget(cf?.dnsTarget ?? domain.dnsTarget);
  const instructionRows = resolvePartnerDnsInstructions({
    hostname: domain.hostname,
    cnameTarget,
    cfInstructions: cf?.instructions,
  });
  const dnsPackage = buildPartnerDnsPackage({
    hostname: domain.hostname,
    status: cf ? mapCfStatus(cf.status) : domain.status,
    cnameTarget: cnameTarget || null,
    instructions: instructionRows,
    localDevMode,
  });
  const now = nowIso();
  await mutateDomains((domains) => {
    const row = domains.find((item) => item.domainId === input.domainId);
    if (!row) throw new PartnerError("Domain not found.", 404);
    if (row.status === "revoked" || row.status === "suspended") return;
    if (cf) {
      row.cloudflareCustomHostnameId = cf.id;
      row.status = mapCfStatus(cf.status);
      row.validationErrors =
        formatDnsInstructionLines(cf.instructions) ||
        cf.validationErrors.join("; ") ||
        null;
      if (cf.status === "active") row.verifiedAt = now;
    } else if (localDevMode) {
      row.status = "active";
      row.verifiedAt = now;
      row.validationErrors = null;
    } else if (!cf) {
      throw new PartnerError(
        "DNS refresh is unavailable until Cloudflare Custom Hostnames are configured on the platform.",
        503,
        "cloudflare_not_configured",
      );
    } else {
      row.validationErrors = formatDnsInstructionLines(
        dnsPackage.instructions.map(({ purposeLabel: _p, ...record }) => record),
      );
    }
    if (cnameTarget) row.dnsTarget = cnameTarget;
    row.updatedAt = now;
  });

  const next = (await getPartnerStore()).read().then((d) =>
    d.domains.find((item) => item.domainId === input.domainId),
  );
  const updated = await next;
  if (!updated) throw new PartnerError("Domain not found.", 404);
  return toView(updated, cf);
}

export async function revokePartnerCustomDomain(
  actor: PartnerActor,
  input: { partnerId: string; domainId: string },
): Promise<PartnerDomainRecord> {
  if (actor.kind === "platform") assertPlatformActor(actor);
  else assertPartnerScope(actor, input.partnerId, "partner_admin");

  const store = await getPartnerStore();
  const doc = await store.read();
  const domain = doc.domains.find(
    (item) => item.domainId === input.domainId && item.partnerId === input.partnerId,
  );
  if (!domain) throw new PartnerError("Domain not found.", 404);

  if (domain.cloudflareCustomHostnameId) {
    try {
      await deleteCustomHostname(domain.cloudflareCustomHostnameId);
    } catch (error) {
      if (error instanceof CustomHostnameConfigError) {
        throw new PartnerError(
          "Custom hostname service is not configured.",
          503,
          "cloudflare_not_configured",
        );
      }
      // 404 from CF is fine — already gone.
      if (!(error instanceof CustomHostnameApiError && error.status === 404)) {
        if (error instanceof CustomHostnameApiError) {
          throw new PartnerError(error.message, 502);
        }
        throw error;
      }
    }
  }

  const now = nowIso();
  await mutateDomains((domains) => {
    const row = domains.find((item) => item.domainId === input.domainId);
    if (!row) throw new PartnerError("Domain not found.", 404);
    row.status = "revoked";
    row.cloudflareCustomHostnameId = null;
    row.validationErrors = null;
    row.updatedAt = now;
  });

  const updated = (await (await getPartnerStore()).read()).domains.find(
    (item) => item.domainId === input.domainId,
  );
  if (!updated) throw new PartnerError("Domain not found.", 404);
  return updated;
}

export function cnameTargetConfigured(): boolean {
  return isCustomHostnameApiConfigured();
}

export type { PartnerCustomDomainView as PartnerDomainRegistration };
export { domainKey };
