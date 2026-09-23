"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PartnerSetupClient } from "@/components/PartnerSetupClient";

type LicenseRow = {
  licenseId: string;
  holderEmail: string;
  edition: string;
  origin: string;
  status: string;
  validUntil: string | null;
  paymentReference: string | null;
};

type Me = {
  email: string;
  role: string;
  partnerDisplayName: string;
  partnerStatus: string;
  entitlement: {
    status: string;
    origin: string;
    validUntil: string | null;
    commercialReference: string | null;
  } | null;
  partnerStripe: { connected: boolean; note: string };
};

export function PartnerPortalClient() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadLicenses = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/partners/licenses?${params.toString()}`, { cache: "no-store" });
    const body = (await response.json()) as {
      ok?: boolean;
      licenses?: LicenseRow[];
      nextCursor?: string | null;
    };
    if (!response.ok || body.ok !== true) return;
    setLicenses((current) => (cursor ? [...current, ...(body.licenses ?? [])] : body.licenses ?? []));
    setNextCursor(body.nextCursor ?? null);
  }, []);

  const portalSessionMessage = useCallback((error: unknown, status: number): string => {
    if (error === "no_membership") {
      return "This email is not authorized for a partner panel. Registering interest does not grant access.";
    }
    if (error === "forbidden") {
      return "Signed in but this surface is restricted. Use the partner email SuHuella authorized.";
    }
    if (error === "unauthorized" || status === 401) {
      return "Session expired or invalid. Sign in again.";
    }
    if (error === "server_error") {
      return "SuHuella could not load your session. Try again in a moment.";
    }
    return typeof error === "string" ? error : "Could not load partner session.";
  }, []);

  const loadMe = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const response = await fetch("/api/partners/me", { cache: "no-store" });
    const body = (await response.json()) as Me & { ok?: boolean; error?: string };
    if (!response.ok || body.ok !== true) {
      setMe(null);
      setReady(true);
      return { ok: false, message: portalSessionMessage(body.error, response.status) };
    }
    setMe(body);
    setReady(true);
    await loadLicenses(null);
    return { ok: true };
  }, [loadLicenses, portalSessionMessage]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (searchParams.get("checkout") === "return") {
      setMessage(
        "Payment submitted in Stripe. Sign in below with the same email once your partner license is confirmed. A browser return does not prove payment by itself.",
      );
    }
  }, [searchParams]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/partners/portal/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    return { response, payload };
  }

  function portalAccessMessage(error: unknown): string {
    if (error === "no_membership") {
      return "This email is not authorized for a partner panel. Registering interest does not grant access.";
    }
    if (error === "server_error") {
      return "SuHuella could not send the code. Try again in a moment.";
    }
    if (error === "forbidden") {
      return "This email is not authorized for a partner panel.";
    }
    return typeof error === "string" ? error : "Could not send code.";
  }

  async function sendCode() {
    setMessage(null);
    setChallengeId("");
    const { response, payload } = await post({ action: "request_code", email });
    if (!response.ok || payload.ok !== true) {
      setMessage(portalAccessMessage(payload.error));
      return;
    }
    setChallengeId(String(payload.challengeId ?? ""));
    setMessage(typeof payload.message === "string" ? payload.message : null);
  }

  async function verifyCode() {
    setMessage(null);
    const { response, payload } = await post({ action: "verify_code", challengeId, code });
    if (!response.ok || payload.ok !== true) {
      setMessage(
        payload.error === "no_membership"
          ? portalAccessMessage(payload.error)
          : typeof payload.error === "string"
            ? payload.error
            : "Invalid code.",
      );
      return;
    }
    const session = await loadMe();
    if (!session.ok) {
      setMessage(
        session.message ||
          "Signed in but session could not load — try again or contact support.",
      );
    }
  }

  async function logout() {
    await post({ action: "logout" });
    setMe(null);
    setLicenses([]);
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-600 sm:px-6">
        Loading partner panel…
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto flex max-w-lg flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Partner panel</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with the email SuHuella authorized. A public application does not grant access.
          Returning does not require the invite link.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="button"
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void sendCode()}
        >
          Send code
        </button>
        {challengeId ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Code
              <input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void verifyCode()}
            >
              Enter panel
            </button>
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        <Link href="/partners" className="mt-8 text-sm text-slate-500 underline">
          Partner program
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Partner panel</p>
          <h1 className="text-2xl font-semibold text-slate-900">{me.partnerDisplayName}</h1>
          <p className="mt-1 text-sm text-slate-600">{me.email}</p>
        </div>
        <button type="button" className="text-sm text-slate-600 underline" onClick={() => void logout()}>
          Sign out
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">Platform license</h2>
        {me.entitlement ? (
          <dl className="mt-3 grid gap-2">
            <div>Status: {me.entitlement.status}</div>
            <div>Origin: {me.entitlement.origin}</div>
            <div>Partner: {me.partnerStatus}</div>
            <div>Valid until: {me.entitlement.validUntil ?? "Duration not set"}</div>
            <div>Commercial reference: {me.entitlement.commercialReference ?? "None"}</div>
          </dl>
        ) : (
          <p className="mt-2">No platform entitlement is recorded for this partner.</p>
        )}
        <p className="mt-3 text-slate-500">
          A checkout return does not prove payment. This status comes from the stored entitlement.
        </p>
      </section>

      <PartnerSetupClient embeddedInPortal />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">Customer licenses</h2>
        <p className="mt-2 text-slate-500">
          SuHuella Operations records these end-customer grants. This panel lists the ones scoped to
          this partner. It does not create or revoke them. Buying the platform license does not create
          them. Gift and manual origins stay as recorded. They are not shown as Stripe payments.
        </p>
        {licenses.length === 0 ? (
          <p className="mt-3">No customer licenses are recorded for this partner.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {licenses.map((license) => (
              <li key={license.licenseId} className="py-3">
                <div className="font-medium text-slate-900">{license.holderEmail}</div>
                <div className="text-xs text-slate-500">
                  {license.licenseId} · {license.edition} · {license.origin} · {license.status}
                  {license.validUntil ? ` · until ${license.validUntil}` : ""}
                  {license.paymentReference ? ` · ${license.paymentReference}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
        {nextCursor ? (
          <button type="button" className="mt-3 text-sm underline" onClick={() => void loadLicenses(nextCursor)}>
            Load more
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">Partner Stripe</h2>
        <p className="mt-2">{me.partnerStripe.note}</p>
        <p className="mt-2">Connected: {me.partnerStripe.connected ? "yes" : "no"}</p>
      </section>
    </main>
  );
}
