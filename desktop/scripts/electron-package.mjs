import { spawn } from "node:child_process";
import { writeElectronBuilderConfig } from "./brand-build.mjs";

const target = process.argv.includes("--win") ? "--win" : "--mac";
const config = await writeElectronBuilderConfig();

const child = spawn("npx", ["electron-builder", target, "--config", config], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
