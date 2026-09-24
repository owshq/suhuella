"use client";

import { brand } from "@suhuella/brand";
import {
  commercialPlanCards,
  checkoutPath,
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
  businessCheckoutEnabled = false,
  embedded = false,
  onClose,
}: {
  desktopDownloadAvailable?: boolean;
  paidCheckoutEnabled?: boolean;
  businessCheckoutEnabled?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const unavailablePlan = searchParams.get("plan") ?? "";
  const appLocale = locale === "es" ? "es" : "en";
  const plans = commercialPlanCards("free", "public", appLocale);

  const paidClosedNote =
    locale === "es"
      ? " Los planes de pago aún no están disponibles."
      : " Paid plans are not available yet.";
  const desktopNote = desktopDownloadAvailable
    ? locale === "es"
      ? " Puedes descargar la app de escritorio."
      : " You can download the desktop app."
    : locale === "es"
      ? " La app de escritorio aún no se puede descargar."
      : " The desktop app is not available to download yet.";
  const intro =
    locale === "es"
      ? `Puedes abrir ${brand.displayName} en este navegador ahora.${
          paidCheckoutEnabled ? "" : paidClosedNote
        }${desktopNote}`
      : `You can open ${brand.displayName} in this browser now.${
          paidCheckoutEnabled ? "" : paidClosedNote
        }${desktopNote}`;

  const planHref = (planId: string) => {
    const personalPaid = planId === "lifetime" || planId === "monthly";
    if (planId === "free") {
      if (embedded && onClose) return null;
      return desktopDownloadAvailable ? "/download" : "/home";
    }
    if (planId === "business" && businessCheckoutEnabled) {
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
        {embedded
          ? locale === "es"
            ? "Antes de comprar: tras el pago, activa este dispositivo en Ajustes → Licencia con el código OTP del email. El mismo flujo funciona en web y en escritorio."
            : "Before you buy: after payment, activate this device in Settings → License with the email OTP code. The same flow works on web and desktop."
          : locale === "es"
            ? "Antes de comprar: tras el pago, activa el dispositivo en Ajustes → Licencia con el código OTP del email — en web o en la app de escritorio. Los instaladores pueden mostrar avisos de Windows o macOS porque aún no están firmados ni notarizados."
            : "Before you buy: after payment, activate the device in Settings → License with the email OTP code — in the browser or the desktop app. Installers may show Windows or macOS warnings because they are not signed or notarized yet."}
      </p>

      <div className={`grid gap-3 sm:grid-cols-2 ${embedded ? "mt-4" : "mt-6"}`}>
        {plans.map((plan) => {
          const personalPaid = plan.id === "lifetime" || plan.id === "monthly";
          const paidPlan = personalPaid || plan.id === "business";
          const href = planHref(plan.id);
          const unavailable = paidPlan && !paidCheckoutEnabled;
          const label = unavailable
            ? paidPlanUnavailableCta(appLocale)
            : plan.id === "free" && desktopDownloadAvailable && !embedded
              ? locale === "es"
                ? "Descargar"
                : "Download"
              : plan.cta;

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
      </div>

      <GlassCard className={embedded ? "mt-4 p-5" : "mt-8 p-5"}>
        <h2 className="text-base font-semibold text-slate-900">
          {locale === "es" ? "¿Ya la has comprado?" : "Already purchased?"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {embedded
            ? locale === "es"
              ? "El pago en Stripe no activa solo el dispositivo. Cierra este panel, abre Ajustes → Licencia, verifica tu email con el código OTP y activa aquí."
              : "Stripe payment alone does not activate this device. Close this panel, open Settings → License, verify your email with the OTP code, and activate here."
            : locale === "es"
              ? `El pago en Stripe no activa solo el dispositivo. Abre ${brand.displayName} en web o escritorio, verifica tu email con el código OTP y activa en Ajustes → Licencia.`
              : `Stripe payment alone does not activate this device. Open ${brand.displayName} on web or desktop, verify your email with the OTP code, and activate in Settings → License.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {embedded && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {locale === "es" ? "Volver a la app" : "Back to the app"}
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
