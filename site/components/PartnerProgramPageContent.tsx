"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SuhuellaWordmark } from "@/components/icons/SuhuellaWordmark";
import type { PartnerProgramCopy } from "@/lib/partners/program-copy";
import type { PartnerProgramJourney } from "@/lib/partners/program-journey";

type ApplicationRecord = {
  applicationId: string;
  displayName: string;
  status?: string;
};

const inputClass =
  "partner-input mt-1.5 w-full rounded-xl px-3 py-2.5 text-base shadow-sm outline-none focus:border-[var(--partner-accent-btn)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--partner-accent-btn)_25%,transparent)]";

const primaryButtonClass =
  "partner-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold shadow-md shadow-indigo-900/20 transition disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto";

const secondaryButtonClass =
  "partner-btn-secondary inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90";

const neutralButtonClass =
  "partner-btn-neutral rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";

function StripeMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  );
}

function hasPartnerAccess(journey: PartnerProgramJourney): boolean {
  return (
    Boolean(journey.setup.setupPath) ||
    journey.entitlement.kind === "gift_active" ||
    journey.entitlement.kind === "stripe_active" ||
    journey.entitlement.kind === "gift_pending_invite" ||
    journey.step === "complete" ||
    journey.activation.commercialReady
  );
}

function statusMessage(copy: PartnerProgramCopy, journey: PartnerProgramJourney): string | null {
  if (journey.step === "complete") return copy.activationComplete;
  if (journey.activation.commercialReady && !journey.activation.technicalReady) {
    return copy.activationPending;
  }
  if (hasPartnerAccess(journey)) {
    return journey.entitlement.kind === "gift_pending_invite"
      ? copy.partnerAccessPending
      : copy.partnerAccessReady;
  }
  if (journey.entitlement.checkoutAvailable) return copy.paidReadyNotice;
  return copy.paidClosedNotice;
}

