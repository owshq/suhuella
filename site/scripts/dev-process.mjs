import { spawnSync } from "node:child_process";
import path from "node:path";

export function run(command, cwd) {
  const result = spawnSync(command, {
    shell: true,
    cwd,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function siteMarker(siteDir) {
  return `${path.sep}suhuella${path.sep}site`;
}

export function pidsOnPort(port, cwd) {
  const out = run(`lsof -ti tcp:${port} -sTCP:LISTEN`, cwd);
  return out ? out.split("\n").filter(Boolean).map((value) => Number(value)) : [];
}

export function processInfo(pid, cwd) {
  const command = run(`ps -p ${pid} -o command= 2>/dev/null`, cwd);
  const cwdPath = run(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null | grep '^n/' | head -1`, cwd).replace(
    /^n\//,
    "",
  );
  return { pid, command, cwd: cwdPath };
}

export function isSuhuellaSiteDev(info, siteDir) {
  const marker = siteMarker(siteDir);
  const haystack = `${info.command} ${info.cwd}`;
  if (!haystack.includes(marker) && !haystack.includes("suhuella/site")) return false;
  return /(next-server|next dev|node_modules\/\.bin\/next|npm exec next dev)/.test(haystack);
}

export function findSiteDevPids(siteDir, ports) {
  const found = new Map();
  for (const port of ports) {
    for (const pid of pidsOnPort(port, siteDir)) {
      const info = processInfo(pid, siteDir);
      if (isSuhuellaSiteDev(info, siteDir)) found.set(pid, info);
    }
  }

  const pattern = run(`pgrep -f "${siteDir.replace(/"/g, '\\"')}/node_modules/.bin/next"`, siteDir);
  for (const pidText of pattern.split("\n").filter(Boolean)) {
    const pid = Number(pidText);
    if (!Number.isFinite(pid)) continue;
    const info = processInfo(pid, siteDir);
    if (isSuhuellaSiteDev(info, siteDir)) found.set(pid, info);
  }

  return [...found.keys()];
}

export function stopSiteDevProcesses(siteDir, ports) {
  const pids = findSiteDevPids(siteDir, ports);
  if (!pids.length) return 0;

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already exited
    }
  }

  run("sleep 0.5", siteDir);

  let forceKilled = 0;
  for (const pid of pids) {
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGKILL");
      forceKilled += 1;
    } catch {
      // already exited
    }
  }

  return forceKilled || pids.length;
}
