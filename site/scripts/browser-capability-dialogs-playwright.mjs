/**
 * Real Chromium checks for browser capability dialogs and Organise recovery.
 * File System Access handles here are mocks. They do not prove a native picker.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BROWSER_CONNECT_URL ?? "http://127.0.0.1:3000";
const SHOTS = "/tmp/suhuella-browser-organise-e2e";
const host = new URL(BASE).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  throw new Error(`Refusing non-local target ${BASE}`);
}

const UNCERTAIN =
  "In progress. Outcome uncertain until this record is updated. It will not run again automatically.";
const PARTIAL = "Copy finished and the original could not be removed. Both files exist.";
const PERMISSION = "This folder needs write permission before files can change.";
const CROSS = "Moves between sources are not available in the browser.";
const INTENT = "Could not record this plan. No files were changed.";

mkdirSync(SHOTS, { recursive: true });

function releaseBody(mac, windows) {
  return JSON.stringify({ ok: true, release: { mac, windows } });
}

async function installRelease(context, mac, windows) {
  await context.route("**/api/release", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: releaseBody(mac, windows),
    }),
  );
}

async function shot(page, name) {
  const path = `${SHOTS}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`screenshot ${path}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openLimitedDialog(page) {
  const card = page.locator("article").filter({ hasText: /^Documents/ }).first();
  await card.getByRole("button", { name: /Choose subfolder|Elegir subcarpeta/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  return { card, dialog };
}

async function assertFocusTrap(page, dialog) {
  const focused = await page.evaluate(() => {
    const dialogNode = document.querySelector('[role="dialog"]');
    const active = document.activeElement;
    return {
      inside: Boolean(dialogNode && active && dialogNode.contains(active)),
      modal: dialogNode?.getAttribute("aria-modal"),
      label: dialogNode?.getAttribute("aria-labelledby"),
      described: dialogNode?.getAttribute("aria-describedby"),
    };
  });
  assert(focused.inside, "initial focus is outside the dialog");
  assert(focused.modal === "true", "dialog is not aria-modal");
  assert(focused.label && focused.described, "dialog is missing an accessible name or description");
  const steps = (await dialog.locator("button, a[href]").count()) + 2;
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() =>
      Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
    );
    assert(inside, "Tab left the dialog");
  }
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Shift+Tab");
    const inside = await page.evaluate(() =>
      Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
    );
    assert(inside, "Shift+Tab left the dialog");
  }
  const covered = await page.evaluate(() => {
    const backdrop = document.querySelector('[role="presentation"]');
    if (!backdrop) return false;
    const rect = backdrop.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + 8, rect.top + 8);
    return backdrop === top || backdrop.contains(top);
  });
  assert(covered, "the page behind the dialog is still the hit target");
}

