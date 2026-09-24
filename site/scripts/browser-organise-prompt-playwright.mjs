/**
 * Plan Mode: prompt-first composer → PlanEditor → save → reload → Run restores preview.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";
const host = new URL(BASE).hostname;
const local = host === "localhost" || host === "127.0.0.1";

async function main() {
  if (!local) {
    console.log("BROWSER-ORGANISE-PROMPT-001 playwright skipped — not localhost");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } }).then((c) =>
    c.newPage(),
  );

  await page.goto(`${BASE}/sources`, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.getByText("Developer Sources", { exact: true }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Load demo data|Reload demo data/ }).click();
  await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 8000 });

  await page.goto(`${BASE}/plan-mode`, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(800);

  const deadEnd = await page.getByText("This browser cannot choose documents.").count();
  if (deadEnd > 0) {
    throw new Error("Plan Mode still shows the dead-end banner");
  }

  await page.getByPlaceholder(/What should happen/i).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Prepare Plan", exact: true }).waitFor({ timeout: 10000 });

  await page.getByRole("button", { name: "Prepare Plan: Group by category" }).click();
  await page.getByRole("button", { name: "Prepare Plan", exact: true }).click();

  const scopeUnresolved = await page.getByText("Nothing matched in the sources SuHuella can see.").count();
  if (scopeUnresolved > 0) {
    throw new Error("Prompt example did not resolve scope with demo data loaded");
  }

  await page.getByRole("button", { name: "Save plan" }).waitFor({ timeout: 12000 });

  const planTitle = "Move invoices in dev-data into category folders";
  await page.getByRole("button", { name: "Save plan" }).click();
  await page.getByText("Plan saved on this device.", { exact: true }).waitFor({ timeout: 8000 });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  await page.getByText("Saved plans", { exact: true }).waitFor({ timeout: 6000 });
  const savedRow = page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Run" }) })
    .filter({ hasText: planTitle })
    .first();
  await savedRow.waitFor({ timeout: 6000 });
  await savedRow.getByRole("button", { name: "Run" }).click();
  await page.getByRole("button", { name: "Save plan" }).waitFor({ timeout: 8000 });

  const composerOnly = await page.getByPlaceholder("What should happen?").isVisible().catch(() => false);
  const editorVisible = await page.getByRole("button", { name: "Save plan" }).isVisible().catch(() => false);
  if (composerOnly && !editorVisible) {
    throw new Error("Run on a saved Plan did not restore PlanEditor");
  }

  await browser.close();
  console.log("BROWSER-ORGANISE-PROMPT-001 playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
