import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } }).then((c) =>
    c.newPage(),
  );
  await page.goto("https://suhuella.com/organise", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const body = await page.locator("main").innerText();
  if (/This browser cannot choose documents/i.test(body)) {
    throw new Error("Production Organise still shows the dead-end banner");
  }
  if (/\bupload\b|\bsube\b|\bsend files\b/i.test(body)) {
    throw new Error("Production Organise uses upload language");
  }
  if (/Download Desktop to apply|download the desktop app/i.test(body)) {
    throw new Error("Production Organise requires Desktop");
  }

  await page.getByRole("button", { name: "Connect a folder" }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Choose files" }).waitFor({ timeout: 2000 });
  await page.getByRole("button", { name: "Choose folder" }).waitFor({ timeout: 2000 });

  await browser.close();
  console.log("Production Organise selection passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
