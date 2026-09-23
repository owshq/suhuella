import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

export const DEV_HEALTH_PATH = "/";
export const DEV_RECENT_SECONDS = 90;
export const DEV_STOP_GRACE_MS = 5_000;
export const DEV_HEALTH_TIMEOUT_MS = 2_000;
export const DEV_LOOPBACK_HOST = "127.0.0.1";

/** Next 16 calls os.networkInterfaces() when hostname is unset, to print Network:. */
export function isNetworkInterfaceEnumerationError(error) {
  if (!error || typeof error !== "object") return false;
  const code = error.code;
  const syscall = error.syscall ?? error.info?.syscall;
  const message = String(error.message || error.info?.message || "");
  return (
    code === "ERR_SYSTEM_ERROR" &&
    (String(syscall).includes("uv_interface_addresses") || message.includes("uv_interface_addresses"))
  );
}

export function probeNetworkInterfaces(networkInterfaces = os.networkInterfaces) {
  try {
    networkInterfaces();
    return { ok: true };
  } catch (error) {
    if (isNetworkInterfaceEnumerationError(error)) {
      return { ok: false, error };
    }
    throw error;
  }
}

export function hostnameFromArgv(argv = []) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--hostname" || arg === "-H") {
      const value = argv[index + 1];
      if (value && !value.startsWith("-")) return value;
    }
    if (arg.startsWith("--hostname=")) return arg.slice("--hostname=".length) || null;
    if (arg.startsWith("-H=")) return arg.slice(3) || null;
  }
  return null;
}

/**
 * Bind Next to loopback by default. Passing -H skips getNetworkHost / os.networkInterfaces(),
 * which throws ERR_SYSTEM_ERROR (uv_interface_addresses) on some macOS/Node setups.
 * Do not read HOSTNAME — the shell sets that to the machine name.
 */
export function resolveDevListenHost({ env = process.env, argv = [] } = {}) {
  const fromArgv = hostnameFromArgv(argv);
  if (fromArgv) return { host: fromArgv, reason: "argv" };
  const fromEnv = String(env.SUHUELLA_DEV_HOST || "").trim();
  if (fromEnv) return { host: fromEnv, reason: "env" };
  return { host: DEV_LOOPBACK_HOST, reason: "loopback" };
}

export function nextDevArgs({ port, host = DEV_LOOPBACK_HOST, webpack = false } = {}) {
  const args = ["dev", "-p", String(port)];
  if (host) args.push("-H", host);
  if (webpack) args.push("--webpack");
  return args;
}

export function run(command, cwd, timeoutMs = 2_000) {
  const result = spawnSync(command, {
    shell: true,
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function runArgs(file, args, cwd, timeoutMs = 2_000) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  return result.status === 0 ? (result.stdout || "").trim() : "";
}

export function siteMarker(siteDir) {
  return `${path.sep}suhuella${path.sep}site`;
}

export function siteNextCacheDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "suhuella", "site-next");
  }
  return path.join(os.homedir(), ".cache", "suhuella", "site-next");
}

export function cwdFromLsofFn(output) {
  const line = String(output || "")
    .split("\n")
    .find((row) => row.startsWith("n/"));
  return line ? line.slice(1) : "";
}

export function parseEtimeSeconds(etime) {
  const text = String(etime || "").trim();
  if (!text) return null;
  const [maybeDays, rest] = text.includes("-") ? text.split("-") : [null, text];
  const days = maybeDays == null ? 0 : Number(maybeDays);
  const parts = rest.split(":").map(Number);
  if (!Number.isFinite(days) || parts.some((value) => !Number.isFinite(value))) return null;
  if (parts.length === 3) return days * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return days * 86400 + parts[0] * 60 + parts[1];
  if (parts.length === 1) return days * 86400 + parts[0];
  return null;
}

export function pidsOnPort(port, cwd) {
  const out = runArgs("lsof", ["-nP", "-ti", `tcp:${port}`, "-sTCP:LISTEN"], cwd, 2_000);
  return out ? out.split("\n").filter(Boolean).map((value) => Number(value)) : [];
}

export function processLineage(pid, cwd) {
  const seen = new Set();
  const commands = [];
  let current = Number(pid);
  while (Number.isFinite(current) && current > 1 && !seen.has(current) && seen.size < 12) {
    seen.add(current);
    const command = run(`ps -p ${current} -o command= 2>/dev/null`, cwd, 1_000);
    const ppid = Number(run(`ps -p ${current} -o ppid= 2>/dev/null`, cwd, 1_000));
    if (command) commands.push(command);
    current = ppid;
  }
  return { commands, haystack: commands.join(" ") };
}

export function processInfo(pid, cwd) {
  const lineage = processLineage(pid, cwd);
  const elapsed = parseEtimeSeconds(run(`ps -p ${pid} -o etime= 2>/dev/null`, cwd, 1_000));
  return {
    pid,
    command: lineage.commands[0] || "",
    cwd: "",
    haystack: lineage.haystack,
    elapsed,
  };
}

export function isSuhuellaSiteDev(info, siteDir) {
  const marker = siteMarker(siteDir);
  const haystack = info.haystack || `${info.command} ${info.cwd}`;
  if (!haystack.includes(marker) && !haystack.includes("suhuella/site")) return false;
  return /(next-server|next dev|node_modules\/\.bin\/next|npm exec next dev|next\/dist\/server\/lib\/start-server)/.test(
    haystack,
  );
}

