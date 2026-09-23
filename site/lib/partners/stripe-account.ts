/** SuHuella platform Stripe account. Not a secret. Never substitute another account. */
export const SUHUELLA_STRIPE_ACCOUNT_ID = "acct_1TSg2hAAPiPo60kj";

export const PARTNER_PRODUCT_TYPE = "operator_license";
export const PARTNER_PLAN_ID = "partner_annual";

export type StripeAccountCheck =
  | { ok: true; livemode: boolean }
  | { ok: false; reason: "account" | "livemode" | "stripe_unavailable" };

export async function assertSuhuellaLiveStripeAccount(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StripeAccountCheck> {
  const key = secretKey.trim();
  if (!key) return { ok: false, reason: "stripe_unavailable" };
  let response: Response;
  try {
    response = await fetchImpl("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "stripe_unavailable" };
  const body = (await response.json()) as { id?: string; livemode?: boolean };
  if (body.id !== SUHUELLA_STRIPE_ACCOUNT_ID) return { ok: false, reason: "account" };
  if (body.livemode !== true) return { ok: false, reason: "livemode" };
  return { ok: true, livemode: true };
}
