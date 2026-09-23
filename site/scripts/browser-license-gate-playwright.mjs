/**
 * LICENSE-VERSION-FINAL-E2E-007 — real Chromium gate (Playwright).
 */
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(scriptDir, "..");
const repoRoot = join(siteRoot, "..");
const outDir = join(siteRoot, ".data/browser-license-gate");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  execSync(
    "node --experimental-strip-types --import ../brands/node-register.mjs --disable-warning=ExperimentalWarning lib/browser-license-gate-playwright-prep.ts",
    { cwd: siteRoot, stdio: "pipe" },
  );

  const fixture = JSON.parse(readFileSync(join(outDir, "fixture.json"), "utf8"));
  mkdirSync(outDir, { recursive: true });

  const bundlePath = join(outDir, "gate-bundle.js");
  execSync(
    [
      "npx esbuild",
      join(siteRoot, "lib/browser-license-gate-browser-entry.ts"),
      "--bundle",
      "--platform=browser",
      "--format=iife",
      "--global-name=LicenseGateRuntime",
      `--outfile=${bundlePath}`,
      `--alias:@suhuella/product=${join(repoRoot, "packages/product/src")}`,
      "--log-level=error",
    ].join(" "),
    { cwd: siteRoot, stdio: "pipe" },
  );

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>license gate</title></head>
<body>
<script>${readFileSync(bundlePath, "utf8")}</script>
<script>
  window.__gateResults = window.runBrowserLicenseGateCases(${JSON.stringify(fixture.cases)});
</script>
</body></html>`;
  const htmlPath = join(outDir, "index.html");
  writeFileSync(htmlPath, html, "utf8");

  const server = createServer((request, response) => {
    if (request.url === "/" || request.url === "/index.html") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 15000 });
  const results = await page.evaluate(() => window.__gateResults);
  await browser.close();
  server.close();

  assert(Array.isArray(results) && results.length === fixture.cases.length, "gate cases executed in Chromium");
  for (const row of results) {
    assert(row.pass, `browser gate case failed: ${row.id} (actualOk=${row.actualOk}, code=${row.code ?? "none"})`);
  }

  console.log("browser-license-gate-playwright: PASS (Chromium runtime)");
  console.log(JSON.stringify({ platform: "C", results }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
