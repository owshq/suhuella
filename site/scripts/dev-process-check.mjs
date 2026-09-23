import { readFileSync } from "node:fs";
import {
  cwdFromLsofFn,
  decideDevChildExit,
  decideDevStart,
  hostnameFromArgv,
  isNetworkInterfaceEnumerationError,
  isSuhuellaSiteDev,
  isSuhuellaWorkerd,
  nextDevArgs,
  nextLockPaths,
  parseEtimeSeconds,
  probeNetworkInterfaces,
  resolveDevListenHost,
  resolveNextDistDir,
  siteMarker,
  siteNextCacheDir,
  toNextConfigDistDir,
} from "./dev-process.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const siteDir = "/Users/narcisclavell/Documents/suhuella/site";

assert(siteMarker(siteDir) === "/suhuella/site", "site marker uses path separators");

assert(
  cwdFromLsofFn("p12\nfcwd\nn/Users/narcisclavell/Documents/suhuella/site\n") ===
    "/Users/narcisclavell/Documents/suhuella/site",
  "lsof cwd keeps the leading slash",
);
assert(cwdFromLsofFn("") === "", "empty lsof cwd is empty");

assert(parseEtimeSeconds("01:02") === 62, "mm:ss etime");
assert(parseEtimeSeconds("1:02:03") === 3723, "hh:mm:ss etime");
assert(parseEtimeSeconds("2-01:00:00") === 2 * 86400 + 3600, "dd-hh:mm:ss etime");
assert(parseEtimeSeconds("bogus") == null, "invalid etime is null");
assert(
  "01:12 next-server (v16.3.5)".match(/^(\S+)\s+(.*)$/)?.[2] === "next-server (v16.3.5)",
  "ps etime+command split keeps the command",
);

assert(
  isSuhuellaSiteDev(
    {
      command: "next-server (v16.3.5)",
      cwd: "/Users/narcisclavell/Documents/suhuella/site",
    },
    siteDir,
  ),
  "matches this repo's next-server",
);
assert(
  isSuhuellaSiteDev(
    {
      command: "next-server (v16.3.5)",
      cwd: "",
      haystack:
        "next-server (v16.3.5) node /Users/narcisclavell/Documents/suhuella/site/node_modules/.bin/next dev -p 3000",
    },
    siteDir,
  ),
  "matches next-server via parent lineage without lsof cwd",
);
assert(
  isSuhuellaSiteDev(
    {
      command: "node /tmp/other-app/node_modules/.bin/next dev -p 3000",
      cwd: "/tmp/other-app",
    },
    siteDir,
  ) === false,
  "does not match a foreign Next app",
);
assert(
  isSuhuellaSiteDev(
    {
      command:
        "node /Users/narcisclavell/Documents/suhuella/site/node_modules/next/dist/server/lib/start-server.js",
      cwd: "",
    },
    siteDir,
  ),
  "matches Next start-server in this repo",
);
assert(
  isSuhuellaWorkerd(
    {
      command:
        "/Users/narcisclavell/Documents/suhuella/site/node_modules/@cloudflare/workerd-darwin-arm64/bin/workerd serve",
      cwd: "/",
    },
    siteDir,
  ),
  "matches this repo's workerd",
);
assert(
  isSuhuellaWorkerd(
    {
      command: "/opt/homebrew/bin/workerd serve",
      cwd: "/",
    },
    siteDir,
  ) === false,
  "does not match an unrelated workerd",
);

assert(decideDevStart({ siteDevPids: [11], healthy: true }).action === "reuse", "reuse a healthy server");
assert(
  decideDevStart({ siteDevPids: [11], healthy: false, recent: true }).action === "reuse",
  "leave a compiling server alone",
);
assert(
  decideDevStart({ siteDevPids: [11], healthy: false, recent: true, force: true }).action === "reset",
  "force may reset a compiling server",
);
assert(
  decideDevStart({ siteDevPids: [11], healthy: false, recent: false }).action === "reset",
  "reset a demonstrably stale server",
);
assert(
  decideDevStart({ siteDevPids: [], lockPid: 99 }).action === "start",
  "stale lock without a live process starts, it does not kill",
);
assert(
  decideDevStart({ siteDevPids: [], foreignOnPort: [4] }).action === "blocked",
  "foreign port is blocked",
);
assert(decideDevStart({}).action === "start", "idle start");

