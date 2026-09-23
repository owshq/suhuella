"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { PublicRequestBrand } from "@/lib/partners/request-brand";
import {
  PARTNER_DOMAIN_ONBOARDING_COPY,
  partnerDomainExamplesBilingual,
} from "@/lib/partners/domain-onboarding-copy";
import { PartnerSetupClient } from "@/components/PartnerSetupClient";

type Preview = {
  email: string;
  partnerDisplayName: string;
  role: string;
  expiresAt: string;
  status: "open" | "consumed" | "expired" | "revoked";
};

export function PartnerOnboardingClient({
  token,
  presentationBrand,
}: {
  token: string;
  presentationBrand?: PublicRequestBrand;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [proofId, setProofId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const accent = presentationBrand?.accent ?? undefined;
  const headingName =
    preview?.partnerDisplayName || presentationBrand?.displayName || "Partner";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/partners/onboarding?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (!response.ok || body.ok !== true) {
          setLoadError(typeof body.error === "string" ? body.error : "not_found");
          return;
        }
        setPreview({
          email: String(body.email ?? ""),
          partnerDisplayName: String(body.partnerDisplayName ?? "Partner"),
          role: String(body.role ?? "partner_admin"),
          expiresAt: String(body.expiresAt ?? ""),
          status: body.status as Preview["status"],
        });
      } catch {
        if (!cancelled) setLoadError("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function requestCode() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partners/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_code", token }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        setMessage(typeof body.error === "string" ? body.error : "Could not send code.");
        return;
      }
      setChallengeId(String(body.challengeId ?? ""));
      setMessage(typeof body.message === "string" ? body.message : "Code sent.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/license/email-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        setMessage(typeof body.error === "string" ? body.error : "Invalid code.");
        return;
      }
      setProofId(String(body.proofId ?? ""));
      setMessage("Email verified. Accept the invite to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvite() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partners/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", token, proofId }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok || body.ok !== true) {
        setMessage(typeof body.error === "string" ? body.error : "Could not accept invite.");
        return;
      }
      // Drop token from the address bar after consume — session cookie is now authoritative.
      window.history.replaceState({}, "", "/partners/onboarding/complete");
      setAccepted(true);
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return <PartnerSetupClient presentationBrand={presentationBrand} />;
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Invite unavailable</h1>
        <p className="text-sm text-slate-600">This onboarding link is invalid, expired, or already used.</p>
      </main>
    );
  }

  if (!preview) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm text-slate-500">Loading invite…</p>
      </main>
    );
  }

  if (preview.status !== "open") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Invite {preview.status}</h1>
        <p className="text-sm text-slate-600">
          If you already accepted, continue at{" "}
          <a className="underline" href="/partners/onboarding/complete">
            partner setup
          </a>
          . Otherwise ask SuHuella Operations for a new onboarding link.
        </p>
      </main>
    );
  }

  return (
    <main
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-16"
      style={accent ? ({ ["--brand-accent" as string]: accent } as CSSProperties) : undefined}
    >
      <div>
        <p className="text-sm text-slate-500">Partner onboarding</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{headingName}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Verify <span className="font-medium text-slate-900">{preview.email}</span> to become{" "}
          {preview.role.replace("_", " ")}.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-500">
          <li>Validate your email with the one-time code.</li>
          <li>Configure name, logo, and accent color.</li>
          <li>
            {PARTNER_DOMAIN_ONBOARDING_COPY.subdomainChoice.en} Examples:{" "}
            <code className="text-slate-700">{partnerDomainExamplesBilingual()}</code>.
          </li>
          <li>{PARTNER_DOMAIN_ONBOARDING_COPY.subdomainChoice.es}</li>
          <li>
            {PARTNER_DOMAIN_ONBOARDING_COPY.saveNotActive.en}{" "}
            {PARTNER_DOMAIN_ONBOARDING_COPY.saveNotActive.es}
          </li>
          <li>Copy the CNAME and TXT records into GoDaddy, Hostinger, or your DNS provider.</li>
          <li>Keep your nameservers. Press Refresh after DNS propagates — activation is not immediate.</li>
        </ol>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestCode()}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Send verification code
        </button>
        {challengeId ? (
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || code.trim().length !== 6}
              onClick={() => void verifyCode()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Verify code
            </button>
          </div>
        ) : null}
        {proofId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void acceptInvite()}
            className="rounded-xl bg-[var(--brand-accent,#0f172a)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Accept invite
          </button>
        ) : null}
        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </div>
    </main>
  );
}
