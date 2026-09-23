import { brand, brandCssVars } from "@suhuella/brand";
import {
  createMemoryPartnerStore,
  createPartner,
  getPartnerStore,
  resetPartnerStoreForTests,
  resolveRequestBrandForHostname,
  seedPartnerDomainForTests,
  toPublicRequestBrand,
  toPresentationBrand,
  presentationBrandSupportsAppShell,
  presentationPageTitle,
  unconfiguredHostnameCopy,
  type PartnerActor,
} from "./partners/index.ts";
import { requestBrandCssVars } from "./partners/request-brand.ts";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function seedActivePartner(slug: string, hostname: string, displayName: string) {
  const platform: PartnerActor = { kind: "platform", email: "admin@suhuella.com" };
  const created = await createPartner(platform, {
    slug,
    displayName,
    ownerEmail: `owner@${slug}.example`,
    origin: "test",
    reason: "brand-presentation-check",
  });
  await seedPartnerDomainForTests({
    partnerId: created.summary.partner.partnerId,
    brandId: created.summary.brand.brandId,
    hostname,
    accent: "#111111",
    displayName,
  });
}

async function runBrandPresentationCheck(): Promise<void> {
  const platformCtx = await resolveRequestBrandForHostname("localhost:3000");
  const platformPresentation = toPresentationBrand(platformCtx);
  assert(platformPresentation.servesApp, "localhost serves app");
  assert(platformPresentation.displayName === brand.displayName, "platform wordmark");
  assert(platformPresentation.accent === brand.theme.accent, "platform accent from brand config");
  assert(brand.theme.accent === "#0084FF", "SuHuella accent source of truth");
  assert(
    (brandCssVars() as Record<string, string>)["--brand-accent"] === "#0084FF",
    "platform CSS accent token",
  );
  assert(
    requestBrandCssVars(platformCtx)["--brand-accent"] === "#0084FF",
    "request CSS vars use brand tokens on platform",
  );
  assert(presentationBrandSupportsAppShell(platformPresentation), "platform supports shell");

  createMemoryPartnerStore();
  resetPartnerStoreForTests();
  await seedActivePartner("bp-alpha", "cloud.bp-alpha.example", "BP Alpha");

  const partnerCtx = await resolveRequestBrandForHostname("cloud.bp-alpha.example");
  const partnerPresentation = toPresentationBrand(partnerCtx);
  assert(partnerPresentation.servesApp, "active partner serves app");
  assert(partnerPresentation.displayName === "BP Alpha", "partner wordmark");
  assert(partnerPresentation.accent === "#111111", "partner accent preserved");

  const unknownCtx = await resolveRequestBrandForHostname("no-such-host.example");
  const unknownPresentation = toPresentationBrand(unknownCtx);
  assert(!unknownPresentation.servesApp, "unknown does not serve app");
  assert(unknownPresentation.displayName === "", "unknown has no wordmark");
  assert(unknownPresentation.logoUrl === null, "unknown has no logo");
  assert(!presentationBrandSupportsAppShell(unknownPresentation), "unknown blocks shell");

  const publicUnknown = toPublicRequestBrand(unknownCtx);
  assert(publicUnknown.displayName === "Unknown hostname", "resolution layer unchanged");

  assert(
    presentationPageTitle({ kind: "unknown", locale: "en" }) === "Site not available",
    "unknown page title en",
  );
  assert(
    unconfiguredHostnameCopy({ kind: "unknown", locale: "es" }).title === "Sitio no disponible",
    "unknown copy es",
  );
  {
    const unknownEn = unconfiguredHostnameCopy({ kind: "unknown", locale: "en" }).body;
    const pendingEn = unconfiguredHostnameCopy({
      kind: "status",
      domainStatus: "pending",
      locale: "en",
    }).body;
    assert(!unknownEn.toLowerCase().includes("dns"), "public unknown copy has no DNS");
    assert(!pendingEn.toLowerCase().includes("onboarding"), "public pending copy has no onboarding");
    assert(!pendingEn.toLowerCase().includes("cname"), "public pending copy has no CNAME");
  }

  {
    const store = await getPartnerStore();
    const doc = await store.read();
    const domain = doc.domains.find((item) => item.hostname === "cloud.bp-alpha.example");
    assert(domain, "alpha domain");
    domain.status = "pending";
    await store.write(doc);
  }
  const pendingCtx = await resolveRequestBrandForHostname("cloud.bp-alpha.example");
  const pendingPresentation = toPresentationBrand(pendingCtx);
  assert(!pendingPresentation.servesApp, "pending does not serve app");
  assert(pendingPresentation.displayName === "", "pending has no app wordmark");

  const root = path.dirname(fileURLToPath(import.meta.url));
  const suhuellaShell = readFileSync(path.join(root, "suhuella-shell.tsx"), "utf8");
  const suhuellaApp = readFileSync(path.join(root, "../components/web/SuhuellaApp.tsx"), "utf8");
  const rootLayout = readFileSync(path.join(root, "../app/layout.tsx"), "utf8");
  assert(suhuellaShell.includes("UnconfiguredHostnameScreen"), "shell gates unknown hosts");
  assert(suhuellaApp.includes("presentationBrandSupportsAppShell"), "app shell guard");
  assert(!suhuellaApp.includes("#0084FF"), "shared app component has no hardcoded SuHuella blue");
  assert(rootLayout.includes("neutralTitle"), "layout uses neutral metadata title when app does not serve");
  assert(rootLayout.includes("metadataBase: new URL(siteOrigin())"), "metadataBase only when servesApp");
  assert(rootLayout.includes('robots: servesApp ? undefined : { index: false, follow: false }'), "neutral hosts noindex");

  console.log("BRAND-PRESENTATION-AND-UNKNOWN-HOST-002 check passed");
}

runBrandPresentationCheck().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
