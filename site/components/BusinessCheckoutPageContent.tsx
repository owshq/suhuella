"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { GlassCard } from "@/components/ui/GlassCard";

type Pricing = {
  minSeats: number;
  seatPriceCents: number;
  currency: string;
  minMonthlyCents: number;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

export function BusinessCheckoutPageContent({
  checkoutEnabled,
  pricing,
}: {
  checkoutEnabled: boolean;
  pricing: Pricing;
}) {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("checkout") === "canceled";
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [proofId, setProofId] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [seats, setSeats] = useState(String(pricing.minSeats));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const summary = useMemo(() => {
    const parsed = Number.parseInt(seats, 10);
    if (!Number.isInteger(parsed) || parsed < pricing.minSeats) return null;
    return {
      seats: parsed,
      seatPriceCents: pricing.seatPriceCents,
      subtotalCents: Math.max(pricing.minMonthlyCents, parsed * pricing.seatPriceCents),
      currency: pricing.currency,
    };
  }, [pricing, seats]);

  async function requestCode() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/license/email-code/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "BUSINESS_CHECKOUT" }),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok || payload.ok !== true || typeof payload.challengeId !== "string") {
        setMessage(typeof payload.error === "string" ? payload.error : "Could not send code.");
        return;
      }
      setChallengeId(payload.challengeId);
      setMessage("If this email is valid, we've sent a verification code.");
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
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok || payload.ok !== true || typeof payload.proofId !== "string") {
        setMessage(typeof payload.error === "string" ? payload.error : "Invalid code.");
        return;
      }
      setProofId(payload.proofId);
      setMessage("Email verified. Choose seats and continue to Stripe Checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/business/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofId, organisationName, seats: Number.parseInt(seats, 10) }),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok || payload.ok !== true || typeof payload.url !== "string") {
        setMessage(typeof payload.error === "string" ? payload.error : "Checkout unavailable.");
        return;
      }
      window.location.href = payload.url;
    } finally {
      setBusy(false);
    }
  }

  const seatEuro = (pricing.seatPriceCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: pricing.currency.toUpperCase(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
        <Link href="/license" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
          ← Plans
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">Business checkout</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Team seats billed monthly on Stripe Checkout. Minimum {pricing.minSeats} users at {seatEuro} per user
          per month. Taxes follow your Stripe configuration.
        </p>

        {canceled ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            Checkout canceled. Your organisation was not created.
          </p>
        ) : null}

        {!checkoutEnabled ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Business checkout is not open yet. When sales are authorized, this page will connect to Stripe
            without contacting sales first.
          </p>
        ) : null}

        <GlassCard className="mt-8 space-y-6 p-6">
          {!proofId ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="business-email">
                  Work email
                </label>
                <input
                  id="business-email"
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!checkoutEnabled || busy}
                />
              </div>
              {!challengeId ? (
                <button
                  type="button"
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!checkoutEnabled || busy || !email.trim()}
                  onClick={() => void requestCode()}
                >
                  Send verification code
                </button>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700" htmlFor="business-code">
                      Verification code
                    </label>
                    <input
                      id="business-code"
                      className={inputClass}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      disabled={!checkoutEnabled || busy}
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!checkoutEnabled || busy || code.trim().length < 6}
                    onClick={() => void verifyCode()}
                  >
                    Verify email
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="business-org">
                  Organisation name
                </label>
                <input
                  id="business-org"
                  className={inputClass}
                  value={organisationName}
                  onChange={(event) => setOrganisationName(event.target.value)}
                  disabled={!checkoutEnabled || busy}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="business-seats">
                  Users (minimum {pricing.minSeats})
                </label>
                <input
                  id="business-seats"
                  className={inputClass}
                  type="number"
                  min={pricing.minSeats}
                  step={1}
                  value={seats}
                  onChange={(event) => setSeats(event.target.value)}
                  disabled={!checkoutEnabled || busy}
                />
              </div>
              {summary ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p>
                    {summary.seats} users × {seatEuro} ={" "}
                    {(summary.subtotalCents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: summary.currency.toUpperCase(),
                    })}{" "}
                    / month before tax
                  </p>
                </div>
              ) : (
                <p className="text-sm text-rose-700">Enter at least {pricing.minSeats} whole users.</p>
              )}
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!checkoutEnabled || busy || !summary || organisationName.trim().length < 2}
                onClick={() => void startCheckout()}
              >
                Continue to Stripe Checkout
              </button>
            </>
          )}

          {message ? (
            <p role="status" className="text-sm text-slate-600">
              {message}
            </p>
          ) : null}
        </GlassCard>
      </main>

      <SiteFooter />
    </div>
  );
}
