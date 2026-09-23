import type { Metadata } from "next";
import { PartnerOnboardingClient } from "@/components/PartnerOnboardingClient";
import {
  resolveRequestBrandFromHeaders,
  toPublicRequestBrand,
} from "@/lib/partners/request-brand";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  return {
    title:
      requestBrand.kind === "partner"
        ? `${requestBrand.displayName} · Onboarding`
        : "Partner onboarding",
    robots: { index: false, follow: false },
  };
}

export default async function PartnerOnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const safeToken = typeof token === "string" ? token.trim() : "";
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const publicBrand = toPublicRequestBrand(requestBrand);
  if (!safeToken || safeToken.length < 16 || safeToken.length > 200) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Invite unavailable</h1>
        <p className="text-sm text-slate-600">This onboarding link is invalid.</p>
      </main>
    );
  }
  return (
    <PartnerOnboardingClient
      token={safeToken}
      presentationBrand={publicBrand.brandId ? publicBrand : undefined}
    />
  );
}
