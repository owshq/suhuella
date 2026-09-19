import { OperationsConsole } from "@/components/operations/OperationsConsole";
import {
  authenticateOperations,
  isProductionRuntime,
  type OperationsAccessConfigKey,
  type OperationsAccessConfigStatus,
} from "@/lib/operations/auth";
import {
  getOperationsBaseUrl,
  isOperationsCanonicalHost,
  requestHost,
} from "@/lib/operations/host";
import { buildOperationsSession } from "@/lib/operations/session";
import { readOperationsSnapshot } from "@/lib/operations/service";
import { getReleaseManifest } from "@/lib/release-manifest";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";

const CONFIG_KEYS: OperationsAccessConfigKey[] = [
  "SUPERADMIN_EMAILS",
  "CF_ACCESS_TEAM_DOMAIN",
  "CF_ACCESS_AUD",
];

function OperationsConfigDiagnostic({
  config,
}: {
  config: OperationsAccessConfigStatus;
}) {
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Missing configuration
      </p>
      <ul className="mt-3 space-y-2 font-mono text-sm">
        {CONFIG_KEYS.map((key) => {
          const present = config[key];
          return (
            <li
              key={key}
              className={present ? "text-emerald-400/90" : "text-rose-300/90"}
            >
              {present ? "✓" : "✗"} {key}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Denied({
  title,
  message,
  config,
}: {
  title: string;
  message: string;
  config?: OperationsAccessConfigStatus;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
          Operations
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
        {config ? <OperationsConfigDiagnostic config={config} /> : null}
      </div>
    </main>
  );
}

export async function OperationsPage() {
  const requestHeaders = await headers();
  const host = requestHost(requestHeaders);

  if (isProductionRuntime() && !isOperationsCanonicalHost(host)) {
    permanentRedirect(getOperationsBaseUrl());
  }

  const auth = await authenticateOperations(requestHeaders);

  if (!auth.ok) {
    const isUnconfigured = auth.error === "access_unconfigured";
    const showDiagnostic =
      isUnconfigured && !isProductionRuntime() && auth.config;

    return (
      <Denied
        title={
          isUnconfigured
            ? isProductionRuntime()
              ? "Operations temporarily unavailable"
              : "Operations configuration incomplete"
            : "Access denied"
        }
        message={auth.message}
        config={showDiagnostic ? auth.config : undefined}
      />
    );
  }

  const session = buildOperationsSession(
    auth.actor,
    requestHeaders,
    auth.authMethod,
  );

  const [snapshot, release] = await Promise.all([
    readOperationsSnapshot(auth.actor),
    getReleaseManifest(),
  ]);

  return (
    <OperationsConsole
      initialSnapshot={snapshot}
      initialRelease={release}
      initialSession={session}
    />
  );
}
