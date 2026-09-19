"use client";

import { brand } from "@suhuella/brand";
import { commercialPlanCards, checkoutPath, unavailablePlanMessage } from "@suhuella/product/lib/license-checkout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";
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
  const plans = commercialPlanCards("free", "public");

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
    if (planId === "business" || (personalPaid && paidCheckoutEnabled)) {
      return checkoutPath(planId, { returnTo: "public" });
    }
    if (personalPaid) {
      return `/license?checkout=unavailable&plan=${planId}`;
    }
    return "/";
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
      {checkout === "unavailable" ? (
        <p className={`rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 ${embedded ? "mt-4" : "mt-6"}`}>
          {locale === "es"
            ? unavailablePlan === "lifetime"
              ? "Lifetime aún no está disponible."
              : unavailablePlan === "monthly"
                ? "Monthly aún no está disponible."
                : "Este plan aún no está disponible."
            : unavailablePlanMessage(unavailablePlan)}
        </p>
      ) : null}

      <div className={`grid gap-3 sm:grid-cols-2 ${embedded ? "mt-4" : "mt-8"}`}>
        {plans.map((plan) => {
          const personalPaid = plan.id === "lifetime" || plan.id === "monthly";
          const href = planHref(plan.id);
          const label =
            personalPaid && !paidCheckoutEnabled
              ? locale === "es"
                ? "Aún no disponible"
                : "Coming soon"
              : plan.cta;

          return (
            <GlassCard key={plan.id} className="p-5">
              <p className="text-sm font-semibold text-slate-900">{plan.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{plan.summary}</p>
              {label ? (
                plan.id === "free" && embedded && onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 inline-flex rounded-full bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
          {locale === "es"
            ? `Abre ${brand.displayName} en este navegador para activar tu licencia en este dispositivo. No hace falta instalar nada.`
            : `Open ${brand.displayName} in this browser to activate your license on this device. Nothing to install.`}
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
