/**
 * SuHuella never sends a primary account number to Stripe.
 * Card data belongs only on Stripe-hosted Checkout. These helpers reject
 * client fields that would carry it, without echoing the value.
 */

const RAW_CARD_FORM_KEYS = new Set([
  "card[number]",
  "card[cvc]",
  "card[exp_month]",
  "card[exp_year]",
  "payment_method_data[card]",
  "payment_method_data[card][number]",
  "payment_method_data[card][cvc]",
  "payment_method_data[card][exp_month]",
  "payment_method_data[card][exp_year]",
  "source[number]",
  "source[cvc]",
  "payment_method[card][number]",
]);

export function isRawCardFieldName(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (RAW_CARD_FORM_KEYS.has(normalized)) return true;
  if (normalized.startsWith("payment_method_data[card]")) return true;
  if (normalized.startsWith("card[") && normalized.includes("number")) return true;
  if (normalized.startsWith("source[") && normalized.includes("number")) return true;
  return false;
}

function jsonCarriesRawCard(value: unknown, parentKey = ""): boolean {
  if (Array.isArray(value)) return value.some((item) => jsonCarriesRawCard(item, parentKey));
  if (!value || typeof value !== "object") return false;
  const parent = parentKey.toLowerCase();
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (isRawCardFieldName(normalized)) return true;
    if ((parent === "card" || parent === "source") && (normalized === "number" || normalized === "cvc")) {
      return true;
    }
    if (parent === "payment_method_data" && normalized === "card") return true;
    if (jsonCarriesRawCard(child, normalized)) return true;
  }
  return false;
}

export function requestCarriesRawCardData(input: {
  searchParams?: { keys(): Iterable<string> } | null;
  body?: unknown;
}): boolean {
  if (input.searchParams) {
    for (const key of input.searchParams.keys()) {
      if (isRawCardFieldName(key)) return true;
    }
  }
  return jsonCarriesRawCard(input.body);
}

export function rawCardRejection(input: {
  searchParams?: { keys(): Iterable<string> } | null;
  body?: unknown;
}): Response | null {
  if (!requestCarriesRawCardData(input)) return null;
  return Response.json(
    { ok: false, error: "card_data_not_accepted" },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
