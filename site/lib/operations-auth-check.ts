import {
  isLocalhostHost,
  isOperationsOnlyHost,
  isSuhuellaPublicHost,
  isWorkersDevHost,
  requestHost,
} from "./operations/host.ts";
import { decideOpsHostGate } from "./operations/ops-host-gate.ts";
import { operationsSectionFromSlug } from "./operations/routes.ts";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ConfigStatus = {
  SUPERADMIN_EMAILS: boolean;
  CF_ACCESS_TEAM_DOMAIN: boolean;
  CF_ACCESS_AUD: boolean;
};

function isOperationsAccessConfigured(status: ConfigStatus): boolean {
  return (
    status.SUPERADMIN_EMAILS &&
    status.CF_ACCESS_TEAM_DOMAIN &&
    status.CF_ACCESS_AUD
  );
}

function missingOperationsAccessConfig(status: ConfigStatus): string[] {
  return (Object.entries(status) as [keyof ConfigStatus, boolean][])
    .filter(([, present]) => !present)
    .map(([key]) => key);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(isLocalhostHost("localhost:3000"), "localhost host is recognized");
assert(isLocalhostHost("127.0.0.1:3000"), "127.0.0.1 host is recognized");
assert(isLocalhostHost("[::1]:3000"), "IPv6 loopback host is recognized");
assert(!isLocalhostHost("suhuella.com"), "production host is not localhost");
assert(!isLocalhostHost("ops.suhuella.com"), "ops subdomain is not localhost");
assert(isWorkersDevHost("suhuella.example.workers.dev"), "workers.dev host is recognized");
assert(!isLocalhostHost("suhuella.example.workers.dev"), "workers.dev is not treated as local dev");
assert(!isOperationsOnlyHost("suhuella.example.workers.dev"), "workers.dev is not the canonical ops host");
assert(isSuhuellaPublicHost("suhuella.com"), "apex is the public product host");
assert(isSuhuellaPublicHost("www.suhuella.com"), "www is the public product host");
assert(!isSuhuellaPublicHost("ops.suhuella.com"), "ops host is not the public site");
assert(isOperationsOnlyHost("ops.suhuella.com"), "ops host is operations-only");
assert(!isOperationsOnlyHost("suhuella.com"), "apex is not operations-only");
assert(!isOperationsOnlyHost("localhost:3000"), "localhost is not operations-only");
assert(operationsSectionFromSlug("licenses") === "licenses", "licenses slug maps");
assert(operationsSectionFromSlug("devices") === "licenses", "devices live under Licenses");
assert(operationsSectionFromSlug("usage") === "activity", "usage lives under Activity");
assert(operationsSectionFromSlug("seats") === "business", "seats live under Business");
assert(operationsSectionFromSlug("audit") === "activity", "audit lives under Activity");
assert(operationsSectionFromSlug("billing") === "billing", "billing is a control-center area");
assert(operationsSectionFromSlug("ia") === null, "no IA section on ops");
assert(operationsSectionFromSlug("ai") === null, "no AI section on ops");

const nextConfig = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "next.config.ts"),
  "utf8",
);
assert(nextConfig.includes('value: "ops.suhuella.com"'), "ops host rewrite is configured");
assert(nextConfig.includes('destination: "/ops"'), "ops root rewrites to the console");
assert(nextConfig.includes('value: "suhuella.com"'), "apex /_ops redirects off the public site");
assert(
  nextConfig.includes('source: "/ops"') &&
    nextConfig.includes('destination: "/"') &&
    nextConfig.includes('value: "ops.suhuella.com"'),
  "ops host canonicalizes /ops → / (breaks Access redirect loop)",
);
assert(!nextConfig.includes('destination: "/ia"'), "no /ia product route");
assert(!nextConfig.includes('destination: "/ai"'), "no /ai product route");

const suhuellaLayout = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app/(suhuella)/layout.tsx"),
  "utf8",
);
assert(!suhuellaLayout.includes('redirect("/ops")'), "product shell must not redirect to /ops on ops host");
assert(suhuellaLayout.includes("notFound"), "product shell 404s on ops host instead of bouncing");

assert(
  decideOpsHostGate({ hostname: "ops.suhuella.com", pathname: "/" }).action === "rewrite" &&
    (decideOpsHostGate({ hostname: "ops.suhuella.com", pathname: "/" }) as { pathname: string })
      .pathname === "/ops",
  "ops host / rewrites to /ops",
);
assert(
  decideOpsHostGate({ hostname: "ops.suhuella.com", pathname: "/ops" }).action === "redirect" &&
    (decideOpsHostGate({ hostname: "ops.suhuella.com", pathname: "/ops" }) as { pathname: string })
      .pathname === "/",
  "ops host /ops redirects once to /",
);
assert(
  decideOpsHostGate({ hostname: "suhuella.com", pathname: "/ops" }).action === "next",
  "public site is not handled by ops host gate",
);
assert(
  decideOpsHostGate({ hostname: "ops.suhuella.com", pathname: "/cdn-cgi/access/callback" }).action ===
    "next",
  "Access callback bypasses ops rewrites",
);

assert(
  requestHost(new Headers({ host: "localhost:3000" })) === "localhost:3000",
  "requestHost reads host header",
);
assert(
  requestHost(
    new Headers({
      host: "suhuella.example.workers.dev",
      "x-forwarded-host": "ops.suhuella.com",
    }),
  ) === "ops.suhuella.com",
  "requestHost prefers forwarded ops host over workers.dev (prevents redirect loop)",
);
assert(
  isOperationsOnlyHost(
    requestHost(
      new Headers({
        host: "suhuella.example.workers.dev",
        "x-forwarded-host": "ops.suhuella.com",
      }),
    ),
  ),
  "forwarded ops host is treated as operations-only",
);
assert(
  requestHost(
    new Headers({
      host: "suhuella.com",
      "x-forwarded-host": "evil-partner.example",
    }),
  ) === "suhuella.com",
  "public host ignores spoofed X-Forwarded-Host",
);
assert(
  requestHost(
    new Headers({
      host: "evil.workers.dev",
      "x-forwarded-host": "ops.suhuella.com",
    }),
  ) === "evil.workers.dev",
  "foreign workers.dev ignores X-Forwarded-Host",
);

const emptyConfig = {
  SUPERADMIN_EMAILS: false,
  CF_ACCESS_TEAM_DOMAIN: false,
  CF_ACCESS_AUD: false,
};
assert(
  isOperationsAccessConfigured(emptyConfig) === false,
  "empty config is incomplete",
);
assert(
  missingOperationsAccessConfig(emptyConfig).length === 3,
  "empty config lists all missing keys",
);

const partialConfig = {
  SUPERADMIN_EMAILS: true,
  CF_ACCESS_TEAM_DOMAIN: true,
  CF_ACCESS_AUD: false,
};
assert(
  isOperationsAccessConfigured(partialConfig) === false,
  "partial config is incomplete",
);
assert(
  missingOperationsAccessConfig(partialConfig).join(",") === "CF_ACCESS_AUD",
  "partial config names missing AUD",
);

console.log("OPERATIONS-AUTH-001 localhost routing check passed");
console.log("OPERATIONS-AUTH-001 access config diagnostic check passed");
console.log("OPERATIONS-AUTH-001 host split check passed");
