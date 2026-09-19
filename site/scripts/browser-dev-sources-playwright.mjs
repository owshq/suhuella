/**
 * Localhost-only seam: Load demo data, then Search finds a filename.
 * Skips on production hosts — that UI must not exist there.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";
const host = new URL(BASE).hostname;
const local = host === "localhost" || host === "127.0.0.1";

async function main() {
  if (!local) {
    console.log("DEV-SOURCES playwright skipped — not localhost");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } }).then((c) =>
    c.newPage(),
  );
  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);

  const panel = page.getByText("Developer Sources", { exact: true });
  await panel.waitFor({ timeout: 4000 });
  await page.getByRole("button", { name: /Load demo data|Reload demo data/ }).click();
  await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 6000 });

  await page.goto(`${BASE}/search`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  await page.getByPlaceholder(/Search|Buscar/i).first().fill("factura");
  await page.getByText("factura-enero.pdf", { exact: true }).first().waitFor({ timeout: 6000 });

  await browser.close();
  console.log("DEV-SOURCES playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
