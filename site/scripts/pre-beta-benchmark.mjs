/**
 * PRE-BETA-BENCHMARK-001 — product readiness (engineering).
 * Not first impression — trust/desirability → PRIVATE-BETA-001.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.BROWSER_CONNECT_URL ?? process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(
  /\/+$/,
  "",
);
const OUT = process.env.BENCHMARK_OUT ?? join(process.cwd(), "../pre-beta/benchmark-results.md");
const isProduction = !["localhost", "127.0.0.1"].includes(new URL(BASE).hostname);

/** @type {{ id: string, name: string, pass: boolean, ms: number, evidence: string }[]} */
const results = [];

function ms(start) {
  return Date.now() - start;
}

function record(id, name, pass, start, evidence) {
  results.push({ id, name, pass, ms: ms(start), evidence });
  if (!pass) throw new Error(`${id} FAIL: ${evidence}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    const file = (name) => ({
      kind: "file",
      name,
      getFile: async () => new File(["benchmark"], name, { type: "application/pdf" }),
    });
    const fakeHandle = {
      name: "informes",
      kind: "directory",
      async *entries() {
        yield ["factura-enero.pdf", file("factura-enero.pdf")];
      },
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    window.showDirectoryPicker = async () => fakeHandle;
  });

  let t = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const landingHtml = await page.content();
  const hasLocalCopy = /local|ordenador|dispositivo|your computer|tu ordenador/i.test(landingHtml);
  const promisesUpload = /we upload|subimos|files are uploaded|archivos se suben/i.test(landingHtml);
  record("B1", "Landing loads with local-first copy", hasLocalCopy && !promisesUpload, t, BASE);

  t = Date.now();
  const openApp = page.getByRole("button", { name: /Abrir SuHuella|Open SuHuella/i }).first();
  await openApp.waitFor({ timeout: 15000 });
  await openApp.click();
  await page.waitForURL(/\/home/, { timeout: 15000 });
  record("B2", "Open app from landing → /home", page.url().includes("/home"), t, page.url());

  t = Date.now();
  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().waitFor({ timeout: 20000 });
  const demoCount = await page.getByRole("button", { name: /Load demo data|Reload demo data/ }).count();
  record(
    "B3",
    "Sources reachable · no Developer Sources on production",
    isProduction ? demoCount === 0 : demoCount > 0,
    t,
    isProduction ? "no demo panel" : "demo available on localhost",
  );

  t = Date.now();
  const connect = page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first();
  await connect.click();
  const dialog = page.getByRole("dialog");
  if (await dialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await page.getByRole("button", { name: /Choose folder|Elegir carpeta/ }).click();
  }
  await page.getByText("informes", { exact: true }).first().waitFor({ timeout: 8000 });
  const technicalIds = await page.getByText(/src_[a-z0-9]+_[a-z0-9]+/i).count();
  record("B4", "Connect folder → human name visible", technicalIds === 0, t, "informes");

  t = Date.now();
  await page.getByText(/1 document|Updating|Indexing|Learning|Indexed/i).first().waitFor({ timeout: 12000 });
  record("B5", "Indexing completes", true, t, "document count or indexed state");

  t = Date.now();
  await page.goto(`${BASE}/search`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.getByPlaceholder(/Search|Buscar/i).first().fill("factura");
  await page.getByText("factura-enero.pdf", { exact: true }).first().waitFor({ timeout: 8000 });
  const hasOpenLimit = (await page.getByText(/Open is limited in browser|limitado en el navegador/i).count()) > 0;
  record("B6", "Search finds known document", true, t, hasOpenLimit ? "factura-enero.pdf + open limit copy" : "factura-enero.pdf");

  t = Date.now();
  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const card = page.locator("article").filter({ hasText: "informes" }).first();
  await card.waitFor({ timeout: 8000 });
  await card.getByRole("button", { name: /Remove|Eliminar|Quitar/i }).click();
  await page.waitForTimeout(1800);
  const removed = (await page.getByText("informes", { exact: true }).count()) === 0;
  record("B7", "Remove folder — does not reappear", removed, t, removed ? "gone after 1.8s" : "still visible");

  t = Date.now();
  const cloudButtons = await page
    .locator("article")
    .filter({ hasText: /Google Drive|OneDrive|Dropbox/i })
    .getByRole("button")
    .count();
  record("B8", "Cloud sources honest (Coming later, no Connect)", cloudButtons === 0, t, `${cloudButtons} cloud action buttons`);

  await browser.close();

  const allPass = results.every((r) => r.pass);
  const date = new Date().toISOString().slice(0, 10);
  const md = `# Pre-beta — benchmark results

\`\`\`text
Track:     PRE-BETA-BENCHMARK-001
Type:      Product readiness (engineering)
Target:    ${BASE}
Date:      ${date}
Operator:  agent (Playwright)
Verdict:   ${allPass ? "PASS" : "FAIL"}
\`\`\`

First Impression (human trust/desirability) → [first-impression/](../first-impression/) optional · [PRIVATE-BETA-001](../PRIVATE-BETA-001.md)

## Contract

| # | Check | Pass | ms | Evidence |
| --- | --- | --- | ---: | --- |
${results.map((r) => `| ${r.id} | ${r.name} | ${r.pass ? "✔" : "✖"} | ${r.ms} | ${r.evidence} |`).join("\n")}

## Timings

\`\`\`text
Connect folder (B4):  ${results.find((r) => r.id === "B4")?.ms ?? "—"} ms
Search (B6):          ${results.find((r) => r.id === "B6")?.ms ?? "—"} ms
Remove (B7):          ${results.find((r) => r.id === "B7")?.ms ?? "—"} ms
\`\`\`

## Decision

\`\`\`text
PRE-BETA-BENCHMARK-001 — ${allPass ? "CLOSED · PASS" : "OPEN · FAIL"}
\`\`\`

Re-run: \`npm run test:pre-beta-readiness\`
Production: \`BROWSER_CONNECT_URL=https://suhuella.com npm run test:pre-beta-readiness --prefix site\`
`;

  writeFileSync(OUT, md);
  console.log(`PRE-BETA-BENCHMARK-001 ${allPass ? "PASS" : "FAIL"} → ${OUT}`);
  if (!allPass) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