export function isSuhuellaWorkerd(info, siteDir) {
  const haystack = info.haystack || `${info.command} ${info.cwd}`;
  if (!haystack.includes("workerd")) return false;
  return (
    haystack.includes(`${siteDir}/node_modules/@cloudflare/workerd`) ||
    haystack.includes("suhuella/site/node_modules/@cloudflare/workerd")
  );
}

export function isRecentDevProcess(pids, siteDir, nowElapsedLimit = DEV_RECENT_SECONDS) {
  if (!pids.length) return false;
  const wanted = new Set(pids.map(Number));
  return listProcessTable(siteDir).some(
    (row) => wanted.has(row.pid) && row.elapsed != null && row.elapsed < nowElapsedLimit,
  );
}

/**
 * Decide whether a new `npm run dev` may reuse, reset, start, or refuse.
 * Never reset a process that is still starting unless `--force`.
 */
export function decideDevStart({
  force = false,
  siteDevPids = [],
  lockPid = null,
  healthy = false,
  recent = false,
  foreignOnPort = [],
} = {}) {
  if (foreignOnPort.length && !siteDevPids.length) {
    return { action: "blocked", reason: "foreign-port" };
  }
  if (siteDevPids.length && !force && healthy) {
    return { action: "reuse", reason: "healthy" };
  }
  if (siteDevPids.length && !force && recent) {
    return { action: "reuse", reason: "starting" };
  }
  if (siteDevPids.length) {
    return { action: "reset", reason: force ? "force" : "stale" };
  }
  if (lockPid) {
    return { action: "start", reason: "stale-lock" };
  }
  return { action: "start", reason: "idle" };
}

export function listProcessTable(cwd) {
  const out = runArgs("ps", ["-axo", "pid=,etime=,command="], cwd, 5_000);
  const rows = [];
  for (const line of out.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      elapsed: parseEtimeSeconds(match[2]),
      command: match[3],
    });
  }
  return rows;
}

export function findSiteDevPids(siteDir, _ports) {
  const found = new Map();
  for (const row of listProcessTable(siteDir)) {
    const info = {
      pid: row.pid,
      command: row.command,
      cwd: "",
      haystack: row.command,
      elapsed: row.elapsed,
    };
    if (isSuhuellaSiteDev(info, siteDir)) found.set(row.pid, info);
  }
  return [...found.keys()];
}

export function findSiteWorkerdPids(siteDir) {
  const found = new Map();
  for (const row of listProcessTable(siteDir)) {
    const info = {
      pid: row.pid,
      command: row.command,
      cwd: "",
      haystack: row.command,
      elapsed: row.elapsed,
    };
    if (isSuhuellaWorkerd(info, siteDir)) found.set(row.pid, info);
  }
  return [...found.keys()];
}

function waitUntilDead(pids, graceMs) {
  const deadline = Date.now() + graceMs;
  let alive = [...pids];
  while (alive.length && Date.now() < deadline) {
    alive = alive.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    if (!alive.length) break;
    spawnSync("sleep", ["0.2"]);
  }
  return alive;
}

/** Next 16 may exit the watched CLI and leave a replacement server, or exit 3/77 to ask for a respawn. */
export const NEXT_RESTART_EXIT_CODES = new Set([3, 77]);

export function resolveNextDistDir({
  siteDir,
  env = process.env,
} = {}) {
  if (env.SUHUELLA_NEXT_DIST) return path.resolve(String(env.SUHUELLA_NEXT_DIST));
  // Turbopack panics if distDir leaves the project path. Keep .next in-tree.
  return path.join(siteDir, ".next");
}

/** Next joins distDir onto the project directory, so absolute paths nest under site/. */
export function toNextConfigDistDir(siteDir, distDir) {
  if (!distDir) return null;
  return path.isAbsolute(distDir) ? path.relative(siteDir, distDir) : distDir;
}

export function nextLockPaths(distDir) {
  return [path.join(distDir, "dev", "lock"), path.join(distDir, "dev", "lock.json")];
}

export function decideDevChildExit({
  code = 0,
  signal = null,
  remainingSitePids = [],
} = {}) {
  if (signal) return { action: "exit", reason: "signal" };
  if (remainingSitePids.length) return { action: "adopt", reason: "next-restarted" };
  if (NEXT_RESTART_EXIT_CODES.has(code)) return { action: "respawn", reason: "next-restart-exit" };
  return { action: "exit", reason: "child-exit" };
}

export function stopSiteDevProcesses(siteDir, ports, { excludePids = [], graceMs = DEV_STOP_GRACE_MS } = {}) {
  const exclude = new Set(excludePids.map(Number));
  exclude.add(process.pid);
  const pids = [...new Set([...findSiteDevPids(siteDir, ports), ...findSiteWorkerdPids(siteDir)])].filter(
    (pid) => !exclude.has(pid),
  );
  if (!pids.length) return 0;

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already exited
    }
  }

  const remaining = waitUntilDead(pids, graceMs);
  for (const pid of remaining) {
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGKILL");
    } catch {
      // already exited
    }
  }

  return pids.length;
}
