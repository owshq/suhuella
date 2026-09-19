/**
 * Sources card: whole card opens browse, name customizes appearance,
 * opened source persists, blocked picker shows branded dialog.
 * Demo persist/remove is localhost-only. Production must not show Developer Sources.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";
const local = ["localhost", "127.0.0.1"].includes(new URL(BASE).hostname);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().waitFor({ timeout: 20000 });

  const loadDemo = page.getByRole("button", { name: /Load demo data|Reload demo data/ });
  const hasDemo = (await loadDemo.count()) > 0;
  if (local && !hasDemo) {
    throw new Error("localhost must show Load demo data");
  }
  if (!local && hasDemo) {
    throw new Error("production must not show Developer Sources demo");
  }

  if (hasDemo) {
    await loadDemo.click();
    await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 8000 });

    const card = page.locator("article").filter({ hasText: "dev-data" }).first();
    await card.waitFor({ timeout: 6000 });
    await card.locator("div.aspect-square").first().click();
    await page.getByRole("heading", { name: "dev-data" }).waitFor({ timeout: 4000 });
    if (await page.getByText("Indexed", { exact: true }).count()) {
      throw new Error("Icon click stayed on the Sources catalog instead of opening the source");
    }

    const stored = await page.evaluate(() => sessionStorage.getItem("suhuella-opened-source"));
    if (!stored || !stored.includes("dev-data")) {
      throw new Error("Opened source was not persisted");
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "dev-data" }).waitFor({ timeout: 8000 });

    await page.getByRole("button", { name: "Back to Sources" }).click();
    await card.waitFor({ timeout: 4000 });
    await card.getByText("dev-data", { exact: true }).click();
    await page.getByRole("heading", { name: "dev-data" }).waitFor({ timeout: 4000 });
    if (await page.getByText("Indexed", { exact: true }).count()) {
      throw new Error("Name click stayed on the Sources catalog instead of opening the source");
    }

    await page.getByRole("button", { name: "Back to Sources" }).click();
    await card.waitFor({ timeout: 4000 });
  }

  const connect = page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first();
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      const error = new Error("Can't open this folder because it contains system files");
      error.name = "SecurityError";
      throw error;
    };
  });
  await connect.click();
  const dialog = page.getByRole("dialog");
  if (await dialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    const connectParagraphs = dialog.locator("p");
    const connectCount = await connectParagraphs.count();
    if (connectCount >= 2) {
      const body = await connectParagraphs.nth(0).innerText();
      const note = await connectParagraphs.nth(1).innerText();
      if (!/download the desktop app|descarga la app/i.test(body)) {
        throw new Error("Connect body must include the desktop download sentence");
      }
      if (!/system folder|carpeta del sistema/i.test(note)) {
        throw new Error("Connect note must mention system folders");
      }
    }
    await page.getByRole("button", { name: /Choose folder|Choose another folder|Elegir/ }).click();
  }
  await page.getByRole("heading", { name: /not available in this browser|no está disponible/i }).waitFor({
    timeout: 4000,
  });

  if (hasDemo) {
    await page.getByRole("button", { name: /Close|Cerrar|OK|Cancel|Cancelar/ }).first().click().catch(() => {});
    await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const indexed = page.locator("article").filter({ hasText: "dev-data" }).first();
    await indexed.waitFor({ timeout: 6000 });
    await indexed.getByRole("button", { name: "Remove" }).click();
    await page.waitForTimeout(1600);
    if (await page.getByText("dev-data", { exact: true }).count()) {
      throw new Error("Removed source came back after index refresh");
    }
  }

  await browser.close();
  console.log("Sources card / persist / blocked-folder playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