async function preparePlan(page) {
  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loadDemo = page.getByRole("button", { name: /Load demo data|Reload demo data/ });
  await loadDemo.waitFor({ timeout: 20000 });
  await loadDemo.click();
  await page.getByText("dev-data", { exact: true }).first().waitFor({ timeout: 8000 });
  await page.goto(`${BASE}/plan-mode`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /5 documents/ }).waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    const api = window.suhuella;
    const original = api.previewOrganisationPlan.bind(api);
    api.previewOrganisationPlan = async (knowledgeSet) => {
      const preview = await original(knowledgeSet);
      if (!preview.ok) return preview;
      preview.preview.items = preview.preview.items.map((item, index) => {
        if (index > 1 || !item.currentPath) return item;
        return {
          ...item,
          action: "rename",
          proposedPath: item.currentPath.replace(/([^/]+)$/, "renamed-$1"),
          selected: true,
          status: "preview",
          explanation: "Synthetic rename for the browser check",
          skipReason: null,
        };
      });
      return preview;
    };
  });
  await page.getByRole("button", { name: /5 documents/ }).click();
  await page.getByText("renamed-factura-enero.pdf").first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Grid" }).click();
  const edit = page.getByRole("button", { name: "Edit" }).first();
  if (await edit.isEnabled()) {
    await edit.click();
    const input = page.locator("input").last();
    await input.fill("factura-enero-revisada.pdf");
    await page.getByRole("button", { name: "Save" }).click();
  }
  const keep = page.getByRole("button", { name: "Keep original" }).last();
  if (await keep.count()) await keep.click();
  const accepts = page.getByRole("button", { name: "Accept" });
  const acceptCount = await accepts.count();
  for (let index = 0; index < acceptCount; index += 1) {
    const button = accepts.nth(index);
    if (await button.isVisible()) await button.click();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const downloads = [];

  const mac = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  await installRelease(mac, "https://example.invalid/SuHuella.dmg", "https://example.invalid/SuHuella.exe");
  const page = await mac.newPage();
  page.on("download", (download) => downloads.push(download.url()));

  await page.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Choose subfolder/ }).first().waitFor({ timeout: 20000 });
  const opened = await openLimitedDialog(page);
  assert((await page.getByRole("dialog").count()) === 1, "limited folder opened more than one dialog");
  await page.locator('[role="presentation"]').click({ position: { x: 8, y: 8 } });
  await opened.dialog.waitFor({ state: "hidden", timeout: 4000 });
  const reopened = await openLimitedDialog(page);
  assert((await page.getByRole("dialog").count()) === 1, "reopening the limitation stacked another dialog");
  opened.dialog = reopened.dialog;
  const title = await opened.dialog.getByRole("heading").innerText();
  const body = await opened.dialog.locator("p").first().innerText();
  assert(title.includes("SuHuella Desktop"), `unexpected title: ${title}`);
  assert(/choose a subfolder/i.test(body), `unexpected body: ${body}`);
  assert(!/every function/i.test(body), "dialog promises every function");
  assert(downloads.length === 0, "the dialog started a download by itself");
  const macDownload = opened.dialog.getByRole("button", { name: "Download for Mac" });
  await macDownload.waitFor({ timeout: 8000 });
  assert((await opened.dialog.getByRole("button", { name: "Download for Windows" }).count()) === 0, "Mac saw a Windows installer");
  await assertFocusTrap(page, opened.dialog);
  await shot(page, "01-limited-folder-mac-en");

  const trigger = await page.evaluate(() => document.activeElement?.textContent ?? "");
  await page.keyboard.press("Escape");
  await opened.dialog.waitFor({ state: "hidden", timeout: 4000 });
  const restored = await page.evaluate(() => document.activeElement?.textContent ?? "");
  assert(restored.trim().length > 0, "focus was not restored");
  if (trigger && !restored.includes(trigger.trim().slice(0, 12)) && !/Choose subfolder/.test(restored)) {
    console.log(`focus restored to: ${restored.slice(0, 80)}`);
  }

  await page.evaluate(() => {
    window.__pickerCalls = [];
    window.showDirectoryPicker = async (options) => {
      window.__pickerCalls.push(options ?? null);
      throw new DOMException("The user aborted a request.", "AbortError");
    };
  });
  const pickerDialog = (await openLimitedDialog(page)).dialog;
  await pickerDialog.getByRole("button", { name: "Choose subfolder" }).click();
  await page.waitForTimeout(300);
  const abortCalls = await page.evaluate(() => window.__pickerCalls?.length ?? 0);
  assert(abortCalls === 1, "Choose subfolder did not open the picker from the user click");
  const abortMode = await page.evaluate(() => window.__pickerCalls?.[0]?.mode ?? null);
  assert(abortMode === "read", `picker did not stay read-only: ${abortMode}`);
  assert((await page.getByRole("dialog").count()) === 1, "cancelling the picker opened another dialog");
  assert((await page.getByText(/Download for Mac/).count()) <= 2, "cancel created an extra download prompt");
  await page.getByRole("button", { name: "Not now" }).click();

  await page.evaluate(() => {
    window.showDirectoryPicker = async () => {
      const error = new DOMException("Folder permission was not granted.", "NotAllowedError");
      throw error;
    };
  });
  await page.getByRole("button", { name: /Connect folder|Conectar carpeta/ }).first().click();
  const deniedDialog = page.getByRole("dialog");
  await deniedDialog.waitFor({ timeout: 5000 });
  const deniedBody = await deniedDialog.locator("p").first().innerText();
  assert(/Permission needed|did not grant access/i.test(deniedBody), `denied permission dialog missing retry copy: ${deniedBody}`);
  assert(/desktop app|local files/i.test(deniedBody), "denied permission explains the desktop alternative");
  assert(!/every function/i.test(deniedBody), "denied permission promises every function");
  await deniedDialog.getByRole("button", { name: /Choose folder again|Elegir carpeta otra vez/ }).waitFor();
  await deniedDialog.getByRole("button", { name: /Download for Mac|Descargar para Mac/ }).waitFor();
  await shot(page, "02-permission-denied-en");
  await deniedDialog.getByRole("button", { name: /Not now|Ahora no/ }).click();

  await page.evaluate(() => {
    window.showDirectoryPicker = async (options) => {
      window.__pickerCalls.push(options ?? null);
      const file = {
        kind: "file",
        name: "e2e-note.txt",
        getFile: async () => new File(["suhuella-e2e-synthetic"], "e2e-note.txt", { type: "text/plain" }),
      };
      return {
        kind: "directory",
        name: "suhuella-e2e-folder",
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        entries: async function* entries() {
          yield ["e2e-note.txt", file];
        },
      };
    };
  });
  const limited = await openLimitedDialog(page);
  await limited.dialog.getByRole("button", { name: "Choose subfolder" }).click();
  await page.getByText("suhuella-e2e-folder", { exact: true }).first().waitFor({ timeout: 8000 });
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 4000 });
  await shot(page, "03-folder-connected-en");

  const cloudText = await page.locator("body").innerText();
  assert(/Coming later|Cloud/.test(cloudText), "cloud section is missing");
  assert(!/Desktop can write cloud|download the desktop app to change cloud/i.test(cloudText), "cloud offers Desktop as a write solution");

  await page.setViewportSize({ width: 390, height: 844 });
  await openLimitedDialog(page);
  const mobileDialog = page.getByRole("dialog");
  const box = await mobileDialog.boundingBox();
  assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= 392, "dialog overflows the mobile viewport");
  await mobileDialog.getByRole("button", { name: "Not now" }).waitFor();
  await shot(page, "04-limited-folder-mobile-en");
  await page.keyboard.press("Escape");
  await mac.close();

  const windows = await browser.newContext({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  await installRelease(windows, "https://example.invalid/SuHuella.dmg", "https://example.invalid/SuHuella.exe");
  const winPage = await windows.newPage();
  await winPage.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const winDialog = (await openLimitedDialog(winPage)).dialog;
  await winDialog.getByRole("button", { name: "Download for Windows" }).waitFor({ timeout: 8000 });
  assert((await winDialog.getByRole("button", { name: "Download for Mac" }).count()) === 0, "Windows saw a Mac installer");
  await shot(winPage, "05-limited-folder-windows-en");
  await windows.close();

  const phone = await browser.newContext({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await installRelease(phone, "https://example.invalid/SuHuella.dmg", "https://example.invalid/SuHuella.exe");
  const phonePage = await phone.newPage();
  await phonePage.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const phoneDialog = (await openLimitedDialog(phonePage)).dialog;
  assert((await phoneDialog.getByRole("button", { name: /Download for Mac|Download for Windows/ }).count()) === 0, "phone offered a desktop installer");
  await phoneDialog.getByRole("link", { name: /Get the desktop app|Ver opciones de escritorio/ }).waitFor({ timeout: 8000 });
  await shot(phonePage, "06-unsupported-platform-en");
  await phone.close();

  const missing = await browser.newContext({
    locale: "es-ES",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  await installRelease(missing, "", "");
  const esPage = await missing.newPage();
  await esPage.goto(`${BASE}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const esDialog = (await openLimitedDialog(esPage)).dialog;
  const esTitle = await esDialog.getByRole("heading").innerText();
  assert(esTitle.includes("SuHuella Desktop"), `Spanish title lost the brand: ${esTitle}`);
  assert(/Elegir subcarpeta/.test(await esDialog.innerText()), "Spanish primary action is missing");
  await esDialog.getByText("no está disponible para este sistema").waitFor({ timeout: 8000 });
  assert((await esDialog.getByRole("button", { name: /Descargar para|Download for/ }).count()) === 0, "missing build still offered an installer");
  await shot(esPage, "07-missing-download-es");
  await esPage.keyboard.press("Escape");
  await missing.close();

  const noWrite = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  await noWrite.addInitScript(() => {
    const proto = window.FileSystemFileHandle?.prototype;
    if (!proto) return;
    for (const name of ["move", "createWritable"]) {
      try {
        Object.defineProperty(proto, name, { configurable: true, value: undefined });
      } catch {
        /* native property stayed */
      }
    }
  });
  await installRelease(noWrite, "https://example.invalid/SuHuella.dmg", "https://example.invalid/SuHuella.exe");
  const organise = await noWrite.newPage();
  await preparePlan(organise);
  await organise.waitForTimeout(300);
  const renamed = await organise.getByText(/factura-enero-revisada\.pdf|Rename to factura-enero-revisada\.pdf/).count();
  const kept = await organise.getByText("nota-reunion.txt").count();
  await organise.evaluate(() => {
    const api = window.suhuella;
    api.__e2eExecuteCalls = 0;
    const original = api.executeOrganisationPlan.bind(api);
    api.executeOrganisationPlan = async (...args) => {
      api.__e2eExecuteCalls += 1;
      return original(...args);
    };
  });
  await organise.getByRole("button", { name: "Confirm Plan" }).click();
  const writeDialog = organise.getByRole("dialog");
  await writeDialog.waitFor({ timeout: 5000 });
  const writeBody = await writeDialog.locator("p").first().innerText();
  assert(/prepare the plan/i.test(writeBody), `write dialog did not explain the limit: ${writeBody}`);
  assert(/does not change cloud files/i.test(writeBody), "write dialog omitted the cloud limit");
  assert((await organise.evaluate(() => window.suhuella.__e2eExecuteCalls)) === 0, "confirm executed without write support");
  await shot(organise, "08-no-write-confirm-en");
  await writeDialog.getByRole("button", { name: "Not now" }).click();
  await writeDialog.waitFor({ state: "hidden" });
  assert(await organise.getByText("factura-enero.pdf").count(), "closing the dialog dropped the plan");
  if (renamed) assert(await organise.getByText("factura-enero-revisada.pdf").count(), "rename edit was lost");
  if (kept) assert(await organise.getByText("nota-reunion.txt").count(), "source context was lost");
  await organise.getByRole("button", { name: "Confirm Plan" }).click();
  await organise.getByRole("dialog").waitFor();
  await organise.keyboard.press("Escape");
  await organise.getByRole("dialog").waitFor({ state: "hidden" });
  assert((await organise.evaluate(() => window.suhuella.__e2eExecuteCalls)) === 0, "Escape executed the plan");
  assert(await organise.getByText("factura-enero.pdf").count(), "Escape dropped the plan");
  await organise.getByRole("button", { name: "Confirm Plan" }).click();
  await organise.getByRole("dialog").waitFor();
  assert((await organise.getByRole("dialog").count()) === 1, "repeated confirm opened duplicate dialogs");
  await organise.keyboard.press("Escape");
  assert((await organise.evaluate(() => window.suhuella.__e2eExecuteCalls)) === 0, "repeated confirm executed twice");
  await noWrite.close();

  const writer = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
  await installRelease(writer, "https://example.invalid/SuHuella.dmg", "");
  const resultPage = await writer.newPage();
  await preparePlan(resultPage);
  async function stubResult(factory) {
    await resultPage.evaluate((payload) => {
      window.suhuella.executeOrganisationPlan = async (request) => {
        const item = request.plan.items[0];
        return {
          ok: true,
          result: {
            simulated: true,
            runId: payload.runId,
            runNumber: 1,
            completedAt: new Date().toISOString(),
            message: payload.message,
            knowledgeSet: request.plan.knowledgeSet,
            appliedCount: payload.appliedCount,
            skippedCount: 0,
            failedCount: payload.failedCount,
            items: [
              {
                ...item,
                status: payload.status,
                skipReason: payload.skipReason,
                warnings: payload.warnings ?? [],
              },
            ],
          },
        };
      };
    }, factory);
  }

  await resultPage.getByRole("button", { name: "Confirm Plan" }).click();
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().waitFor();
  await stubResult({
    runId: "e2e-uncertain",
    message: "No actions applied",
    appliedCount: 0,
    failedCount: 1,
    status: "failed",
    skipReason: UNCERTAIN,
    warnings: [],
  });
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().click();
  await resultPage.getByText(UNCERTAIN).waitFor({ timeout: 5000 });
  assert((await resultPage.getByRole("dialog").count()) === 0, "uncertain result became a download dialog");
  assert((await resultPage.getByText("Undo available").count()) === 0, "uncertain result offered undo");
  assert((await resultPage.getByRole("button", { name: "Undo" }).count()) === 0, "uncertain result still offered Undo");
  await shot(resultPage, "09-uncertain-recovery-en");

  await resultPage.getByRole("button", { name: "New plan" }).click();
  await preparePlan(resultPage);
  await resultPage.getByRole("button", { name: "Confirm Plan" }).click();
  await stubResult({
    runId: "e2e-partial",
    message: "Confirmed 0 actions",
    appliedCount: 0,
    failedCount: 1,
    status: "failed",
    skipReason: PARTIAL,
    warnings: [],
  });
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().click();
  await resultPage.getByText(PARTIAL).waitFor({ timeout: 5000 });
  assert((await resultPage.getByRole("dialog").count()) === 0, "partial result became a download dialog");

  await resultPage.getByRole("button", { name: "New plan" }).click();
  await preparePlan(resultPage);
  await resultPage.getByRole("button", { name: "Confirm Plan" }).click();
  await stubResult({
    runId: "e2e-permission",
    message: "No actions applied",
    appliedCount: 0,
    failedCount: 0,
    status: "skipped",
    skipReason: PERMISSION,
    warnings: [],
  });
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().click();
  const permissionDialog = resultPage.getByRole("dialog");
  await permissionDialog.waitFor({ timeout: 5000 });
  const permissionBody = await permissionDialog.locator("p").first().innerText();
  assert(/write permission|permiso de escritura/i.test(permissionBody), `organise permission dialog missing: ${permissionBody}`);
  await permissionDialog.getByRole("button", { name: /Keep preparing the plan|Seguir preparando el plan/ }).click();
  assert(await resultPage.getByText("factura-enero.pdf").count(), "permission dialog dropped the plan");

  await resultPage.getByRole("button", { name: "Cancel" }).click().catch(() => {});
  await resultPage.getByRole("button", { name: "Confirm Plan" }).click();
  await stubResult({
    runId: "e2e-cross",
    message: "No actions applied",
    appliedCount: 0,
    failedCount: 0,
    status: "skipped",
    skipReason: CROSS,
    warnings: [],
  });
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().click();
  const crossDialog = resultPage.getByRole("dialog");
  await crossDialog.waitFor({ timeout: 5000 });
  const crossBody = await crossDialog.locator("p").first().innerText();
  assert(/same source/i.test(crossBody) && /cloud files/i.test(crossBody), `cross-source copy is wrong: ${crossBody}`);
  await crossDialog.getByRole("button", { name: "Not now" }).click();
  assert(await resultPage.getByText("factura-enero.pdf").count(), "cross-source dialog dropped the plan");

  await resultPage.evaluate((message) => {
    window.suhuella.executeOrganisationPlan = async () => ({
      ok: false,
      error: { code: "invalid_request", message },
    });
  }, INTENT);
  await resultPage.getByRole("button", { name: "Confirm Plan" }).click();
  await resultPage.getByRole("button", { name: "Confirm Plan" }).last().click();
  await resultPage.getByText(INTENT).waitFor({ timeout: 5000 });
  assert((await resultPage.getByRole("dialog").count()) === 0, "intent failure became a download dialog");
  await shot(resultPage, "10-intent-failure-en");
  await writer.close();

  await browser.close();
  assert(downloads.length === 0, "a download started during the browser session");
  console.log("BROWSER-CAPABILITY-DIALOGS playwright passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
