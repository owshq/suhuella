/**
 * Playwright seam: mock a work folder named informes, then assert Search
 * finds a filename substring. Native picker cannot be automated.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } }).then((c) =>
    c.newPage(),
  );

  await page.addInitScript(() => {
    const file = (name) => ({
      kind: "file",
      name,
      getFile: async () => new File(["x"], name),
    });
    const fakeHandle = {
      name: "informes",
      kind: "directory",
      async *entries() {
        yield ["factura-enero.pdf", file("factura-enero.pdf")];
        yield ["contrato-cliente.docx", file("contrato-cliente.docx")];
        yield ["captura-yala.png", file("captura-yala.png")];
      },
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    window.showDirectoryPicker = async () => fakeHandle;
  });

  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().waitFor({ timeout: 20000 });

  const connect = page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first();
  await connect.click();
  const dialog = page.getByRole("dialog");
  if (await dialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await page.getByRole("button", { name: /Choose folder|Elegir carpeta/ }).click();
  }

  await page.getByText("informes", { exact: true }).first().waitFor({ timeout: 6000 });
  const technical = await page.getByText(/src_[a-z0-9]+_[a-z0-9]+/i).count();
  if (technical > 0) {
    await browser.close();
    throw new Error("Technical source id is visible after connect");
  }

  await page.goto(`${BASE}/search`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  const search = page.getByPlaceholder(/Search|Buscar/i).first();
  await search.fill("factura");
  await page.getByText("factura-enero.pdf", { exact: true }).first().waitFor({ timeout: 6000 });
  const limited = await page.getByText(/Open is limited in browser/i).count();
  const sourceLabel = await page.getByText("informes", { exact: true }).count();

  await browser.close();

  if (limited === 0) {
    throw new Error("Browser search result did not explain open limitation");
  }
  if (sourceLabel === 0) {
    throw new Error("Search result did not show the folder displayName");
  }
  console.log("BROWSER-SOURCES-BRAND-FLOW-001 playwright search seam passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
