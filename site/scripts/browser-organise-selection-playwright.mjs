/**
 * Plan Mode: prompt-first empty state and Prepare Plan with demo scope.
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
  await page.getByText("Developer Sources", { exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Load demo data|Reload demo data/ }).click();
  await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 8000 });

  await page.goto(`${BASE}/plan-mode`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);

  const deadEnd = await page.getByText("This browser cannot choose documents.").count();
  if (deadEnd > 0) {
    throw new Error("Plan Mode still shows the dead-end banner");
  }

  await page.getByPlaceholder("What should happen?").waitFor({ timeout: 4000 });
  await page.getByRole("button", { name: "Prepare Plan" }).waitFor({ timeout: 2000 });
  await page.getByRole("button", { name: "Open Sources" }).waitFor({ timeout: 2000 });

  await page.getByRole("button", { name: "Move invoices in dev-data" }).click();
  await page.getByRole("button", { name: "Prepare Plan" }).click();

  const planReady = await page
    .getByRole("button", { name: "Save plan" })
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  if (!planReady) {
    throw new Error("Prepare Plan did not open PlanEditor with demo scope");
  }

  await browser.close();
  console.log("BROWSER-ORGANISE-SELECTION-001 playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
