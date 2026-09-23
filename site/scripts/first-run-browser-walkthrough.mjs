/**
 * Automated production walkthrough — proxy for operator first-run observation.
 * Cannot replace a real non-developer participant (no folder picker gesture, no trust interview).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://suhuella.com";
const OUT = join(process.cwd(), ".first-run-walkthrough");

const routes = [
  { name: "home", path: "/home" },
  { name: "sources", path: "/sources" },
  { name: "search", path: "/search" },
  { name: "plan-mode", path: "/plan-mode" },
  { name: "activity", path: "/activity" },
  { name: "settings", path: "/settings" },
  { name: "landing-overlay", path: "/" },
  { name: "plans-overlay", path: "/license" },
  { name: "downloads-overlay", path: "/download" },
];

function visibleText(page) {
  return page.evaluate(() => {
    const app = document.querySelector("[data-suhuella-app]");
    const root = app ?? document.body;
    const walk = (el) => {
      const texts = [];
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent?.trim();
          if (t) texts.push(t);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const e = node;
          if (e.tagName === "SCRIPT" || e.tagName === "STYLE") continue;
          const style = window.getComputedStyle(e);
          if (style.display === "none" || style.visibility === "hidden") continue;
          texts.push(...walk(e));
        }
      }
      return texts;
    };
    return walk(root).join("\n").slice(0, 8000);
  });
}

async function collectNavLabels(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("nav a, [role='navigation'] a, aside a")]
      .map((a) => ({ text: a.textContent?.trim(), href: a.getAttribute("href") }))
      .filter((x) => x.text),
  );
}

async function collectButtons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .map((b) => ({
        text: b.textContent?.trim().slice(0, 80),
        aria: b.getAttribute("aria-label"),
        disabled: b.disabled,
      }))
      .filter((x) => x.text || x.aria),
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const report = {
    base: BASE,
    timestamp: new Date().toISOString(),
    agent: "automated-browser-walkthrough",
    limitation:
      "Not a valid FIRST-RUN participant session — no human observer, no folder connect, no post-session interview.",
    routes: [],
    journey: [],
    friction: [],
  };

  for (const route of routes) {
    const url = `${BASE}${route.path}`;
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    const status = res?.status() ?? 0;
    const title = await page.title();
    const text = await visibleText(page);
    const nav = await collectNavLabels(page);
    const buttons = await collectButtons(page);
    const hasAppShell = await page.locator("[data-suhuella-app]").count();
    const screenshot = join(OUT, `${route.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });

    const entry = {
      name: route.name,
      url,
      status,
      title,
      hasAppShell: hasAppShell > 0,
      nav,
      buttons: buttons.slice(0, 25),
      textSample: text.slice(0, 2000),
      screenshot: screenshot.replace(process.cwd(), "."),
    };
    report.routes.push(entry);

    if (status !== 200 && status !== 308) {
      report.friction.push(`${route.path} returned HTTP ${status}`);
    }
    if (!text.trim()) {
      report.friction.push(`${route.path} has little visible text`);
    }
  }

  // Simulated click journey from home
  await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  report.journey.push({ step: "open-home", url: page.url() });

  for (const label of ["Sources", "Fuentes", "Search", "Buscar", "Plan Mode", "Modo Plan"]) {
    const link = page.getByRole("link", { name: new RegExp(label, "i") }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(1200);
      report.journey.push({
        step: `nav-${label.toLowerCase()}`,
        url: page.url(),
        heading: await page.locator("h1, h2").first().textContent().catch(() => null),
      });
      await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    }
  }

  // Sources connect affordance
  await page.goto(`${BASE}/sources`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const connectBtn = page.getByRole("button", { name: /connect|conectar|add|añadir/i }).first();
  if (await connectBtn.count()) {
    report.journey.push({
      step: "sources-connect-visible",
      button: await connectBtn.textContent(),
    });
    report.friction.push(
      "Folder connect requires File System Access API user gesture — not exercised in headless automation.",
    );
  } else {
    report.friction.push("No obvious Connect/Add button found on Sources");
  }

  // Forbidden upload language scan
  const allText = report.routes.map((r) => r.textSample).join("\n").toLowerCase();
  for (const phrase of ["subido", "uploaded", "nube", "cloud sync"]) {
    if (allText.includes(phrase)) {
      report.friction.push(`Copy mentions "${phrase}" — verify local-first messaging`);
    }
  }

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, out: OUT, friction: report.friction.length, routes: report.routes.length }));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
