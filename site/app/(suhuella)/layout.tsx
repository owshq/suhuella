import { isOperationsOnlyHost, requestHost } from "@/lib/operations/host";
import { resolveRequestBrandFromHeaders } from "@/lib/partners/request-brand";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Product shell. On ops.suhuella.com the edge middleware rewrites `/` → `/ops`.
 *
 * Partner branding comes from request Host → D1 (see root layout + SuhuellaApp).
 * Non-active partner hosts are rewritten by middleware to /hostname-status.
 */
export default async function SuhuellaShellLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = requestHost(headerList);
  if (isOperationsOnlyHost(host)) {
    notFound();
  }

  const requestBrand = await resolveRequestBrandFromHeaders(headerList);

  return (
    <div
      data-suhuella-app
      data-brand-kind={requestBrand.kind}
      data-brand-id={requestBrand.brandId ?? ""}
      className="h-dvh overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)]"
    >
      {children}
    </div>
  );
}
