import { existsSync, rmSync } from "node:fs";
import path from "node:path";

function stripSharp(modulesDir) {
  for (const pkg of ["sharp", "@img"]) {
    const target = path.join(modulesDir, pkg);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
      console.log(`stripped ${target}`);
    }
  }
}

stripSharp(path.resolve(".next/standalone/site/node_modules"));
stripSharp(path.resolve("node_modules"));
