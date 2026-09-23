import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnconfiguredHostnameScreen } from "@/components/web/UnconfiguredHostnameScreen";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { isPlatformPublicHostname } from "@/lib/partners/domains";
import { presentationPageTitle } from "@/lib/partners/unconfigured-hostname-copy";
import { resolveRequestBrandFromHeaders } from "@/lib/partners/request-brand";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const hostname = requestBrand.hostname ?? "";
  const onPlatformHost = hostname ? isPlatformPublicHostname(hostname) : true;
  if (onPlatformHost) {
    return { title: { absolute: "Not found" }, robots: { index: false, follow: false } };
  }
  const kind = requestBrand.kind === "status" ? "status" : "unknown";
  return {
    title: { absolute: presentationPageTitle({ kind, locale }) },
    robots: { index: false, follow: false },
  };
}

/**
 * Visitor notice for non-active partner hostnames (middleware rewrite target).
 * Not reachable on platform hosts — no preview URL or ?state= query.
 */
export default async function HostnameStatusPage() {
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const hostname = requestBrand.hostname ?? "";
  const onPlatformHost = hostname ? isPlatformPublicHostname(hostname) : true;

  if (onPlatformHost) {
    notFound();
  }

  const kind = requestBrand.kind === "status" ? "status" : "unknown";

  return (
    <UnconfiguredHostnameScreen
      hostname={requestBrand.hostname}
      kind={kind}
      domainStatus={requestBrand.domainStatus}
    />
  );
}
