import type { Metadata } from "next";
import { UnconfiguredHostnameScreen } from "@/components/web/UnconfiguredHostnameScreen";
import { PageShell } from "@/components/PageShell";
import { PartnerProgramPageContent } from "@/components/PartnerProgramPageContent";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { isPlatformPublicHostname } from "@/lib/partners/domains";
import { partnerProgramCopy, resolvePartnerPublicPrice } from "@/lib/partners/program-copy";
import { resolveRequestBrandFromHeaders } from "@/lib/partners/request-brand";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const price = await resolvePartnerPublicPrice(locale);
  const copy = partnerProgramCopy(locale, price);
  return {
    title: { absolute: copy.metaTitle },
    description: copy.metaDescription,
    robots: { index: true, follow: true },
  };
}

export default async function PartnersProgramPage() {
  const locale = await getRequestLocale();
  const price = await resolvePartnerPublicPrice(locale);
  const copy = partnerProgramCopy(locale, price);
  const privacyHref = locale === "es" ? "/privacidad" : "/privacy";

  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const hostname = requestBrand.hostname ?? "";
  const onPlatformHost = hostname ? isPlatformPublicHostname(hostname) : true;

  if (!onPlatformHost || requestBrand.kind === "partner") {
    return (
      <UnconfiguredHostnameScreen
        hostname={requestBrand.hostname}
        kind={requestBrand.kind === "partner" ? "unknown" : requestBrand.kind}
        domainStatus={requestBrand.domainStatus}
      />
    );
  }

  return (
    <PageShell scrollable themeAdaptive>
      <PartnerProgramPageContent copy={copy} privacyHref={privacyHref} />
    </PageShell>
  );
}
