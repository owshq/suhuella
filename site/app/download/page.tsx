import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { PaymentVerificationLoader } from "@/components/PaymentVerificationLoader";
import { SuccessContent } from "@/components/SuccessContent";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";
import { getStripeCheckoutUrl } from "@/lib/stripe";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);

  return {
    title: { absolute: getPageTitle(locale, "download") },
    description: t.success.description,
  };
}

export default function DownloadPage() {
  const checkoutUrl = getStripeCheckoutUrl();

  return (
    <PageShell>
      <Suspense
        fallback={
          <PaymentVerificationLoader message="Verifying payment..." />
        }
      >
        <SuccessContent checkoutUrl={checkoutUrl} />
      </Suspense>
    </PageShell>
  );
}
