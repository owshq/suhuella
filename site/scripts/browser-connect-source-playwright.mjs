/**
 * Playwright seam: mock showDirectoryPicker, then assert Sources paints a card
 * before a slow scan would finish.
 */
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());

  await page.addInitScript(() => {
    const slowEntries = async function* slowEntries() {
      await new Promise((resolve) => setTimeout(resolve, 8000));
    };
    const fakeHandle = {
      name: "Documents",
      kind: "directory",
      entries: slowEntries,
      values: slowEntries,
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
  const dialogVisible = await dialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
  if (dialogVisible) {
    await page.getByRole("button", { name: /Choose folder|Elegir carpeta/ }).click();
  }

  const appeared = await page
    .getByText(/Updating|Indexing|Learning|Indexed/i)
    .first()
    .waitFor({ timeout: 4000 })
    .then(() => true)
    .catch(() => false);

  const named = await page.getByText("Documents", { exact: true }).count();
  const zeroSources = await page.getByText("0 sources").count();

  if (!appeared) {
    throw new Error("Source card did not appear before mocked scan completed");
  }
  if (named === 0) {
    throw new Error("Connected folder name is not visible");
  }
  if (zeroSources > 0) {
    throw new Error("Sources count stayed at 0 after folder was accepted");
  }

  const indexPage = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
  await indexPage.addInitScript(() => {
    const file = {
      name: "invoice.pdf",
      kind: "file",
      getFile: async () => ({ size: 120, lastModified: Date.now() }),
    };
    const fakeHandle = {
      name: "ClientDocs",
      kind: "directory",
      async *entries() {
        yield ["invoice.pdf", file];
      },
      async *values() {
        yield file;
      },
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    window.showDirectoryPicker = async () => fakeHandle;
  });
  await indexPage.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await indexPage.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().waitFor({ timeout: 20000 });
  await indexPage.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().click();
  const indexDialog = indexPage.getByRole("dialog");
  if (await indexDialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
    await indexPage.getByRole("button", { name: /Choose folder|Elegir carpeta/ }).click();
  }
  await indexPage.getByText("ClientDocs", { exact: true }).first().waitFor({ timeout: 6000 });
  await indexPage.getByText(/1 document/).first().waitFor({ timeout: 6000 });
  await indexPage.locator("article").filter({ hasText: "ClientDocs" }).getByRole("button", { name: "Remove" }).click();
  await indexPage.waitForTimeout(1600);
  if (await indexPage.getByText("ClientDocs", { exact: true }).count()) {
    throw new Error("Indexed source came back after Remove");
  }

  await browser.close();
  console.log("BROWSER-CONNECT-SOURCE-001 playwright seam passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
