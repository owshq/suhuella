export type BusinessPricingConfig = {
  minSeats: number;
  seatPriceCents: number;
  currency: string;
  minMonthlyCents: number;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Server/site business configuration. Never ship these numbers in Desktop. */
export function getBusinessPricingConfig(): BusinessPricingConfig {
  const minSeats = envInt("BUSINESS_MIN_SEATS", 20);
  const seatPriceCents = envInt("BUSINESS_SEAT_PRICE_CENTS", 200);
  const currency = (process.env.BUSINESS_CURRENCY?.trim() || "eur").toLowerCase();
  const minMonthlyCents = envInt(
    "BUSINESS_MIN_MONTHLY_CENTS",
    minSeats * seatPriceCents,
  );

  return { minSeats, seatPriceCents, currency, minMonthlyCents };
}

export function monthlyAmountCents(
  seatLimit: number,
  config: BusinessPricingConfig = getBusinessPricingConfig(),
): number {
  return Math.max(config.minMonthlyCents, seatLimit * config.seatPriceCents);
}
