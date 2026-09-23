import { brand as platformBrand, brandCssVars } from "@suhuella/brand";
import { isOperationsOnlyHost, requestHost } from "../operations/host.ts";
import { isPlatformPublicHostname, normalizeHostname } from "./domains.ts";
import { resolvePartnerDomainState } from "./service.ts";
import { getPartnerStore } from "./store.ts";
import type { PartnerDomainRecord } from "./types.ts";

export type RequestBrandKind = "platform" | "partner" | "status" | "unknown";

/**
 * Server-side brand context for one HTTP request.
 * Resolved only from Host / X-Forwarded-Host → D1 partner_domain (active) → partner_brand.
 * Never from client-supplied brand_id, partner_id, or query params.
 */
export type RequestBrandContext = {
  hostname: string | null;
  kind: RequestBrandKind;
  partnerId: string | null;
  brandId: string | null;
  domainStatus: PartnerDomainRecord["status"] | "unknown" | "platform";
  displayName: string;
  logoUrl: string | null;
  accent: string | null;
  onAccent: string | null;
  faviconUrl: string | null;
};

/** Safe fields for client hydration — no Cloudflare ids, tokens, or secrets. */
export type PublicRequestBrand = {
  brandId: string | null;
  displayName: string;
  logoUrl: string | null;
  accent: string | null;
  onAccent: string | null;
};

const HEX = /^#([0-9a-fA-F]{6})$/;

const NEUTRAL: RequestBrandContext = {
  hostname: null,
  kind: "unknown",
  partnerId: null,
  brandId: null,
  domainStatus: "unknown",
  displayName: "Unknown hostname",
  logoUrl: null,
  accent: null,
  onAccent: null,
  faviconUrl: null,
};

function platformContext(hostname: string | null): RequestBrandContext {
  return {
    hostname,
    kind: "platform",
    partnerId: null,
    brandId: platformBrand.id,
    domainStatus: "platform",
    displayName: platformBrand.displayName,
    logoUrl: platformBrand.logo.publicSvg,
    accent: platformBrand.theme.accent,
    onAccent: platformBrand.theme.onAccent,
    faviconUrl: platformBrand.icon.public256,
  };
}

function sanitizeAccent(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function darken(hex: string, amount = 0.08): string {
  const match = HEX.exec(hex.trim());
  if (!match) return hex;
  const value = match[1];
  const scale = Math.max(0, 1 - amount);
  const channel = (start: number) =>
    Math.round(Number.parseInt(value.slice(start, start + 2), 16) * scale)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

function muted(hex: string): string {
  const match = HEX.exec(hex.trim());
  if (!match) return hex;
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.1)`;
}

export function toPublicRequestBrand(ctx: RequestBrandContext): PublicRequestBrand {
  return {
    brandId: ctx.kind === "partner" || ctx.kind === "platform" ? ctx.brandId : null,
    displayName: ctx.displayName,
    logoUrl: ctx.logoUrl,
    accent: ctx.accent,
    onAccent: ctx.onAccent,
  };
}

/** CSS variables for accent overlays. Never includes secrets. */
export function requestBrandCssVars(ctx: RequestBrandContext): Record<string, string> {
  if (ctx.kind === "platform") {
    return brandCssVars() as Record<string, string>;
  }
  if (ctx.kind === "unknown" || ctx.kind === "status") {
    return {
      "--brand-accent": "#64748B",
      "--brand-accent-hover": "#475569",
      "--brand-accent-muted": "rgba(100, 116, 139, 0.1)",
      "--brand-on-accent": "#FFFFFF",
      "--nav-active-bg": "#64748B",
      "--nav-active-fg": "#FFFFFF",
      "--overlay-strong": "#64748B",
    };
  }
  const accent = sanitizeAccent(ctx.accent) ?? "#0F172A";
  const onAccent = sanitizeAccent(ctx.onAccent) ?? "#FFFFFF";
  return {
    "--brand-accent": accent,
    "--brand-accent-hover": darken(accent),
    "--brand-accent-muted": muted(accent),
    "--brand-on-accent": onAccent,
    "--nav-active-bg": accent,
    "--nav-active-fg": onAccent,
    "--overlay-strong": accent,
  };
}

/**
 * Resolve brand for the current request headers.
 * Operations host always gets the platform brand (never a partner overlay).
 */
export async function resolveRequestBrandFromHeaders(
  headers: Headers,
): Promise<RequestBrandContext> {
  const hostHeader = requestHost(headers);
  if (isOperationsOnlyHost(hostHeader)) {
    return platformContext(normalizeHostname(hostHeader) || "ops.suhuella.com");
  }
  return resolveRequestBrandForHostname(hostHeader);
}

export async function resolveRequestBrandForHostname(
  rawHost: string,
): Promise<RequestBrandContext> {
  const hostname = normalizeHostname(rawHost);
  if (!hostname) return { ...NEUTRAL };

  if (isPlatformPublicHostname(hostname)) {
    return platformContext(hostname);
  }

  let state: Awaited<ReturnType<typeof resolvePartnerDomainState>>;
  try {
    state = await resolvePartnerDomainState(hostname);
  } catch {
    return { ...NEUTRAL, hostname };
  }

  if (state.status === "platform") {
    return platformContext(hostname);
  }

  if (state.status === "unknown" || !state.domain) {
    return { ...NEUTRAL, hostname };
  }

  // Non-active domains: never serve partner product brand as if active.
  if (state.status !== "active") {
    const store = await getPartnerStore();
    const doc = await store.read();
    const brandRow =
      doc.brands.find(
        (item) =>
          item.brandId === state.brandId || item.partnerId === state.partnerId,
      ) ?? null;
    return {
      hostname,
      kind: "status",
      partnerId: state.partnerId,
      brandId: null,
      domainStatus: state.status,
      displayName: brandRow?.displayName ?? "Partner domain",
      logoUrl: null,
      accent: null,
      onAccent: null,
      faviconUrl: null,
    };
  }

  const store = await getPartnerStore();
  const doc = await store.read();
  const domain = state.domain;
  const partner = doc.partners.find((item) => item.partnerId === domain.partnerId);
  if (!partner || partner.status === "revoked" || partner.status === "suspended") {
    return {
      hostname,
      kind: "status",
      partnerId: domain.partnerId,
      brandId: null,
      domainStatus: partner?.status === "suspended" ? "suspended" : "revoked",
      displayName: "Partner domain",
      logoUrl: null,
      accent: null,
      onAccent: null,
      faviconUrl: null,
    };
  }

  // Strict join: brand row must match both partner_id and brand_id from the domain.
  const brandRow = doc.brands.find(
    (item) =>
      item.partnerId === domain.partnerId && item.brandId === domain.brandId,
  );
  if (!brandRow) {
    // Fail closed — never fall back to another partner's brand or SuHuella.
    return { ...NEUTRAL, hostname, partnerId: domain.partnerId };
  }

  return {
    hostname,
    kind: "partner",
    partnerId: domain.partnerId,
    brandId: brandRow.brandId,
    domainStatus: "active",
    displayName: brandRow.displayName,
    logoUrl: brandRow.logoUrl,
    accent: sanitizeAccent(brandRow.accent),
    onAccent: sanitizeAccent(brandRow.onAccent) ?? "#FFFFFF",
    faviconUrl: brandRow.faviconUrl,
  };
}

/** True when this request may render the partner/product app shell. */
export function requestBrandServesApp(ctx: RequestBrandContext): boolean {
  return ctx.kind === "platform" || ctx.kind === "partner";
}
