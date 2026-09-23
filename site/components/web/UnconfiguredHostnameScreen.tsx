import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { unconfiguredHostnameCopy } from "@/lib/partners/unconfigured-hostname-copy";
import type { RequestBrandKind } from "@/lib/partners/request-brand";

type UnconfiguredHostnameScreenProps = {
  hostname: string | null;
  kind: RequestBrandKind;
  domainStatus?: string | null;
};

export async function UnconfiguredHostnameScreen({
  hostname,
  kind,
  domainStatus,
}: UnconfiguredHostnameScreenProps) {
  const locale = await getRequestLocale();
  const copy = unconfiguredHostnameCopy({ kind, domainStatus, locale });

  return (
    <main
      data-suhuella-app
      data-brand-kind={kind}
      className="flex h-dvh min-h-0 w-full items-center justify-center bg-[var(--app-bg,#f1f5f9)] px-6 py-12 text-[var(--app-fg,#0f172a)]"
    >
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-sm">
        {hostname ? (
          <p className="font-mono text-xs text-slate-500" aria-label="Hostname">
            {hostname}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{copy.title}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{copy.body}</p>
        {copy.secondary ? (
          <p className="text-sm leading-relaxed text-slate-500">{copy.secondary}</p>
        ) : null}
      </div>
    </main>
  );
}
