/**
 * Executable route tests: rejected PAN payloads must return 400 before any Stripe API call.
 * Import-only asserts on rawCardRejection are insufficient — this runs the handlers.
 */

import { strict as assert } from "node:assert";
import { NextRequest } from "next/server.js";

let stripeFetchCount = 0;
const previousFetch = globalThis.fetch;

function installStripeFetchCounter(): void {
  stripeFetchCount = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("api.stripe.com")) stripeFetchCount += 1;
    return previousFetch(input, init);
  };
}

function restoreFetch(): void {
  globalThis.fetch = previousFetch;
}

function postJson(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function assertPanRejectedBeforeStripe(
  label: string,
  response: Response,
): Promise<void> {
  assert(response.status === 400, `${label} rejects PAN with 400`);
  const payload = (await response.json()) as { error?: string };
  assert(payload.error === "card_data_not_accepted", `${label} uses card_data_not_accepted`);
  assert(stripeFetchCount === 0, `${label} makes zero Stripe API calls`);
  assert(!JSON.stringify(payload).includes("4242"), `${label} does not echo PAN`);
}

async function runCheckoutRoutePanGuardCheck(): Promise<void> {
  installStripeFetchCounter();

  {
    const { POST: partnerCheckoutPost } = await import("../app/api/partners/checkout/route.ts");
    const request = postJson(
      "https://suhuella.com/api/partners/checkout",
      { payment_method_data: { card: { number: "4242424242424242", cvc: "123" } } },
      { host: "suhuella.com" },
    );
    await assertPanRejectedBeforeStripe("partner checkout POST", await partnerCheckoutPost(request));
  }

  {
    const { POST: businessCheckoutPost } = await import("../app/api/business/checkout/route.ts");
    const request = postJson("https://suhuella.com/api/business/checkout", {
      card: { number: "4242424242424242" },
      proofId: "proof_should_not_be_read",
      seats: 25,
    });
    await assertPanRejectedBeforeStripe("business checkout POST", await businessCheckoutPost(request));
  }

  {
    const { POST: lifetimeUpgradePost } = await import("../app/api/lifetime-upgrade/checkout/route.ts");
    const request = postJson("https://suhuella.com/api/lifetime-upgrade/checkout", {
      payment_method_data: { card: { number: "4242424242424242" } },
      proofId: "proof_should_not_be_read",
      licenseId: "lic_should_not_be_read",
    });
    await assertPanRejectedBeforeStripe(
      "lifetime upgrade checkout POST",
      await lifetimeUpgradePost(request),
    );
  }

  {
    const { GET: personalCheckoutGet } = await import("../app/checkout/[plan]/route.ts");
    const request = new NextRequest(
      "https://suhuella.com/checkout/monthly?card%5Bnumber%5D=4242424242424242",
    );
    await assertPanRejectedBeforeStripe(
      "personal checkout GET",
      await personalCheckoutGet(request, { params: Promise.resolve({ plan: "monthly" }) }),
    );
  }

  {
    const { GET: verifySessionGet } = await import("../app/api/verify-session/route.ts");
    const request = new NextRequest(
      "https://suhuella.com/api/verify-session?session_id=cs_live_test&payment_method_data%5Bcard%5D%5Bnumber%5D=4242424242424242",
    );
    await assertPanRejectedBeforeStripe("verify-session GET", await verifySessionGet(request));
  }

  restoreFetch();
  console.log("checkout-route-pan-guard check passed");
}

void runCheckoutRoutePanGuardCheck().catch((error) => {
  restoreFetch();
  console.error(error);
  process.exit(1);
});
