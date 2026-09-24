/**
 * Plan Mode UI — indexed dev-data, Confirm Plan, Undo (localhost VFS + signed gift license).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(scriptDir, "..");
const repoRoot = join(siteRoot, "..");
const buildDir = join(repoRoot, "desktop/.build/suhuella");
const BASE = process.env.BROWSER_CONNECT_URL ?? "http://127.0.0.1:3000";
const host = new URL(BASE).hostname;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function injectFixture(page, fixture) {
  await page.evaluate(async ({ license, permissions }) => {
    const openDb = () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("suhuella-web", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const name of ["meta", "sources", "folders", "files", "activity", "workflows", "plans", "handles"]) {
            if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
          }
        };
      });
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(license, "license");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem("suhuella-permissions", JSON.stringify(permissions));
  }, fixture);
}

async function installPlanMoveHook(page) {
  await page.evaluate(() => {
    const api = window.suhuella;
    const original = api.previewOrganisationPlan.bind(api);
    api.previewOrganisationPlan = async (knowledgeSet) => {
      const preview = await original(knowledgeSet);
      if (!preview.ok) return preview;
      const hasExecutable = preview.preview.items.some(
        (item) =>
          item.selected !== false &&
          (item.action === "move" || item.action === "rename") &&
          item.proposedPath,
      );
      if (hasExecutable) return preview;
      const invoice = preview.preview.items.find((item) => /factura-enero\.pdf/i.test(item.fileName ?? ""));
      if (!invoice?.currentPath) return preview;
      preview.preview.items = preview.preview.items.map((item) => {
        if (item.currentPath !== invoice.currentPath) return item;
        const proposedPath = item.currentPath.replace(
          /invoices\/factura-enero\.pdf$/,
          "finance/invoices/factura-enero.pdf",
        );
        return {
          ...item,
          action: "move",
          proposedPath,
          selected: true,
          status: "preview",
          skipReason: null,
          explanation: "Playwright smoke — move invoice into finance folder",
        };
      });
      return preview;
    };
  });
}

async function acceptReadyItems(page) {
  const accepts = page.getByRole("button", { name: "Accept" });
  const count = await accepts.count();
  for (let index = 0; index < count; index += 1) {
    const button = accepts.nth(index);
    if (await button.isVisible()) await button.click();
  }
}

async function main() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    throw new Error(`Refusing non-local target ${BASE}`);
  }

  execSync(
    "node --experimental-strip-types --import ../brands/node-register.mjs --disable-warning=ExperimentalWarning lib/plan-mode-confirm-undo-playwright-prep.ts",
    { cwd: siteRoot, stdio: "inherit", env: process.env },
  );
  const fixture = JSON.parse(
    readFileSync(join(siteRoot, ".data/plan-mode-confirm-undo/fixture.json"), "utf8"),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/sources`, { waitUntil: "load", timeout: 180000 });
  await page.locator('[data-suhuella-app]:not([data-suhuella-boot])').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => Boolean(window.suhuella?.addIndexedLocation), null, {
    timeout: 120000,
  });
  await injectFixture(page, fixture);

  await page.getByText("Developer Sources", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Load demo data|Reload demo data/ }).click();
  await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 10000 });

  await page.goto(`${BASE}/plan-mode`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.suhuella?.executeOrganisationPlan), null, {
    timeout: 120000,
  });
  await page.getByPlaceholder(/What should happen/i).waitFor({ timeout: 20000 });
  await installPlanMoveHook(page);

  await page.getByRole("button", { name: "Prepare Plan: Group by category" }).click();
  await page.getByRole("button", { name: "Prepare Plan", exact: true }).click();
  await page.getByRole("button", { name: "Save plan" }).waitFor({ timeout: 15000 });

  await acceptReadyItems(page);

  await page.getByRole("button", { name: "Confirm Plan", exact: true }).first().click();
  const confirmAgain = page.getByRole("button", { name: "Confirm Plan", exact: true }).last();
  await confirmAgain.waitFor({ timeout: 10000 });
  await confirmAgain.click();

  await page.getByText("Undo available").waitFor({ timeout: 15000 });
  await page.getByText(/1 document moved|Confirmed 1 action/i).waitFor({ timeout: 15000 });

  const movedPath = await page.evaluate(async () => {
    const results = await window.suhuella.searchDocuments({ text: "factura-enero", filter: "all" });
    const hit = results.hits.find((entry) => /factura-enero\.pdf/i.test(entry.title ?? ""));
    const raw = hit?.path ?? "";
    if (raw.includes(":")) return raw.split(":").pop() ?? raw;
    return raw.replace(/^src_dev_demo\//, "");
  });
  assert(
    movedPath === "finance/invoices/factura-enero.pdf",
    `Confirm did not move invoice in dev-data VFS (observed ${movedPath ?? "missing"})`,
  );

  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText("Files were moved back").waitFor({ timeout: 15000 });

  const restoredPath = await page.evaluate(async () => {
    const results = await window.suhuella.searchDocuments({ text: "factura-enero", filter: "all" });
    const hit = results.hits.find((entry) => /factura-enero\.pdf/i.test(entry.title ?? ""));
    const raw = hit?.path ?? "";
    if (raw.includes(":")) return raw.split(":").pop() ?? raw;
    return raw.replace(/^src_dev_demo\//, "");
  });
  assert(
    restoredPath === "invoices/factura-enero.pdf",
    `Undo did not restore invoice path (observed ${restoredPath ?? "missing"})`,
  );

  const report = {
    updatedAt: new Date().toISOString(),
    journey: "plan-mode-ui-confirm-undo-dev-data",
    baseUrl: BASE,
    spkiFingerprint: fixture.fingerprint,
    steps: [
      { step: "load-dev-data", result: "PASS" },
      { step: "prepare-plan-group-by-category", result: "PASS" },
      { step: "confirm-plan-move", result: "PASS", pathAfter: movedPath },
      { step: "undo-plan", result: "PASS", pathAfter: restoredPath },
    ],
  };

  mkdirSync(buildDir, { recursive: true });
  const reportPath = join(buildDir, "PLAN-MODE-UI-CONFIRM-UNDO.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  await browser.close();
  console.log(`Evidence: ${reportPath}`);
  console.log("browser-plan-mode-confirm-undo-playwright PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
