import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_HEALTH_PATH,
  DEV_HEALTH_TIMEOUT_MS,
  decideDevChildExit,
  decideDevStart,
  findSiteDevPids,
  isRecentDevProcess,
  nextDevArgs,
  nextLockPaths,
  pidsOnPort,
  processInfo,
  resolveDevListenHost,
  resolveNextDistDir,
  stopSiteDevProcesses,
} from "./dev-process.mjs";
import { applyLocalDevDefaults, loadDevVars } from "./load-dev-vars.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const ports = [port, port + 1];
const force = process.argv.includes("--force");
const webpack = process.argv.includes("--webpack") || !process.argv.includes("--turbopack");
const cloudflare =
  process.argv.includes("--cloudflare") || process.env.SUHUELLA_DEV_OPENNEXT === "1";

process.env.SUHUELLA_DEV_OPENNEXT = cloudflare ? "1" : "0";

const nextDistDir = resolveNextDistDir({ siteDir });
process.env.SUHUELLA_NEXT_DIST = nextDistDir;
mkdirSync(nextDistDir, { recursive: true });

function readLockPid() {
  for (const lockPath of nextLockPaths(nextDistDir)) {
    if (!existsSync(lockPath)) continue;
    try {
      const raw = readFileSync(lockPath, "utf8").trim();
      const json = raw.startsWith("{") ? JSON.parse(raw) : null;
      const pid = json?.pid ?? Number(raw.split(/\s+/)[0]);
      if (Number.isFinite(pid) && pid > 0) return pid;
    } catch {
      // stale or unreadable lock
    }
  }
  return null;
}

function removeStaleLocks() {
  for (const lockPath of nextLockPaths(nextDistDir)) {
    if (existsSync(lockPath)) rmSync(lockPath, { force: true });
  }
}

async function isHealthy(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEV_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function projectBrandAssets() {
  // Single projection path for `npm run dev` — do not add a package.json predev hook.
  for (const script of ["../brands/project-brand.mjs", "../brands/project-site.mjs"]) {
    const result = spawnSync("node", [script], {
      cwd: siteDir,
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

const url = `http://localhost:${port}`;
const siteDevPids = findSiteDevPids(siteDir, ports);
const lockPid = readLockPid();
const healthy = siteDevPids.length ? await isHealthy(`${url}${DEV_HEALTH_PATH}`) : false;
const recent = siteDevPids.length ? isRecentDevProcess(siteDevPids, siteDir) : false;
const foreignOnPort = pidsOnPort(port, siteDir).filter((pid) => !siteDevPids.includes(pid));
const decision = decideDevStart({
  force,
  siteDevPids,
  lockPid,
  healthy,
  recent,
  foreignOnPort,
});

if (decision.action === "blocked") {
  console.error(`[dev] port ${port} is used by another app — set PORT or free the port`);
  for (const pid of foreignOnPort) {
    console.error(`[dev] blocked by pid ${pid}: ${processInfo(pid, siteDir).command}`);
  }
  process.exit(1);
}

if (decision.action === "reuse") {
  console.log(`[dev] SuHuella web already running at ${url}`);
  console.log("[dev] use npm run dev:force to restart, or npm run dev:stop");
  process.exit(0);
}

if (decision.action === "reset") {
  console.log("[dev] resetting stale or duplicate SuHuella dev server");
  stopSiteDevProcesses(siteDir, ports);
  removeStaleLocks();
} else if (decision.reason === "stale-lock") {
  removeStaleLocks();
}

projectBrandAssets();

const loadedDevVars = loadDevVars(siteDir);
applyLocalDevDefaults();
if (loadedDevVars) {
  console.log("[dev] loaded site/.dev.vars");
}

if (cloudflare) {
  console.log("[dev] Cloudflare/OpenNext mode — license, OTP, and D1");
} else {
  console.log("[dev] UI mode — uses wrangler local D1 when provisioned (npm run dev:cf for full OpenNext)");
}
console.log("[dev] Partner portal: http://localhost:" + port + "/partners/portal (OTP prints here)");
console.log("[dev] Partner fixture email: info.linkeram@gmail.com · provision: npm run provision:dbasenet-gift:local-dev");
console.log("[dev] Restart dev after provisioning so D1 store is picked up · local DNS sim ON (Refresh activates without Cloudflare)");
console.log(`[dev] Brand test hostname: add "127.0.0.1 app.dbasenet.test" to /etc/hosts → http://app.dbasenet.test:${port}`);

const nextBin = path.join(siteDir, "node_modules", ".bin", "next");

function waitForPid(pid) {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      try {
        process.kill(pid, 0);
      } catch {
        clearInterval(timer);
        resolve();
      }
    }, 1_000);
  });
}

function remainingSitePids(excludePid) {
  return findSiteDevPids(siteDir, ports).filter((pid) => pid !== excludePid);
}

async function superviseNext() {
  let child = null;
  let launchedPid = null;

  const start = () => {
    if (nextDistDir !== path.join(siteDir, ".next")) {
      console.log(`[dev] Next cache → ${nextDistDir}`);
    }
    const listen = resolveDevListenHost({ env: process.env, argv: process.argv });
    if (listen.reason === "loopback") {
      console.log(`[dev] binding to ${listen.host} — skip LAN host discovery`);
    }
    child = spawn(nextBin, nextDevArgs({ port, host: listen.host, webpack }), {
      cwd: siteDir,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_PATH: [path.join(siteDir, "node_modules"), process.env.NODE_PATH]
          .filter(Boolean)
          .join(path.delimiter),
      },
    });
    launchedPid = child.pid;
    return new Promise((resolve) => {
      child.on("exit", (code, signal) => resolve({ code, signal }));
    });
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      const pids = [launchedPid, ...remainingSitePids(launchedPid)];
      for (const pid of pids) {
        if (!pid) continue;
        try {
          process.kill(pid, signal);
        } catch {
          // already exited
        }
      }
    });
  }

  process.on("exit", () => {
    if (launchedPid) {
      try {
        process.kill(launchedPid, "SIGTERM");
      } catch {
        // already exited
      }
    }
  });

  for (;;) {
    const { code, signal } = await start();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const remaining = remainingSitePids(launchedPid);
    const decision = decideDevChildExit({ code, signal, remainingSitePids: remaining });
    if (decision.action === "adopt") {
      console.log("[dev] Next replaced itself after a config reload — keeping the wrapper alive");
      await Promise.all(remaining.map((pid) => waitForPid(pid)));
      process.exit(0);
    }
    if (decision.action === "respawn") {
      console.log("[dev] Next asked to restart — respawning");
      continue;
    }
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  }
}

await superviseNext();
