/**
 * BROWSER-ADAPTER-WIRING-001 — automated smoke for manual checklist (Chrome path).
 * Covers: Connect · Index · Search · Remove.
 * Refresh/Restore (Chrome site settings) remains operator-only.
 */
import { chromium } from 'playwright';

const BASE = process.env.BROWSER_CONNECT_URL ?? 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser
    .newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' })
    .then((c) => c.newPage());

  await page.addInitScript(() => {
    const file = (name) => ({
      kind: 'file',
      name,
      getFile: async () => new File(['wiring-smoke'], name, { type: 'application/pdf' }),
    });
    const fakeHandle = {
      name: 'ClientDocs',
      kind: 'directory',
      async *entries() {
        yield ['invoice-jan.pdf', file('invoice-jan.pdf')];
      },
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    };
    window.showDirectoryPicker = async () => fakeHandle;
  });

  await page.goto(`${BASE}/sources`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: /Connect folder|Conectar carpeta/ }).first().click();
  await page.getByText('ClientDocs', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByText(/1 document/).first().waitFor({ timeout: 15000 });

  await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/Search|Buscar/).fill('invoice');
  await page.getByText('invoice-jan.pdf').first().waitFor({ timeout: 15000 });

  await page.goto(`${BASE}/sources`, { waitUntil: 'domcontentloaded' });
  await page.locator('article').filter({ hasText: 'ClientDocs' }).getByRole('button', { name: 'Remove' }).click();
  await page.waitForTimeout(1200);
  if (await page.getByText('ClientDocs', { exact: true }).count()) {
    throw new Error('Source still visible after Remove');
  }

  await browser.close();
  console.log('BROWSER-ADAPTER-WIRING-001 playwright smoke passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
