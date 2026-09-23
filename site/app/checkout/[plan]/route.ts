import {
  isCheckoutPlan,
  isCheckoutReturnTo,
  unavailableCheckoutUrl,
  type CheckoutReturnTo,
} from "@/lib/checkout";
import { createStripeCheckoutSession } from "@/lib/checkout-session";
import { clientIpFromRequest } from "@/lib/client-ip";
import { rawCardRejection } from "@/lib/raw-card-guard";
import { rejectIfCapabilityLimited, rejectIfRateLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ plan: string }> },
) {
  const cardRejected = rawCardRejection({ searchParams: request.nextUrl.searchParams });
  if (cardRejected) return cardRejected;

  const limited = await rejectIfCapabilityLimited("checkout");
  if (limited) {
    const origin = request.nextUrl.origin;
    return Response.redirect(new URL("/home", origin), 302);
  }

  const clientIp = clientIpFromRequest(request);
  const rateLimited = await rejectIfRateLimited(
    clientIp ? [{ key: `checkout-page:ip:${clientIp}`, limit: 20 }] : [],
  );
  if (rateLimited) {
    return Response.redirect(new URL("/home", request.nextUrl.origin), 302);
  }

  const { plan } = await context.params;
  if (!isCheckoutPlan(plan)) {
    return Response.redirect(new URL("/", request.url), 302);
  }

  const returnParam = request.nextUrl.searchParams.get("return")?.trim() ?? "";
  const returnTo: CheckoutReturnTo = isCheckoutReturnTo(returnParam) ? returnParam : "public";
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  const platform = request.nextUrl.searchParams.get("platform")?.trim() ?? "";
  const activationAttemptId = request.nextUrl.searchParams.get("attempt")?.trim() ?? "";
  const origin = request.nextUrl.origin;

  try {
    const destination = await createStripeCheckoutSession({
      plan,
      origin,
      returnTo,
      email,
      platform,
      activationAttemptId: activationAttemptId || undefined,
    });
    if (!destination) {
      return Response.redirect(unavailableCheckoutUrl(origin, returnTo, plan), 302);
    }
    return Response.redirect(destination, 302);
  } catch {
    return Response.redirect(unavailableCheckoutUrl(origin, returnTo, plan), 302);
  }
}
