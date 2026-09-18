import { LandingContent } from "@/components/LandingContent";
import { PageShell } from "@/components/PageShell";
import { getStripeCheckoutUrl } from "@/lib/stripe";

export default function Home() {
  return (
    <PageShell landing>
      <LandingContent checkoutUrl={getStripeCheckoutUrl()} />
    </PageShell>
  );
}
