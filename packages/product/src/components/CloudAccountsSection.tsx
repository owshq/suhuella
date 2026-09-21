"use client";

import { useCallback, useEffect, useState } from "react";
import { getSuhuellaApi } from "../lib/api";

type CatalogItem = {
  provider: string;
  displayName: string;
  enabled: boolean;
  supportsWebhooks: boolean;
};

type ConnectionItem = {
  id: string;
  provider: string;
  status: string;
  accountEmail: string | null;
  accountDisplayName: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

type SyncProgress = {
  jobId: string;
  status: string;
  progressFiles: number;
  lastErrorMessage: string | null;
} | null;

/**
 * Cloud account connections — lives on Sources (what SuHuella can see),
 * not Settings. Cloudflare Access and Stripe are separate.
 */
export function CloudAccountsSection() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncById, setSyncById] = useState<Record<string, SyncProgress>>({});

  const refresh = useCallback(async () => {
    const api = getSuhuellaApi();
    if (typeof api.listCloudIntegrations !== "function") return;
    const result = await api.listCloudIntegrations();
    if (!result.ok) {
      setError(result.error ?? "Could not load cloud accounts.");
      return;
    }
    setCatalog(result.catalog);
    setConnections(result.connections);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(provider: string) {
    setBusy(provider);
    setError(null);
    try {
      const api = getSuhuellaApi();
      const result = await api.startCloudIntegration(provider);
      if (!result.ok) {
        setError(actionableError(result.error));
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch {
      setError("Could not start connection. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    setBusy(id);
    setError(null);
    try {
      const api = getSuhuellaApi();
      const result = await api.disconnectCloudIntegration(id);
      if (!result.ok) {
        setError(actionableError(result.error));
        return;
      }
      await refresh();
    } catch {
      setError("Could not disconnect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function renew(id: string) {
    setBusy(`renew:${id}`);
    setError(null);
    try {
      const api = getSuhuellaApi();
      const result = await api.reconnectCloudIntegration(id);
      if (!result.ok) {
        setError(actionableError(result.error));
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch {
      setError("Could not renew permissions. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function loadStatus(id: string) {
    const api = getSuhuellaApi();
    if (typeof api.getCloudIntegrationStatus !== "function") return;
    const result = await api.getCloudIntegrationStatus(id);
    if (result.ok) {
      setSyncById((prev) => ({ ...prev, [id]: result.sync }));
    }
  }

  useEffect(() => {
    for (const connection of connections) {
      void loadStatus(connection.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.map((c) => c.id).join(",")]);

  if (catalog.length === 0 && connections.length === 0) return null;

  return (
    <section className="mt-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Cloud accounts</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Connect a cloud account so SuHuella can see its files. This is not an admin login and not a purchase.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((item) => {
          const connected = connections.find((c) => c.provider === item.provider);
          const sync = connected ? syncById[connected.id] : null;
          return (
            <div
              key={item.provider}
              className="rounded-[1.4rem] border border-white/70 bg-white/60 px-4 py-4 backdrop-blur-xl"
            >
              <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>
              {connected ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    {connected.accountDisplayName || connected.accountEmail || "Connected account"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status: {statusLabel(connected.status)}
                    {connected.lastSyncAt ? ` · Last sync ${formatWhen(connected.lastSyncAt)}` : ""}
                  </p>
                  {sync?.status === "queued" || sync?.status === "running" || sync?.status === "waiting_backoff" ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Syncing… {sync.progressFiles} files
                    </p>
                  ) : null}
                  {connected.lastErrorMessage ? (
                    <p role="status" className="mt-2 text-xs text-amber-800">
                      {connected.lastErrorMessage}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void renew(connected.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Renew permissions
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void disconnect(connected.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : item.enabled ? (
                <>
                  <p className="mt-1 text-sm text-slate-500">Not connected</p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void connect(item.provider)}
                    className="mt-3 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === item.provider ? "Opening…" : "Connect"}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-500">Coming later</p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-3 cursor-not-allowed rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-500"
                  >
                    Coming later
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function statusLabel(status: string): string {
  if (status === "active") return "Indexed";
  if (status === "needs_reauth") return "Needs permission";
  if (status === "error") return "Unavailable";
  return status;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function actionableError(code?: string): string {
  switch (code) {
    case "integrations_disabled":
      return "Cloud connections are not available yet.";
    case "provider_not_enabled":
      return "This provider is not available yet.";
    case "oauth_client_missing":
      return "Cloud connection is not configured. Try again later.";
    case "owner_required":
      return "This device could not be identified. Reload and try again.";
    case "forbidden":
      return "That connection belongs to another device.";
    case "refresh_expired":
      return "Permissions expired. Renew permissions to continue.";
    default:
      return "Something went wrong. Try again.";
  }
}
