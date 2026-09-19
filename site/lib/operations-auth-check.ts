import { isLocalhostHost, requestHost } from "./operations/host.ts";

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

assert(
  requestHost(new Headers({ host: "localhost:3000" })) === "localhost:3000",
  "requestHost reads host header",
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
