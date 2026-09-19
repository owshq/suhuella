import { getBusinessPricingConfig, monthlyAmountCents } from "@/lib/business-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const pricing = getBusinessPricingConfig();
  return Response.json(
    {
      ok: true,
      pricing: {
        ...pricing,
        monthlyAmountCents: monthlyAmountCents(pricing.minSeats, pricing),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
