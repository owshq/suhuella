import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  resolveRequestBrandFromHeaders,
  toPublicRequestBrand,
} from "@/lib/partners/request-brand";
import {
  partnerSessionTokenFromCookieHeader,
  resolvePartnerActorFromSessionToken,
} from "@/lib/partners/session";
import { PartnerSetupClient } from "@/components/PartnerSetupClient";

export async function generateMetadata() {
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  return {
    title:
      requestBrand.kind === "partner"
        ? `${requestBrand.displayName} · Partner setup`
        : "Partner setup",
    robots: { index: false, follow: false },
  };
}

export default async function PartnerOnboardingCompletePage() {
  const cookieStore = await cookies();
  const token = partnerSessionTokenFromCookieHeader(cookieStore.toString());
  if (!token) redirect("/partners");
  const actor = await resolvePartnerActorFromSessionToken(token);
  if (!actor || actor.kind !== "partner") redirect("/partners");

  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const publicBrand = toPublicRequestBrand(requestBrand);
  return <PartnerSetupClient presentationBrand={publicBrand} />;
}
