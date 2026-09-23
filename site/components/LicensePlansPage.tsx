"use client";

import { brand } from "@suhuella/brand";
import {
  commercialPlanCards,
  checkoutPath,
  licenseJourneySteps,
  paidCheckoutClosedMessage,
  paidPlanUnavailableCta,
  unavailablePlanMessage,
} from "@suhuella/product/lib/license-checkout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";
import { PlanFeatureList } from "@suhuella/product/components/PlanFeatureList";
import { GlassCard } from "@/components/ui/GlassCard";
import { SiteFooter } from "@/components/SiteFooter";

export function LicensePlansPage({
  desktopDownloadAvailable = false,
  paidCheckoutEnabled = false,
  embedded = false,
  onClose,
}: {
  desktopDownloadAvailable?: boolean;
  paidCheckoutEnabled?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const unavailablePlan = searchParams.get("plan") ?? "";
  const appLocale = locale === "es" ? "es" : "en";
  const plans = commercialPlanCards("free", "public", appLocale);
  const journey = licenseJourneySteps(appLocale);

  const intro =
    locale === "es"
      ? paidCheckoutEnabled
        ? `Puedes abrir ${brand.displayName} en este navegador ahora. La app de escritorio aún no se puede descargar.`
        : `Puedes abrir ${brand.displayName} en este navegador ahora. Los planes de pago aún no están disponibles. La app de escritorio aún no se puede descargar.`
      : paidCheckoutEnabled
        ? `You can open ${brand.displayName} in this browser now. The desktop app is not available to download yet.`
        : `You can open ${brand.displayName} in this browser now. Paid plans are not available yet. The desktop app is not available to download yet.`;

  const planHref = (planId: string) => {
    const personalPaid = planId === "lifetime" || planId === "monthly";
    if (planId === "free") {
      if (embedded && onClose) return null;
      return desktopDownloadAvailable ? "/download" : "/home";
    }
    if (planId === "business" && paidCheckoutEnabled) {
      return checkoutPath("business", { returnTo: "public" });
    }
    if (personalPaid && paidCheckoutEnabled) {
      return checkoutPath(planId, { returnTo: "public" });
    }
    return null;
  };

  const body = (
    <>
      {!embedded ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {locale === "es" ? "Planes y licencias" : "Plans and licenses"}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">{intro}</p>
        </>
      ) : (
        <p className="max-w-xl text-sm leading-relaxed text-slate-600">{intro}</p>
      )}

      {checkout === "canceled" ? (
        <p className={`rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 ${embedded ? "mt-4" : "mt-6"}`}>
          {locale === "es"
            ? "Checkout cancelado. Tu plan no ha cambiado."
            : "Checkout canceled. Your plan is unchanged."}
        </p>
      ) : null}
      {checkout === "unavailable" || !paidCheckoutEnabled ? (
        <p
          role="status"
          className={`rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 ${embedded ? "mt-4" : "mt-6"}`}
        >
          {checkout === "unavailable"
            ? locale === "es"
              ? unavailablePlan === "lifetime"
                ? "Lifetime aún no está disponible."
                : unavailablePlan === "monthly"
                  ? "Monthly aún no está disponible."
                  : "Este plan aún no está disponible."
              : unavailablePlanMessage(unavailablePlan)
            : paidCheckoutClosedMessage(appLocale)}
        </p>
      ) : null}

      <p className={`rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-slate-700 ${embedded ? "mt-4" : "mt-6"}`}>
        {locale === "es"
          ? "Antes de comprar: la licencia se activa en SuHuella Web. Los instaladores de escritorio pueden mostrar avisos de Windows o macOS porque aún no están firmados ni notarizados. Puedes continuar la instalación, o usar SuHuella en este navegador."
          : "Before you buy: the license activates in SuHuella Web. Desktop installers may show Windows or macOS warnings because they are not signed or notarized yet. You can continue the install, or use SuHuella in this browser."}
      </p>

      <GlassCard className={embedded ? "mt-4 p-5" : "mt-8 p-5"}>
        <h2 className="text-base font-semibold text-slate-900">
          {locale === "es" ? "Cómo encaja la licencia" : "How licensing fits together"}
        </h2>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
          {journey.map((step) => (
            <li key={step.id}>
              <span className="font-semibold text-slate-900">{step.title}. </span>
              {step.detail}
            </li>
          ))}
        </ol>
      </GlassCard>

      <div className={`grid gap-3 sm:grid-cols-2 ${embedded ? "mt-4" : "mt-6"}`}>
        {plans.map((plan) => {
          const personalPaid = plan.id === "lifetime" || plan.id === "monthly";
          const paidPlan = personalPaid || plan.id === "business";
          const href = planHref(plan.id);
          const unavailable = paidPlan && !paidCheckoutEnabled;
          const label = unavailable ? paidPlanUnavailableCta(appLocale) : plan.cta;

          return (
            <GlassCard key={plan.id} className="p-5">
              <p className="text-sm font-semibold text-slate-900">{plan.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{plan.summary}</p>
              <PlanFeatureList features={plan.features} />
              {label ? (
                plan.id === "free" && embedded && onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {label}
                  </button>
                ) : unavailable ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-4 inline-flex cursor-not-allowed rounded-full bg-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500"
                  >
                    {label}
                  </button>
                ) : href ? (
                  <Link
                    href={href}
                    className="mt-4 inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {label}
                  </Link>
                ) : null
              ) : null}
            </GlassCard>
          );
        })}
        <GlassCard className="p-5 sm:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Partner</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            {locale === "es"
              ? "Publica SuHuella con tu marca y tu dominio. La cuota anual es un programa aparte: no es Lifetime, Monthly ni Business."
              : "Publish SuHuella under your brand and domain. The annual fee is a separate program: not Lifetime, Monthly, or Business."}
          </p>
          <Link
            href="/partners"
            className="mt-4 inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {locale === "es" ? "Ver programa partner" : "View partner program"}
          </Link>
        </GlassCard>
      </div>

      <GlassCard className={embedded ? "mt-4 p-5" : "mt-8 p-5"}>
        <h2 className="text-base font-semibold text-slate-900">
          {locale === "es" ? "¿Ya la has comprado?" : "Already purchased?"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {locale === "es"
            ? `El pago en Stripe no activa solo el dispositivo. Abre ${brand.displayName}, verifica tu email con el código OTP y activa este dispositivo en Ajustes → Licencia.`
            : `Stripe payment alone does not activate this device. Open ${brand.displayName}, verify your email with the OTP code, and activate this device in Settings → License.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {embedded && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {locale === "es" ? `Abrir ${brand.displayName}` : `Open ${brand.displayName}`}
            </button>
          ) : (
            <Link
              href="/home"
              className="inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {locale === "es" ? `Abrir ${brand.displayName}` : `Open ${brand.displayName}`}
            </Link>
          )}
          <Link
            href="/download"
            className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {locale === "es" ? "Descargas" : "Downloads"}
          </Link>
        </div>
      </GlassCard>
    </>
  );

  if (embedded) {
    return <div className="space-y-1">{body}</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 pt-16 pb-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
          {brand.displayName}
        </Link>
        <LanguageSwitcher inline />
      </div>
      {body}
      <div className="mt-auto pt-16">
        <SiteFooter />
      </div>
    </main>
  );
}
