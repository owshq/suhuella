"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PublicRequestBrand } from "@/lib/partners/request-brand";
import {
  PARTNER_DOMAIN_EXAMPLE_HOSTNAMES,
  PARTNER_DOMAIN_HOSTNAME_PLACEHOLDER,
  PARTNER_DOMAIN_ONBOARDING_COPY,
  partnerDomainExamplesBilingual,
} from "@/lib/partners/domain-onboarding-copy";

type DnsInstruction = {
  type: string;
  name: string;
  value: string;
  purpose: string;
  purposeLabel?: { en: string; es: string };
};

type DnsActivationStep = {
  order: number;
  en: string;
  es: string;
};

type DomainView = {
  id: string;
  hostname: string;
  status: string;
  dnsTarget: string | null;
  validationErrors: string | null;
  instructions: DnsInstruction[];
  steps?: DnsActivationStep[];
  localDevMode?: boolean;
  notes?: string[];
  nextAction?: string;
};

type MeState = {
  email: string;
  role: string;
  partnerDisplayName: string;
  brand: {
    brandId: string;
    displayName: string;
    logoUrl: string | null;
    accent: string | null;
  };
  domains: DomainView[];
  nextAction: string;
};

export function PartnerSetupClient({
  presentationBrand,
  embeddedInPortal = false,
}: {
  presentationBrand?: PublicRequestBrand;
  embeddedInPortal?: boolean;
}) {
  const [me, setMe] = useState<MeState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState("");
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [domain, setDomain] = useState<DomainView | null>(null);

  const copy = PARTNER_DOMAIN_ONBOARDING_COPY;
  const examples = partnerDomainExamplesBilingual();

  const accentStyle = (me?.brand.accent || presentationBrand?.accent)
    ? ({
        ["--brand-accent" as string]: me?.brand.accent || presentationBrand?.accent || undefined,
      } as CSSProperties)
    : undefined;

  const reload = useCallback(async () => {
    const response = await fetch("/api/partners/me", { cache: "no-store" });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.ok !== true) {
      setLoadError(typeof body.error === "string" ? body.error : "unauthorized");
      setMe(null);
      return;
    }
    const next: MeState = {
      email: String(body.email ?? ""),
      role: String(body.role ?? "partner_admin"),
      partnerDisplayName: String(body.partnerDisplayName ?? "Partner"),
      brand: {
        brandId: String((body.brand as { brandId?: string })?.brandId ?? ""),
        displayName: String((body.brand as { displayName?: string })?.displayName ?? ""),
        logoUrl: ((body.brand as { logoUrl?: string | null })?.logoUrl as string | null) ?? null,
        accent: ((body.brand as { accent?: string | null })?.accent as string | null) ?? null,
      },
      domains: Array.isArray(body.domains) ? (body.domains as DomainView[]) : [],
      nextAction: String(body.nextAction ?? "add_hostname"),
    };
    setMe(next);
    setDisplayName(next.brand.displayName);
    setLogoUrl(next.brand.logoUrl ?? "");
    setAccent(next.brand.accent ?? "");
    const firstDomain = next.domains[0] ?? null;
    setDomain(firstDomain);
    if (firstDomain?.hostname) setHostname(firstDomain.hostname);
    setLoadError(null);
  }, []);

  useEffect(() => {
    void reload().catch(() => setLoadError("unavailable"));
  }, [reload]);

  async function saveBranding() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partners/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          logoUrl: logoUrl.trim() || null,
          accent: accent.trim() || null,
        }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        setMessage(
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error
              : "Could not save branding.",
        );
        return;
      }
      setMessage("Brand saved.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addHostname() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partners/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        const code = typeof body.error === "string" ? body.error : "request_failed";
        setMessage(
          code === "cloudflare_not_configured"
            ? "SuHuella cannot show DNS targets yet. Hostname registration opens when the platform CNAME target is configured."
            : typeof body.message === "string"
              ? body.message
              : code,
        );
        return;
      }
      const next = body.domain as DomainView;
      setDomain(next);
      setMessage(
        typeof next.nextAction === "string"
          ? next.nextAction
          : copy.apiNextActionPending.en,
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function refreshDomain() {
    if (!domain?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/partners/domains/${encodeURIComponent(domain.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        setMessage(
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error
              : "Refresh failed.",
        );
        return;
      }
      const next = body.domain as DomainView;
      setDomain(next);
      setMessage(
        typeof next.nextAction === "string" ? next.nextAction : `Status: ${next.status}`,
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Partner session required</h1>
        <p className="text-sm text-slate-600">
          {embeddedInPortal
            ? "Your partner session could not load setup. Sign out, sign in again, or refresh the page."
            : "Open your onboarding invite link, verify your email, and accept again to continue setup."}
        </p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm text-slate-500">Loading partner setup…</p>
      </main>
    );
  }

  if (me.role !== "partner_admin") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">{me.partnerDisplayName}</h1>
        <p className="text-sm text-slate-600">
          Your role is read-only. Ask a partner admin to configure branding and DNS.
        </p>
      </main>
    );
  }

  const instructions = domain?.instructions ?? [];
  const steps = domain?.steps ?? [];

  return (
    <main
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-8 px-6 py-16"
      style={accentStyle}
    >
      <div>
        <p className="text-sm text-slate-500">Partner setup · {me.email}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Configure {me.brand.displayName || me.partnerDisplayName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.subdomainChoice.en}</p>
        <p className="mt-1 text-sm text-slate-500">{copy.subdomainChoice.es}</p>
        <p className="mt-2 text-xs text-slate-500">
          Examples: <code className="text-slate-700">{examples}</code>
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">1. Brand</h2>
        <label className="block text-xs text-slate-500">
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block text-xs text-slate-500">
          Logo URL (https)
          <input
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="block text-xs text-slate-500">
          Accent (#RRGGBB)
          <input
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            placeholder="#0F172A"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={busy || !displayName.trim()}
          onClick={() => void saveBranding()}
          className="rounded-xl bg-[var(--brand-accent,#0f172a)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save brand
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">2. Hostname</h2>
        <p className="text-xs text-slate-600">{copy.hostnameInputHint.en}</p>
        <p className="text-xs text-slate-500">{copy.hostnameInputHint.es}</p>
        <p className="text-xs text-slate-500">{copy.apexLimitation.en}</p>
        <p className="text-xs text-slate-400">{copy.apexLimitation.es}</p>
        <label className="block text-xs text-slate-500">
          {copy.hostnameInputLabel.en} / {copy.hostnameInputLabel.es}
          <input
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder={PARTNER_DOMAIN_HOSTNAME_PLACEHOLDER}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <p className="text-xs text-slate-500">{copy.saveNotActive.en}</p>
        <p className="text-xs text-slate-400">{copy.saveNotActive.es}</p>
        <button
          type="button"
          disabled={busy || hostname.trim().length < 4}
          onClick={() => void addHostname()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {domain ? "Save hostname again" : "Save hostname (pending)"}
        </button>
      </section>

      {domain?.localDevMode ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <p className="font-semibold">Local dev mode</p>
          <p className="mt-1">
            Cloudflare is not connected. SuHuella still shows the DNS records you would add in
            production. Use a test hostname like <code>app.dbasenet.test</code>, add{" "}
            <code>127.0.0.1 app.dbasenet.test</code> to your hosts file, then Refresh validation
            to activate locally.
          </p>
        </section>
      ) : null}

      {domain ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">3. Activate DNS at your provider</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {domain.hostname} · {domain.status}
            </span>
          </div>
          <p className="text-xs text-slate-600">{copy.pendingStatusBody.en}</p>
          <p className="text-xs text-slate-500">{copy.pendingStatusBody.es}</p>
          {steps.length > 0 ? (
            <ol className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
              {steps.map((step) => (
                <li key={step.order}>
                  <span className="font-semibold text-slate-900">{step.order}.</span> {step.en}
                  <p className="mt-0.5 text-slate-500">{step.es}</p>
                </li>
              ))}
            </ol>
          ) : null}
          {domain.dnsTarget ? (
            <p className="text-xs text-slate-600">
              CNAME target: <code className="text-slate-900">{domain.dnsTarget}</code>
            </p>
          ) : null}
          {instructions.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Name / Host</th>
                    <th className="px-3 py-2 font-medium">Value / Points to</th>
                    <th className="px-3 py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {instructions.map((row, index) => (
                    <tr key={`${row.type}-${row.name}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.type}</td>
                      <td className="break-all px-3 py-2 font-mono text-slate-700">{row.name}</td>
                      <td className="break-all px-3 py-2 font-mono text-slate-700">{row.value}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {row.purposeLabel?.en ?? row.purpose}
                        {row.purposeLabel?.es ? (
                          <span className="block text-slate-400">{row.purposeLabel.es}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : domain.validationErrors ? (
            <pre className="whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              {domain.validationErrors}
            </pre>
          ) : (
            <p className="text-xs text-slate-500">
              Save the hostname first. SuHuella will list the exact CNAME and TXT records to add.
            </p>
          )}
          {(domain.notes ?? []).map((note) => (
            <p key={note} className="text-xs text-slate-500">
              {note}
            </p>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshDomain()}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            Refresh validation
          </button>
          {domain.status === "active" ? (
            <p className="text-sm text-emerald-700">
              {copy.apiNextActionActive.en}{" "}
              <code className="font-medium">{domain.hostname}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </main>
  );
}