assert(
  resolveNextDistDir({
    siteDir: "/Users/narcisclavell/Documents/suhuella/site",
    env: {},
  }) === "/Users/narcisclavell/Documents/suhuella/site/.next",
  "Turbopack requires .next inside the project path",
);
assert(
  resolveNextDistDir({
    siteDir: "/Users/narcisclavell/Developer/suhuella/site",
    env: {},
  }) === "/Users/narcisclavell/Developer/suhuella/site/.next",
  "a local Developer checkout keeps .next in the project",
);
assert(
  resolveNextDistDir({
    siteDir: "/Users/narcisclavell/Documents/suhuella/site",
    env: { SUHUELLA_NEXT_DIST: "/var/cache/suhuella-next" },
  }) === "/var/cache/suhuella-next",
  "SUHUELLA_NEXT_DIST wins",
);
assert(
  nextLockPaths("/tmp/suhuella-site-next")[0] === "/tmp/suhuella-site-next/dev/lock",
  "lock files follow the resolved dist dir",
);
assert(
  toNextConfigDistDir(
    "/Users/narcisclavell/Documents/suhuella/site",
    "/Users/narcisclavell/Library/Caches/suhuella/site-next",
  ) === "../../../Library/Caches/suhuella/site-next",
  "Next distDir must be relative so it does not nest under site/",
);

assert(
  decideDevChildExit({ code: 0, remainingSitePids: [42] }).action === "adopt",
  "keep the wrapper alive when Next replaces itself",
);
assert(
  decideDevChildExit({ code: 77, remainingSitePids: [] }).action === "respawn",
  "respawn when Next exits with a restart code",
);
assert(
  decideDevChildExit({ code: 0, remainingSitePids: [] }).action === "exit",
  "a clean Next exit without a replacement ends the wrapper",
);
assert(
  decideDevChildExit({ signal: "SIGINT" }).action === "exit",
  "signals end the wrapper",
);

assert(
  isNetworkInterfaceEnumerationError({
    code: "ERR_SYSTEM_ERROR",
    syscall: "uv_interface_addresses",
    message: "A system error occurred: uv_interface_addresses returned Unknown system error 1",
  }),
  "matches the Next/libuv interface enumeration failure",
);
assert(
  isNetworkInterfaceEnumerationError(new TypeError("boom")) === false,
  "does not treat unrelated errors as interface enumeration failures",
);
assert(probeNetworkInterfaces(() => ({})).ok === true, "successful probe is ok");
assert(
  probeNetworkInterfaces(() => {
    const error = new Error("uv_interface_addresses returned Unknown system error 1");
    error.code = "ERR_SYSTEM_ERROR";
    error.syscall = "uv_interface_addresses";
    throw error;
  }).ok === false,
  "uv_interface_addresses is a failed probe, not a throw",
);
try {
  probeNetworkInterfaces(() => {
    throw new TypeError("unrelated");
  });
  throw new Error("unrelated probe errors must not be swallowed");
} catch (error) {
  assert(error instanceof TypeError, "unrelated probe errors propagate");
}

assert(hostnameFromArgv(["--force", "-H", "127.0.0.1"]) === "127.0.0.1", "parses -H");
assert(hostnameFromArgv(["--hostname=0.0.0.0"]) === "0.0.0.0", "parses --hostname=");
assert(hostnameFromArgv(["--force"]) == null, "no hostname flag is null");
assert(
  resolveDevListenHost({ env: {}, argv: [] }).host === "127.0.0.1",
  "default listen host is loopback so Next skips getNetworkHost",
);
assert(
  resolveDevListenHost({ env: { SUHUELLA_DEV_HOST: "0.0.0.0" }, argv: [] }).host === "0.0.0.0",
  "SUHUELLA_DEV_HOST overrides loopback",
);
assert(
  resolveDevListenHost({
    env: { SUHUELLA_DEV_HOST: "0.0.0.0", HOSTNAME: "Narciss-MacBook-Air.local" },
    argv: ["-H", "10.0.0.8"],
  }).host === "10.0.0.8",
  "argv hostname wins and HOSTNAME is ignored",
);
assert(
  JSON.stringify(nextDevArgs({ port: 3000 })) === JSON.stringify(["dev", "-p", "3000", "-H", "127.0.0.1"]),
  "next args bind loopback by default",
);
assert(
  JSON.stringify(nextDevArgs({ port: 3001, host: null })) === JSON.stringify(["dev", "-p", "3001"]),
  "explicit null host keeps Next default args",
);
assert(
  JSON.stringify(nextDevArgs({ port: 3000, webpack: true })).includes("--webpack"),
  "webpack diagnostic flag is passed through",
);

assert(
  !readText("../../brands/project-site.mjs").includes("next.config"),
  "brand projection must not touch next.config.ts",
);
assert(
  !readText("../../brands/project-brand.mjs").includes("next.config"),
  "brand entry projection must not touch next.config.ts",
);

console.log("dev-process-check: ok");

function readText(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}
