import type { OperationsConsoleSection } from "./routes";
import type { OperationsSnapshot } from "./types";

export type OperationsSearchHit = {
  id: string;
  kind: "customer" | "business" | "license" | "device" | "stripe";
  title: string;
  subtitle: string;
  section: OperationsConsoleSection;
  customerId?: string;
};

function includesNeedle(value: string | null | undefined, needle: string): boolean {
  return Boolean(value && value.toLowerCase().includes(needle));
}

export function searchOperationsSnapshot(
  snapshot: OperationsSnapshot,
  query: string,
): OperationsSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const hits: OperationsSearchHit[] = [];

  for (const customer of snapshot.customers) {
    if (includesNeedle(customer.email, needle) || includesNeedle(customer.id, needle)) {
      hits.push({
        id: customer.id,
        kind: "customer",
        title: customer.email,
        subtitle: customer.id,
        section: "customers",
        customerId: customer.id,
      });
    }
  }

  for (const organisation of snapshot.organisations) {
    if (
      includesNeedle(organisation.name, needle) ||
      includesNeedle(organisation.id, needle) ||
      includesNeedle(organisation.billingEmail, needle)
    ) {
      hits.push({
        id: organisation.id,
        kind: "business",
        title: organisation.name,
        subtitle: `${organisation.id} · ${organisation.billingEmail}`,
        section: "business",
      });
    }
  }

  for (const partner of snapshot.partners ?? []) {
    if (
      includesNeedle(partner.displayName, needle) ||
      includesNeedle(partner.slug, needle) ||
      includesNeedle(partner.brandId, needle) ||
      includesNeedle(partner.ownerEmail, needle) ||
      includesNeedle(partner.partnerId, needle)
    ) {
      hits.push({
        id: partner.partnerId,
        kind: "customer",
        title: partner.displayName,
        subtitle: `${partner.slug} · ${partner.brandId}`,
        section: "partners",
      });
    }
  }

  for (const license of snapshot.licenses) {
    const stripe = license.paymentReference;
    if (
      includesNeedle(license.id, needle) ||
      includesNeedle(license.email, needle) ||
      includesNeedle(license.customerId, needle) ||
      includesNeedle(stripe, needle)
    ) {
      hits.push({
        id: license.id,
        kind: stripe && includesNeedle(stripe, needle) ? "stripe" : "license",
        title: license.id,
        subtitle: [license.email, stripe].filter(Boolean).join(" · "),
        section: stripe && includesNeedle(stripe, needle) ? "billing" : "licenses",
        customerId: license.customerId,
      });
    }
  }

  for (const activation of snapshot.activations) {
    if (
      includesNeedle(activation.deviceId, needle) ||
      includesNeedle(activation.deviceName, needle) ||
      includesNeedle(activation.id, needle)
    ) {
      hits.push({
        id: activation.id,
        kind: "device",
        title: activation.deviceName || activation.deviceId,
        subtitle: `${activation.deviceId} · ${activation.licenseId}`,
        section: "licenses",
        customerId: activation.customerId,
      });
    }
  }

  const seen = new Set<string>();
  return hits
    .filter((hit) => {
      const key = `${hit.kind}:${hit.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}
