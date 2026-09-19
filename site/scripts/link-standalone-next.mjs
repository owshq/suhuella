import { existsSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const standalone = path.resolve(".next/standalone");
const monorepoNext = path.join(standalone, "site/.next");
const expectedNext = path.join(standalone, ".next");

if (!existsSync(monorepoNext)) {
  process.exit(0);
}

if (existsSync(expectedNext)) {
  rmSync(expectedNext, { recursive: true, force: true });
}

symlinkSync(path.relative(standalone, monorepoNext), expectedNext);
