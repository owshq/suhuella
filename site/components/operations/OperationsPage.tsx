import { OperationsConsole } from "@/components/operations/OperationsConsole";
import { authenticateOperations } from "@/lib/operations/auth";
import { buildOperationsSession } from "@/lib/operations/session";
import { readOperationsSnapshot } from "@/lib/operations/service";
import { getReleaseManifest } from "@/lib/release-manifest";
import { headers } from "next/headers";

function Denied({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
          Operations
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </main>
  );
}

export async function OperationsPage() {
  const requestHeaders = await headers();
  const auth = await authenticateOperations(requestHeaders);

  if (!auth.ok) {
    return (
      <Denied
        title={
          auth.error === "access_unconfigured"
            ? "Operations is not configured"
            : "Access denied"
        }
        message={auth.message}
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
