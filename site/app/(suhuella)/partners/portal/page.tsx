import { headers } from "next/headers";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { PartnerPortalClient } from "@/components/PartnerPortalClient";
import { isPlatformPublicHostname, normalizeHostname } from "@/lib/partners/domains";

export const dynamic = "force-dynamic";

export default async function PartnerPortalPage() {
  const headerStore = await headers();
  const host = normalizeHostname(headerStore.get("x-forwarded-host") || headerStore.get("host") || "");
  if (host && !isPlatformPublicHostname(host)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">Partner panel</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Brand sites stay on the verified hostname. Partner administration stays on the SuHuella
          platform host.
        </p>
        <Link href="https://suhuella.com/partners/portal" className="mt-6 text-sm font-medium underline">
          Open the panel on suhuella.com
        </Link>
      </main>
    );
  }
  return (
    <PageShell scrollable themeAdaptive>
      <PartnerPortalClient />
    </PageShell>
  );
}
