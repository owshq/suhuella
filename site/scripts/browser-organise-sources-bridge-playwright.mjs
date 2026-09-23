/**
 * Sources browse → Plan Mode bridge: select file or folder scope, land on /plan-mode with draft.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } }).then((c) =>
    c.newPage(),
  );

  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
  const loadDemo = page.getByRole("button", { name: /Load demo data|Reload demo data/ });
  if (await loadDemo.count()) {
    await loadDemo.click();
    await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 8000 });
  }

  await page.locator("article").filter({ hasText: "dev-data" }).first().click();
  await page.getByRole("heading", { name: "dev-data" }).waitFor({ timeout: 6000 });

  const planInBrowse = await page.getByText(/Confirm Plan|Plan mode|Create plan/i).count();
  if (planInBrowse > 0) {
    throw new Error("Sources browse must not show Plan UI");
  }

  await page.getByRole("row", { name: /invoices/i }).click();
  await page.getByRole("heading", { name: "invoices" }).waitFor({ timeout: 6000 });

  await page.getByLabel(/Select factura-enero\.pdf/i).check();
  await page.getByRole("button", { name: "Plan these files" }).click();
  await page.waitForURL(/\/plan-mode/, { timeout: 8000 });

  const url = page.url();
  if (/factura|\.pdf|src_/i.test(url)) {
    throw new Error("Organise bridge leaked private paths in URL");
  }

  const draftReady = await page
    .getByText(/suggestion|accepted change|Analysing|What should SuHuella do/i)
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!draftReady) {
    throw new Error("Organise did not start a Plan draft after source browse bridge");
  }

  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.locator("article").filter({ hasText: "dev-data" }).first().click();
  await page.getByRole("heading", { name: "dev-data" }).waitFor({ timeout: 6000 });
  await page.getByRole("button", { name: "Plan this folder" }).click();
  await page.waitForURL(/\/plan-mode/, { timeout: 8000 });

  await browser.close();
  console.log("ORGANISE-SOURCES-BRIDGE-001 playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
