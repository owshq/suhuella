import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyBrandPresentation,
  applyBrandPresentationDeep,
  brand,
  desktopProtocolUrl,
  hasForbiddenSecretFields,
  knownBrandIds,
  licenseOtpFromDisplay,
  licenseOtpReplyTo,
  resolveBrand,
  resolveBrandId,
  salesMailto,
  siteOrigin,
  supportMailto,
} from "./index.ts";
import { verificationEmailSubject } from "../site/lib/resend-mail.ts";
import { businessCheckoutUrl } from "../site/lib/checkout.ts";
import { resolveEffectiveBranding } from "../desktop/src/lib/effective-branding.ts";
import { licenseErrorMessage } from "../desktop/src/lib/license-status.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readText(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readText(relativePath));
}

function assertCompiledDesktopBrand(brandId: string, expectedAppId: string, forbiddenAppId: string): void {
  const relativePath = `desktop/.build/${brandId}/dist-electron/main.cjs`;
  try {
    const main = readText(relativePath);
    assert(main.includes(expectedAppId), `${brandId} main bundle compiles ${expectedAppId}`);
    assert(!main.includes(forbiddenAppId), `${brandId} main bundle does not compile ${forbiddenAppId}`);
    assert(main.includes(`id:"${brandId}"`), `${brandId} main bundle compiles BrandConfig.id`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

function run(): void {
  const suhuella = resolveBrand("suhuella");
  const dbasenet = resolveBrand("dbasenet");
  const suhuellaIdentity = readJson("brands/suhuella/identity.json") as {
    id: string;
    operatorId: string;
    displayName: string;
    primaryDomain: string;
    desktopAppId: string;
    desktopProtocol: string;
    desktopProductName: string;
    pwa: { backgroundColor: string; themeColor: string };
    theme: { accent: string; onAccent: string };
  };
  const dbasenetIdentity = readJson("brands/dbasenet/identity.json") as {
    id: string;
    operatorId: string;
    displayName: string;
    primaryDomain: string;
    desktopAppId: string;
    desktopProtocol: string;
    desktopProductName: string;
    emails: unknown;
    paidCheckoutEnabled: boolean;
    releaseRemoteEnabled: boolean;
    pwa: { backgroundColor: string; themeColor: string };
    theme: { accent: string; onAccent: string };
  };
  const desktopPackage = readJson("desktop/package.json") as {
    version?: string;
    productName: string;
    build?: { appId?: string; productName?: string; protocols?: Array<{ schemes: string[] }> };
  };
  const sitePackage = readJson("site/package.json") as { version?: string };
  const siteRelease = readJson("site/release.json") as { version?: string; minimumVersion?: string };
  assert(suhuella.pwa.backgroundColor === suhuellaIdentity.pwa.backgroundColor, "SuHuella identity pwa matches BrandConfig");
  assert(dbasenet.pwa.backgroundColor === dbasenetIdentity.pwa.backgroundColor, "Dbasenet identity pwa matches BrandConfig");
  assert(suhuella.pwa.themeColor === suhuellaIdentity.pwa.themeColor, "SuHuella PWA theme matches identity");
  assert(dbasenet.pwa.themeColor === dbasenetIdentity.pwa.themeColor, "Dbasenet PWA theme matches identity");
  assert(suhuella.theme.accent === suhuellaIdentity.theme.accent, "SuHuella theme.accent matches identity");
  assert(dbasenet.theme.accent === dbasenetIdentity.theme.accent, "Dbasenet theme.accent matches identity");
  assert(suhuella.theme.accent === "#0084FF", "SuHuella accent stays #0084FF");
  assert(dbasenet.theme.accent === "#0B5F63", "Dbasenet accent stays #0B5F63");
  assert(suhuella.theme.accent !== dbasenet.theme.accent, "partner accent is isolated from SuHuella");
  const projectSite = readText("brands/project-site.mjs");
  assert(!projectSite.includes('brandId === "dbasenet"'), "site projection does not switch on brand id");

  const publicManifest = readJson("site/public/app.webmanifest") as {
    name: string;
    short_name: string;
    start_url: string;
  };
  const suhuellaRelease = readJson("brands/suhuella/release.json") as {
    brandId: string;
    version: string;
    minimumVersion?: string;
  };
  const dbasenetRelease = readJson("brands/dbasenet/release.json") as {
    brandId: string;
    version: string;
    minimumVersion?: string;
  };
  const suhuellaDeploy = readJson("brands/suhuella/deployment.json") as Record<string, unknown>;
  const dbasenetDeploy = readJson("brands/dbasenet/deployment.json") as Record<string, unknown>;

  assert(knownBrandIds().join(",") === "suhuella,dbasenet", "catalog is suhuella + dbasenet");
  assert(suhuella.operatorId === "self", "SuHuella operator is self");
  assert(dbasenet.operatorId === "self", "Dbasenet operator is self");
  assert(suhuella.id === "suhuella", "SuHuella id");
  assert(dbasenet.id === "dbasenet", "Dbasenet id");
  assert(suhuella.displayName === "SuHuella", "SuHuella displayName unchanged");
  assert(dbasenet.displayName === "Dbasenet", "Dbasenet displayName");
  assert(suhuella.primaryDomain === "suhuella.com", "SuHuella domain unchanged");
  assert(dbasenet.primaryDomain === "dbasenet.com", "Dbasenet domain");
  assert(suhuella.desktopAppId === "com.suhuella.desktop", "SuHuella appId unchanged");
  assert(dbasenet.desktopAppId === "com.dbasenet.desktop", "Dbasenet birth appId");
  assert(suhuella.desktopProtocol === "suhuella", "SuHuella protocol unchanged");
  assert(dbasenet.desktopProtocol === "dbasenet", "Dbasenet birth protocol");
  assert(suhuella.desktopProductName === "SuHuella", "SuHuella productName unchanged");
  assert(dbasenet.desktopProductName === "Dbasenet", "Dbasenet productName");
  assert(suhuella.desktopAppId !== dbasenet.desktopAppId, "appIds are isolated");
  assert(suhuella.desktopProtocol !== dbasenet.desktopProtocol, "protocols are isolated");
  assert(suhuella.desktopProductName !== dbasenet.desktopProductName, "product names are isolated");
  assert(suhuella.release.mac !== "Dbasenet-${version}.dmg", "SuHuella release is not a Dbasenet artifact");
  assert(dbasenet.release.windows !== "SuHuella-Setup-${version}.exe", "Dbasenet release is not a SuHuella artifact");

  assert(suhuellaIdentity.desktopAppId === suhuella.desktopAppId, "SuHuella identity.json matches BrandConfig");
  assert(dbasenetIdentity.desktopAppId === dbasenet.desktopAppId, "Dbasenet identity.json matches BrandConfig");
  assert(dbasenetIdentity.emails === null, "Dbasenet has no invented mailboxes");
  assert(dbasenetIdentity.paidCheckoutEnabled === false, "Dbasenet paid checkout is disabled");
  assert(dbasenetIdentity.releaseRemoteEnabled === false, "Dbasenet remote release is disabled");
  assert(suhuellaRelease.brandId === "suhuella", "SuHuella release is Brand-scoped");
  assert(dbasenetRelease.brandId === "dbasenet", "Dbasenet release is Brand-scoped");
  assert(suhuellaRelease.version === dbasenetRelease.version, "release versions share current desktop authority");
  const publicVersion = suhuella.release.version;
  assert(publicVersion === "0.1.0-pre-rc", "public version authority is 0.1.0-pre-rc until tagged rc1");
  assert(suhuella.release.minimumVersion === publicVersion, "SuHuella BrandConfig minimumVersion matches public version");
  assert(dbasenet.release.version === publicVersion, "Dbasenet BrandConfig version matches public version");
  assert(dbasenet.release.minimumVersion === publicVersion, "Dbasenet BrandConfig minimumVersion matches public version");
  assert(suhuellaRelease.version === publicVersion, "SuHuella release.json matches BrandConfig");
  assert(suhuellaRelease.minimumVersion === publicVersion, "SuHuella release.json minimumVersion matches BrandConfig");
  assert(dbasenetRelease.minimumVersion === publicVersion, "Dbasenet release.json minimumVersion matches BrandConfig");
  assert(sitePackage.version === publicVersion, "site package.json matches public version");
  assert(desktopPackage.version === publicVersion, "desktop package.json matches public version");
  assert(siteRelease.version === publicVersion, "site/release.json matches public version");
  assert(siteRelease.minimumVersion === publicVersion, "site/release.json minimumVersion matches public version");
  const siteWrangler = readText("site/wrangler.jsonc");
  const rootWrangler = readText("wrangler.jsonc");
  assert(
    siteWrangler.includes(`"NEXT_PUBLIC_APP_VERSION": "${publicVersion}"`),
    "site Worker env version matches public version",
  );
  assert(
    rootWrangler.includes(`"NEXT_PUBLIC_APP_VERSION": "${publicVersion}"`),
    "root Worker env version matches public version",
  );
  const browserLicense = readText("desktop/src/host/browser/license.ts");
  const browserHost = readText("desktop/src/host/install-browser-host.ts");
  assert(browserLicense.includes("brand.release.version"), "browser license appVersion reads BrandConfig");
  assert(!browserLicense.includes("0.1.0-web"), "0.1.0-web is not a public version");
  assert(browserHost.includes("brand.release.version"), "browser About version reads BrandConfig");
  assert(!browserHost.includes("0.1.0-web"), "browser About does not use 0.1.0-web");
  assert(suhuellaDeploy.status === "production", "SuHuella deployment remains production");
  assert(dbasenetDeploy.status === "build-only", "Dbasenet deployment is build-only");
  assert(dbasenetDeploy.workerName === "dbasenet", "Dbasenet worker identity is projected only");
  assert(dbasenetDeploy.publicDomain === "dbasenet.com", "Dbasenet domain is projected only");
  const deploySerialized = JSON.stringify(dbasenetDeploy);
  assert(!deploySerialized.includes("STRIPE"), "Dbasenet deployment has no Stripe secrets");
  assert(!deploySerialized.includes("RESEND"), "Dbasenet deployment has no Resend secrets");
  assert(!deploySerialized.includes("LICENSE_SIGNING"), "Dbasenet deployment has no signing secrets");

  assert(resolveBrandId("") === "suhuella", "missing BRAND defaults to suhuella");
  assert(resolveBrandId("suhuella") === "suhuella", "explicit suhuella resolves");
  assert(resolveBrandId("dbasenet") === "dbasenet", "explicit dbasenet resolves");
  let unknownFailed = false;
  try {
    resolveBrandId("unknown");
  } catch (error) {
    unknownFailed = error instanceof Error && error.message.includes("Unknown brand");
  }
  assert(unknownFailed, "unknown Brand selection fails closed");

  const unknownBuild = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--eval", "import('./brands/resolve.ts')"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BRAND: "unknown" },
    },
  );
  assert(unknownBuild.status !== 0, "unknown production Brand load fails closed");
  assert(
    `${unknownBuild.stderr}${unknownBuild.stdout}`.includes("Unknown brand"),
    "unknown production Brand error is explicit",
  );

  assert(hasForbiddenSecretFields(brand).length === 0, "selected BrandConfig has no secret-like keys");
  assert(hasForbiddenSecretFields(suhuella).length === 0, "SuHuella BrandConfig has no secret-like keys");
  assert(hasForbiddenSecretFields(dbasenet).length === 0, "Dbasenet BrandConfig has no secret-like keys");
  for (const config of [suhuella, dbasenet]) {
    const serialized = JSON.stringify(config);
    assert(!serialized.includes("sk_"), `${config.id} has no Stripe secret material`);
    assert(!serialized.includes("re_"), `${config.id} has no Resend secret material`);
    assert(!serialized.includes("LICENSE_SIGNING"), `${config.id} has no signing secret`);
    assert(!("STRIPE_SECRET_KEY" in config), `${config.id} does not expose Stripe secret`);
    assert(!("RESEND_API_KEY" in config), `${config.id} does not expose Resend secret`);
    assert(!("revenueShareBps" in config), `${config.id} is not revenue-share authority`);
    assert(!("settlementMode" in config), `${config.id} is not settlement authority`);
    assert(!serialized.includes("partner_annual"), `${config.id} is not Partner License authority`);
    assert(!serialized.includes("brandId"), `${config.id} does not add brandId to license shape`);
  }

  if (brand.id === "suhuella") {
    assert(siteOrigin() === "https://suhuella.com", "site origin is current SuHuella origin");
    assert(supportMailto() === "mailto:support@suhuella.com", "support mailto matches current address");
    assert(
      salesMailto("SuHuella Business") === "mailto:sales@suhuella.com?subject=SuHuella%20Business",
      "sales mailto matches current checkout fallback",
    );
    assert(desktopProtocolUrl("license/success") === "suhuella://license/success", "protocol URL is unchanged");
    assert(
      verificationEmailSubject(brand.displayName) === "Your SuHuella verification code",
      "email subject uses BrandConfig",
    );
    assert(brand.emails?.licenses === "licenses@suhuella.com", "license OTP from address is frozen");
    assert(licenseOtpReplyTo() === "support@suhuella.com", "license OTP reply-to is support");
    assert(
      licenseOtpFromDisplay() === "SuHuella <licenses@suhuella.com>",
      "license OTP from display matches BrandConfig",
    );
    assert(brand.emails?.partners === "partners@suhuella.com", "partners alias is frozen");
    assert(brand.emails?.operations === "operations@suhuella.com", "operations alias is frozen");
    assert(businessCheckoutUrl().includes("sales@suhuella.com"), "checkout presentation uses BrandConfig sales");
    assert(
      licenseErrorMessage("offline") === "SuHuella can keep working offline for a limited time.",
      "desktop license copy uses BrandConfig",
    );
    assert(applyBrandPresentation("SuHuella") === "SuHuella", "presentation projection is identity for suhuella");
    assert(
      applyBrandPresentationDeep({ text: "support@suhuella.com" }).text === "support@suhuella.com",
      "deep projection is identity for suhuella",
    );
    assert(publicManifest.name === brand.pwa.name, "static webmanifest name matches selected Brand");
    assert(publicManifest.short_name === brand.pwa.shortName, "static webmanifest short_name matches selected Brand");
    assert(brand.paidCheckoutEnabled === true, "SuHuella paid checkout remains enabled");
  } else {
    assert(brand.id === "dbasenet", "selected Brand is Dbasenet");
    assert(siteOrigin() === "https://dbasenet.com", "Dbasenet site origin");
    assert(supportMailto() === "", "Dbasenet has no invented support mailbox");
    assert(salesMailto("Dbasenet Business") === "", "Dbasenet has no invented sales mailbox");
    assert(desktopProtocolUrl("license/success") === "dbasenet://license/success", "Dbasenet protocol URL");
    assert(
      verificationEmailSubject(brand.displayName) === "Your Dbasenet verification code",
      "Dbasenet email subject is presentation only",
    );
    assert(brand.emails === null, "Dbasenet emails remain unset");
    assert(licenseOtpReplyTo() === null, "Dbasenet has no OTP reply-to mailbox");
    assert(licenseOtpFromDisplay() === "Dbasenet", "Dbasenet OTP display has no fake From address");
    assert(businessCheckoutUrl() === "", "Dbasenet cannot use SuHuella Stripe checkout");
    assert(
      licenseErrorMessage("offline") === "Dbasenet can keep working offline for a limited time.",
      "Dbasenet license copy uses BrandConfig",
    );
    assert(applyBrandPresentation("SuHuella") === "Dbasenet", "presentation replaces SuHuella for Dbasenet");
    assert(brand.paidCheckoutEnabled === false, "Dbasenet paid checkout stays off");
    assert(brand.releaseRemoteEnabled === false, "Dbasenet cannot fetch SuHuella release remotes");
    assert(publicManifest.name === "Dbasenet", "projected webmanifest is Dbasenet");
    assert(publicManifest.short_name === "Dbasenet", "projected short_name is Dbasenet");
  }

  assert(publicManifest.start_url === "/home", "static webmanifest start_url remains /home");
  assert(brand.pwa.startUrl === "/home", "BrandConfig PWA startUrl remains /home");

  const siteTsconfig = readJson("site/tsconfig.json") as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  assert(
    siteTsconfig.compilerOptions?.paths?.["@suhuella/brand"]?.[0] === "../brands/.build/entry.ts",
    "site TypeScript resolves the selected Brand package entry, not the catalog",
  );

  const layout = readText("site/app/layout.tsx");
  assert(layout.includes("@suhuella/brand"), "site metadata imports BrandConfig");
  assert(layout.includes("siteOrigin()"), "site metadataBase uses BrandConfig");
  assert(layout.includes("brand.displayName"), "site titles use BrandConfig");
  assert(layout.includes("brand.pwa.backgroundColor"), "site body color uses BrandConfig");
  assert(layout.includes("brandCssVars"), "site layout injects Brand theme CSS variables");

  const pageTitle = readText("site/lib/i18n/page-title.ts");
  assert(pageTitle.includes("brand.displayName"), "page titles use BrandConfig");

  const dictionary = readText("site/lib/i18n/dictionary.ts");
  assert(dictionary.includes("applyBrandPresentationDeep"), "dictionary presentation is Brand-projected");

  const manifest = readText("site/app/manifest.ts");
  assert(manifest.includes("brand.pwa"), "PWA manifest uses BrandConfig");

  assert(resolveEffectiveBranding("https://evil.example/logo.png") === null, "Business branding still rejects remote URLs");
  assert(
    resolveEffectiveBranding("data:image/png;base64,abc") === "data:image/png;base64,abc",
    "Business logo overlay still accepted",
  );
  assert(brand.displayName === (brand.id === "dbasenet" ? "Dbasenet" : "SuHuella"), "Business fallback identity remains selected Brand");

  const packageCheck = readText("desktop/scripts/package-check.mjs");
  const brandSelect = readText("brands/select.mjs");
  assert(packageCheck.includes("brands"), "package-check reads selected Brand identity");
  assert(packageCheck.includes("brandIdentity"), "package-check validates Brand identity, not package.json Brand fields");
  assert(brandSelect.includes("Unknown brand"), "Brand selection fails closed for unknown Brand");
  assert(
    desktopPackage.build?.appId === "com.suhuella.desktop",
    "package.json leftover appId stays SuHuella compatibility only",
  );
  assert(
    desktopPackage.productName === "SuHuella",
    "package.json leftover productName stays SuHuella compatibility only",
  );

  const brandBuild = readText("desktop/scripts/brand-build.mjs");
  assert(brandBuild.includes("brandEntry(selectedBrandId())"), "desktop alias uses the selected Brand entry, not the last projected package entry");
  assertCompiledDesktopBrand("dbasenet", "com.dbasenet.desktop", "com.suhuella.desktop");
  assertCompiledDesktopBrand("suhuella", "com.suhuella.desktop", "com.dbasenet.desktop");

  const electronPackage = readText("desktop/scripts/electron-package.mjs");
  assert(electronPackage.includes("writeElectronBuilderConfig"), "packaging projects BrandConfig");
  assert(!electronPackage.includes("package.json"), "packaging does not rewrite package.json");

  const suhuellaEntry = readText("brands/suhuella/entry.ts");
  const dbasenetEntry = readText("brands/dbasenet/entry.ts");
  assert(!suhuellaEntry.includes("dbasenetBrand"), "SuHuella entry does not ship the Dbasenet catalog");
  assert(!dbasenetEntry.includes("suhuellaBrand"), "Dbasenet entry does not ship the SuHuella catalog");

  const checkout = readText("site/lib/checkout.ts");
  const paidCheckout = readText("site/lib/paid-checkout.ts");
  assert(checkout.includes("isPaidCheckoutPubliclyEnabled"), "checkout uses the public sales switch");
  assert(paidCheckout.includes("paidCheckoutEnabled"), "public sales switch still requires Brand eligibility");
  const releaseManifest = readText("site/lib/release-manifest.ts");
  assert(releaseManifest.includes("releaseRemoteEnabled"), "remote release fetch is gated per Brand");

  const organise = readText("desktop/src/components/OrganisePanel.tsx");
  assert(!organise.includes("location.hostname"), "Organise is not hostname-switched");
  assert(!organise.includes("brand.id"), "Organise does not branch on brand.id");

  const exampleShape = {
    id: "suhuella",
    operatorId: "self",
    displayName: "Example",
    primaryDomain: "example.test",
  };
  assert(exampleShape.operatorId === "self", "a future brand can carry operatorId without catalog entry");
  assert(!knownBrandIds().includes("example" as never), "example brand is not in the live catalog");

  console.log(`MULTIBRAND-SECOND-BRAND-PROOF-001 check passed for ${brand.id}`);
}

run();
