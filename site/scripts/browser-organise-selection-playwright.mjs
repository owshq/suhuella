/**
 * Organise: no dead-end banner, select from demo source, create a Plan draft.
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

  await page.goto(`${BASE}/organise`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);

  const deadEnd = await page.getByText("This browser cannot choose documents.").count();
  if (deadEnd > 0) {
    throw new Error("Organise still shows the dead-end banner");
  }

  await page.getByRole("button", { name: "Select from Sources" }).waitFor({ timeout: 4000 });
  await page.getByRole("button", { name: "Choose files" }).waitFor({ timeout: 2000 });
  await page.getByRole("button", { name: "Choose folder" }).waitFor({ timeout: 2000 });

  await page.getByRole("button", { name: /dev-data/ }).first().click();
  await page.getByText("factura-enero.pdf", { exact: true }).waitFor({ timeout: 6000 });
  await page.getByText("factura-enero.pdf", { exact: true }).click();
  await page.getByRole("button", { name: "Add to Plan" }).click();

  const planReady = await page
    .getByText(/suggestion|accepted change|Analysing|What should SuHuella do/i)
    .first()
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!planReady) {
    throw new Error("Selecting a source document did not create a Plan draft");
  }

  await browser.close();
  console.log("BROWSER-ORGANISE-SELECTION-001 playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
