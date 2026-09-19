import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  accentReadableOnNeutral,
  assertBrandTheme,
  brandThemeCssVars,
  contrastRatio,
  darkenHex,
  resolveBrand,
  resolveBrandTheme,
} from "./index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readText(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function collectFiles(relativeDir: string, extensions: Set<string>): string[] {
  const abs = path.join(root, relativeDir);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
        continue;
      }
      if (extensions.has(path.extname(entry))) out.push(full);
    }
  };
  walk(abs);
  return out;
}

function run(): void {
  const suhuella = resolveBrand("suhuella");
  const dbasenet = resolveBrand("dbasenet");

  assertBrandTheme(suhuella.theme, "suhuella");
  assertBrandTheme(dbasenet.theme, "dbasenet");

  assert(suhuella.theme.accent === "#0084FF", "SuHuella accent is #0084FF");
  assert(suhuella.theme.onAccent === "#FFFFFF", "SuHuella onAccent is white");
  assert(dbasenet.theme.accent === "#0B5F63", "Dbasenet accent is #0B5F63");
  assert(dbasenet.theme.onAccent === "#FFFFFF", "Dbasenet onAccent is white");
  assert(accentReadableOnNeutral(suhuella.theme.accent), "SuHuella accent reads on white or black");
  assert(accentReadableOnNeutral(dbasenet.theme.accent), "Dbasenet accent reads on white or black");

  const suhuellaOnAccent = contrastRatio(suhuella.theme.accent, suhuella.theme.onAccent);
  const dbasenetOnAccent = contrastRatio(dbasenet.theme.accent, dbasenet.theme.onAccent);
  assert(suhuellaOnAccent !== null && suhuellaOnAccent >= 3, "SuHuella CTA contrast is usable");
  assert(dbasenetOnAccent !== null && dbasenetOnAccent >= 4.5, "Dbasenet CTA contrast meets 4.5:1");

  const suhuellaVars = brandThemeCssVars(suhuella.theme);
  const dbasenetVars = brandThemeCssVars(dbasenet.theme);
  assert(suhuellaVars["--brand-accent"] === "#0084FF", "SuHuella CSS accent");
  assert(dbasenetVars["--brand-accent"] === "#0B5F63", "Dbasenet CSS accent");
  assert(suhuellaVars["--nav-active-bg"] === suhuellaVars["--brand-accent"], "nav active uses accent");
  assert(suhuellaVars["--nav-active-fg"] === suhuellaVars["--brand-on-accent"], "nav active text uses onAccent");
  assert(suhuellaVars["--brand-accent"] !== dbasenetVars["--brand-accent"], "partner CSS accent differs");
  assert(resolveBrandTheme(suhuella.theme).accentHover === darkenHex("#0084FF", 0.08), "hover derives −8%");

  const suhuellaIdentity = JSON.parse(readText("brands/suhuella/identity.json")) as {
    theme: { accent: string; onAccent: string };
  };
  const dbasenetIdentity = JSON.parse(readText("brands/dbasenet/identity.json")) as {
    theme: { accent: string; onAccent: string };
  };
  assert(suhuellaIdentity.theme.accent === suhuella.theme.accent, "SuHuella identity theme matches BrandConfig");
  assert(dbasenetIdentity.theme.accent === dbasenet.theme.accent, "Dbasenet identity theme matches BrandConfig");

  const layout = readText("site/app/layout.tsx");
  assert(layout.includes("brandCssVars"), "site layout injects theme variables");

  const language = readText("site/components/LanguageSwitcher.tsx");
  assert(language.includes("--nav-active-bg"), "language toggle uses nav-active-bg");
  assert(language.includes("--nav-active-fg"), "language toggle uses nav-active-fg");
  assert(!language.includes("#0084FF"), "language toggle has no hardcoded SuHuella blue");

  const glow = readText("site/components/GlowButton.tsx");
  assert(glow.includes("var(--brand-accent)"), "landing CTA uses brand accent token");
  assert(!glow.includes("#0084FF"), "landing CTA has no hardcoded blue");

  const overlay = readText("site/components/web/RouteOverlayFrame.tsx");
  assert(overlay.includes("<LanguageSwitcher inline />"), "language lives inside overlay island");
  assert(overlay.includes('aria-label="Close"'), "close sits beside the language switcher");
  assert(!overlay.includes("fixed top-5 right-5"), "close is not viewport-fixed away from the island");

  const publicShell = [
    ...collectFiles("site/components", new Set([".tsx", ".ts"])),
    path.join(root, "site/app/layout.tsx"),
  ];
  for (const file of publicShell) {
    const source = readFileSync(file, "utf8");
    assert(!source.includes("#0084FF"), `${path.relative(root, file)} has no hardcoded #0084FF`);
    assert(!source.includes("#0084ff"), `${path.relative(root, file)} has no hardcoded #0084ff`);
  }

  const desktopApp = readText("packages/product/src/App.tsx");
  assert(desktopApp.includes("brandCssVars"), "desktop shell injects theme variables");

  console.log("BRAND-THEME-TOKENS-001 check passed");
}

run();