export function PartnerProgramPageContent({
  copy,
  privacyHref,
}: {
  copy: PartnerProgramCopy;
  privacyHref: string;
}) {
  const verifyRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [proofId, setProofId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [journey, setJourney] = useState<PartnerProgramJourney | null>(null);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scrollToVerify = useCallback(() => {
    verifyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function postApply(body: Record<string, unknown>) {
    const response = await fetch("/api/partners/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    return { response, payload };
  }

  async function sendCode() {
    setBusy(true);
    setMessage(null);
    try {
      const { response, payload } = await postApply({ action: "request_code", email });
      if (!response.ok || payload.ok !== true) {
        setMessage(typeof payload.error === "string" ? payload.error : "Could not send code.");
        return;
      }
      setChallengeId(String(payload.challengeId ?? ""));
      setMessage(typeof payload.message === "string" ? payload.message : null);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setMessage(null);
    try {
      const { response, payload } = await postApply({
        action: "verify_code",
        challengeId,
        code,
      });
      if (!response.ok || payload.ok !== true) {
        setMessage(typeof payload.error === "string" ? payload.error : "Invalid code.");
        return;
      }
      setProofId(String(payload.proofId ?? ""));
      setJourney(payload.journey as PartnerProgramJourney);
      if (payload.application && typeof payload.application === "object") {
        const app = payload.application as Record<string, unknown>;
        setApplication({
          applicationId: String(app.applicationId ?? app.id ?? ""),
          displayName: String(app.displayName ?? ""),
          status: typeof app.status === "string" ? app.status : undefined,
        });
        setDisplayName(String(app.displayName ?? ""));
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitInterest() {
    setBusy(true);
    setMessage(null);
    try {
      const { response, payload } = await postApply({
        action: "submit_interest",
        proofId,
        displayName,
      });
      if (!response.ok || payload.ok !== true) {
        setMessage(typeof payload.error === "string" ? payload.error : "Could not submit.");
        return;
      }
      setJourney(payload.journey as PartnerProgramJourney);
      if (payload.application && typeof payload.application === "object") {
        const app = payload.application as Record<string, unknown>;
        setApplication({
          applicationId: String(app.applicationId ?? app.id ?? ""),
          displayName: String(app.displayName ?? ""),
          status: typeof app.status === "string" ? app.status : undefined,
        });
      }
      setMessage(copy.applicationReceived);
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partners/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok || payload.ok !== true) {
        const error = typeof payload.error === "string" ? payload.error : "checkout_failed";
        if (error === "checkout_closed") setMessage(copy.paidClosedNotice);
        else if (error === "already_covered") setMessage(copy.partnerAccessReady);
        else setMessage(error);
        return;
      }
      const url = typeof payload.url === "string" ? payload.url : "";
      if (url.startsWith("https://checkout.stripe.com/")) {
        window.location.assign(url);
        return;
      }
      setMessage("Could not open Stripe Checkout.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrimaryCta() {
    if (journey && hasPartnerAccess(journey)) {
      window.location.assign("/partners/portal");
      return;
    }
    if (!proofId) {
      setMessage(copy.verifyBeforeCheckout);
      scrollToVerify();
      return;
    }
    const checkoutOpen = journey?.entitlement.checkoutAvailable === true;
    if (!checkoutOpen) {
      setMessage(copy.paidClosedNotice);
      scrollToVerify();
      return;
    }
    void startCheckout();
  }

  const applicationSubmitted =
    application?.status === "pending" ||
    application?.status === "in_review" ||
    application?.status === "approved" ||
    application?.status === "approving";
  const partnerReady = journey ? hasPartnerAccess(journey) : false;
  const checkoutOpen = journey?.entitlement.checkoutAvailable === true;
  const showInterestForm =
    proofId && journey && !applicationSubmitted && !checkoutOpen && !partnerReady;
  const primaryLabel = partnerReady ? copy.manageInPortal : copy.checkoutButton;
  const verifiedNotice = partnerReady
    ? copy.partnerAccessReady
    : checkoutOpen
      ? copy.paidReadyNotice
      : copy.emailVerifiedClosedCheckout;
  const primaryHint = partnerReady
    ? copy.partnerAccessReady
    : !proofId
      ? copy.verifyBeforeCheckout
      : checkoutOpen
        ? copy.priceCtaHint
        : copy.checkoutClosedHint;

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="partner-nav-link inline-flex items-center gap-2 text-sm font-semibold">
          <SuhuellaWordmark
            glyphClassName="h-6 w-6"
            textClassName="partner-heading text-sm font-semibold tracking-[-0.02em]"
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/partners/portal"
            className="partner-nav-link text-sm font-medium underline-offset-2 hover:underline"
          >
            {copy.existingPartnerHint} {copy.portalLinkLabel}
          </Link>
          <LanguageSwitcher inline />
        </div>
      </div>

      <article className="partner-card space-y-8 rounded-[2rem] p-6 sm:p-8 md:p-10">
        <header className="space-y-3">
          <p className="partner-eyebrow text-xs font-semibold uppercase tracking-[0.14em]">SuHuella Partner</p>
          <h1 className="partner-heading text-3xl font-semibold tracking-tight md:text-4xl">{copy.heroTitle}</h1>
          <p className="partner-body text-base leading-relaxed">{copy.heroBody}</p>
        </header>

        <section
          id="verify"
          ref={verifyRef}
          className="partner-price-panel scroll-mt-4 rounded-2xl p-6 md:p-8"
        >
          <p className="partner-eyebrow text-sm font-semibold uppercase tracking-wide">{copy.priceSectionTitle}</p>
          <p className="partner-heading mt-2 text-4xl font-semibold tracking-tight md:text-[2.75rem]">
            {copy.priceLabel}
          </p>
          <p className="partner-muted mt-2 text-sm leading-relaxed">{copy.priceNote}</p>

          <div className="partner-verify-inline mt-6 space-y-4">
            <div>
              <h2 className="partner-heading text-lg font-semibold">{copy.verifyTitle}</h2>
              <p className="partner-body mt-1 text-sm leading-relaxed">{copy.verifyBody}</p>
              <p className="partner-muted mt-2 text-xs">
                {copy.emailPrivacy}{" "}
                <Link
                  href={privacyHref}
                  className="partner-nav-link font-medium underline underline-offset-2"
                >
                  {privacyHref === "/privacidad" ? "Privacidad" : "Privacy"}
                </Link>
              </p>
            </div>

            {!proofId ? (
              <div className="space-y-4">
                <label className="partner-heading block text-sm font-medium">
                  {copy.emailLabel}
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !email.trim()}
                  onClick={() => void sendCode()}
                  className={neutralButtonClass}
                >
                  {copy.sendCode}
                </button>
                {challengeId ? (
                  <>
                    <label className="partner-heading block text-sm font-medium">
                      {copy.codeLabel}
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || code.trim().length < 6}
                      onClick={() => void verifyCode()}
                      className={neutralButtonClass}
                    >
                      {copy.verifyCode}
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="partner-message-success rounded-lg px-3 py-2 text-sm font-medium">{verifiedNotice}</p>
                {partnerReady ? (
                  <Link href="/partners/portal" className={primaryButtonClass}>
                    {copy.manageInPortal}
                  </Link>
                ) : null}
                {showInterestForm ? (
                  <div className="space-y-3 border-t border-[var(--partner-panel-border)] pt-4">
                    <label className="partner-heading block text-sm font-medium">
                      {copy.displayNameLabel}
                      <span className="partner-muted mt-1 block text-xs font-normal">{copy.displayNameHint}</span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || displayName.trim().length < 2 || Boolean(application)}
                      onClick={() => void submitInterest()}
                      className={secondaryButtonClass}
                    >
                      {copy.submitInterest}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {!partnerReady ? (
            <div className="mt-6 space-y-3">
              <button type="button" disabled={busy} onClick={handlePrimaryCta} className={primaryButtonClass}>
                <StripeMark />
                {primaryLabel}
              </button>
              <p className="partner-muted text-xs leading-relaxed">{primaryHint}</p>
            </div>
          ) : null}
        </section>

        {message ? (
          <p className="partner-message rounded-xl px-4 py-3 text-sm leading-relaxed">{message}</p>
        ) : null}

        {journey && statusMessage(copy, journey) ? (
          <p className="partner-message-success rounded-xl px-4 py-3 text-sm leading-relaxed">
            {statusMessage(copy, journey)}
          </p>
        ) : null}

        <section className="space-y-4">
          <h2 className="partner-heading text-lg font-semibold">{copy.stepsTitle}</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {copy.steps.map((step, index) => (
              <li key={step.id} className="partner-step-card rounded-xl p-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="partner-step-badge flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="partner-heading font-semibold">{step.title}</p>
                    <p className="partner-body mt-1.5 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="partner-heading text-lg font-semibold">{copy.requirementsTitle}</h2>
          <ul className="partner-body list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {copy.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

      </article>

      <footer className="mt-auto w-full pt-8 pb-8">
        <SiteFooter />
      </footer>
    </main>
  );
}
