"use client";

import { useCallback, useEffect, useState } from "react";
import { getSuhuellaApi } from "../lib/api";

export type CloudIntegrationCatalogItem = {
  provider: string;
  displayName: string;
  enabled: boolean;
  supportsWebhooks: boolean;
};

export type CloudIntegrationConnection = {
  id: string;
  provider: string;
  status: string;
  accountEmail: string | null;
  accountDisplayName: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type CloudIntegrationSource = {
  id: string;
  displayName: string;
  provider: string;
  status: string;
  accountEmail: string | null;
  browseRoot: string;
};

/** Host catalog ids that OAuth cloud integrations own when the flag is on. */
export const OAUTH_CLOUD_CATALOG_IDS = new Set([
  "google_drive",
  "onedrive",
  "dropbox",
]);

export function cloudProviderCatalogPath(provider: string): string {
  switch (provider) {
    case "google_drive":
      return "suhuella:google-drive";
    case "onedrive":
      return "suhuella:onedrive";
    case "dropbox":
      return "suhuella:dropbox";
    default:
      return `suhuella:${provider.replace(/_/g, "-")}`;
  }
}

export function actionableCloudError(code?: string): string {
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
    case "needs_reauth":
    case "refresh_expired":
      return "Permissions expired. Renew permissions to continue.";
    default:
      return "Something went wrong. Try again.";
  }
}

/**
 * Cloud OAuth state for Sources — single Cloud group (#sources-cloud).
 * Hidden entirely when CLOUD_INTEGRATIONS_ENABLED is off and nothing is connected.
 */
export function useCloudIntegrations() {
  const [enabled, setEnabled] = useState(false);
  const [catalog, setCatalog] = useState<CloudIntegrationCatalogItem[]>([]);
  const [connections, setConnections] = useState<CloudIntegrationConnection[]>([]);
  const [sources, setSources] = useState<CloudIntegrationSource[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const api = getSuhuellaApi();
    if (typeof api.listCloudIntegrations !== "function") {
      setLoaded(true);
      return;
    }
    const result = await api.listCloudIntegrations();
    if (!result.ok) {
      setError(result.error ?? "Could not load cloud accounts.");
      setLoaded(true);
      return;
    }
    setEnabled(result.enabled === true);
    setCatalog(result.catalog);
    setConnections(result.connections);
    setSources(result.sources ?? []);
    setError(null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = enabled || connections.length > 0;

  async function connect(provider: string) {
    setBusy(provider);
    setError(null);
    try {
      const api = getSuhuellaApi();
      const result = await api.startCloudIntegration(provider);
      if (!result.ok) {
        setError(actionableCloudError(result.error));
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
        setError(actionableCloudError(result.error));
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
        setError(actionableCloudError(result.error));
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch {
      setError("Could not renew permissions. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return {
    loaded,
    active,
    enabled,
    catalog,
    connections,
    sources,
    busy,
    error,
    refresh,
    connect,
    disconnect,
    renew,
  };
}
