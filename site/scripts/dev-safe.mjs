import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSiteDevPids, pidsOnPort, processInfo, stopSiteDevProcesses } from "./dev-process.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const ports = [port, port + 1];
const force = process.argv.includes("--force");

function readLockPid() {
  for (const lockPath of [
    path.join(siteDir, ".next", "dev", "lock"),
    path.join(siteDir, ".next", "dev", "lock.json"),
  ]) {
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
  for (const lockPath of [
    path.join(siteDir, ".next", "dev", "lock"),
    path.join(siteDir, ".next", "dev", "lock.json"),
  ]) {
    if (existsSync(lockPath)) rmSync(lockPath, { force: true });
  }
}

async function isHealthy(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    // Any HTTP response means the dev server is alive (even 404/500 while compiling).
    return response.status > 0;
  } catch {
    return false;
  }
}

function projectBrandAssets() {
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

if (!force && siteDevPids.length && (await isHealthy(`${url}/home`))) {
  console.log(`[dev] SuHuella web already running at ${url}`);
  console.log("[dev] use npm run dev:force to restart, or npm run dev:stop");
  process.exit(0);
}

const foreignOnPort = pidsOnPort(port, siteDir).filter((pid) => !siteDevPids.includes(pid));
if (foreignOnPort.length && !siteDevPids.length) {
  console.error(`[dev] port ${port} is used by another app — set PORT or free the port`);
  for (const pid of foreignOnPort) {
    console.error(`[dev] blocked by pid ${pid}: ${processInfo(pid, siteDir).command}`);
  }
  process.exit(1);
}

if (siteDevPids.length || lockPid) {
  console.log("[dev] resetting stale or duplicate dev server");
  stopSiteDevProcesses(siteDir, ports);
  removeStaleLocks();
}

projectBrandAssets();

const child = spawn("npx", ["next", "dev", "-p", String(port)], {
  cwd: siteDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
