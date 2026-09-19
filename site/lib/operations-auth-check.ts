import { isLocalhostHost, requestHost } from "./operations/host.ts";

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

console.log("OPERATIONS-AUTH-001 localhost routing check passed");
