import type { Metadata } from "next";
import { BusinessCheckoutPageContent } from "@/components/BusinessCheckoutPageContent";
import { getBusinessPricingConfig, monthlyAmountCents } from "@/lib/business-config";
import { isBusinessCheckoutPubliclyEnabled } from "@/lib/business/checkout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Business checkout" },
  robots: { index: false, follow: false },
};

export default function BusinessCheckoutPage() {
  const pricing = getBusinessPricingConfig();
  return (
    <BusinessCheckoutPageContent
      checkoutEnabled={isBusinessCheckoutPubliclyEnabled()}
      pricing={{
        ...pricing,
        minMonthlyCents: monthlyAmountCents(pricing.minSeats, pricing),
      }}
    />
  );
}
