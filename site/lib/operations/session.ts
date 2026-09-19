import { brand } from "@suhuella/brand";
import { isProductionRuntime } from "./auth-runtime";
import { requestHost } from "./host";
import type { OperationsActor } from "./types";

export type OperationsAuthMethod = "cloudflare_access" | "localhost";

export type OperationsEnvironment = "local" | "production";

export type OperationsSession = {
  actor: OperationsActor;
  displayName: string;
  authMethod: OperationsAuthMethod;
  authMethodLabel: string;
  environment: OperationsEnvironment;
  workerLabel: string;
  appVersion: string;
  brandName: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function headerDisplayName(headers: Headers): string | null {
  const raw =
    headers.get("cf-access-authenticated-user-name") ??
    headers.get("Cf-Access-Authenticated-User-Name");
  const value = raw?.trim();
  return value || null;
}

function fallbackDisplayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getWorkerLabel(): string {
  const explicit =
    readEnv("OPERATIONS_WORKER_ID") || readEnv("CLOUDFLARE_DEPLOYMENT_ID");
  if (explicit) {
    return explicit.length > 10 ? `${explicit.slice(0, 6)}…` : explicit;
  }
  return readEnv("CF_WORKER_NAME") || "suhuella";
}

function getAppVersion(): string {
  return readEnv("NEXT_PUBLIC_APP_VERSION") || "0.0.0";
}

export function buildOperationsSession(
  actor: OperationsActor,
  headers: Headers,
  authMethod: OperationsAuthMethod,
): OperationsSession {
  const displayName =
    headerDisplayName(headers) ?? fallbackDisplayName(actor.email);
  const environment: OperationsEnvironment = isProductionRuntime()
    ? "production"
    : "local";

  return {
    actor,
    displayName,
    authMethod,
    authMethodLabel:
      authMethod === "cloudflare_access"
        ? "Authenticated by Cloudflare Access"
        : `Local dev (${requestHost(headers) || "localhost"})`,
    environment,
    workerLabel: getWorkerLabel(),
    appVersion: getAppVersion(),
    brandName: brand.displayName,
  };
}
