/**
 * LICENSE-COPY-AND-RIGHTS-AUDIT-001 — copy aligned with implemented rights.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activateDeviceCopy,
  commercialPlanCards,
  licenseJourneySteps,
  BUSINESS_DEVICE_LIMIT,
  MONTHLY_DEVICE_LIMIT,
  PERSONAL_DEVICE_LIMIT,
} from "../../packages/product/src/lib/license-plans.ts";
import { deviceLimitForEdition } from "./license-context.ts";
import { lifetimeUpgradeSaleEnabled, STRIPE_CATALOG } from "./stripe-catalog.ts";

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relative: string): string {
  return readFileSync(path.join(siteRoot, relative), "utf8");
}

function runLicenseCopyAuditCheck(): void {
  const wrangler = read("wrangler.jsonc");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "paid checkout is on");
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner checkout stays off");
  assert(lifetimeUpgradeSaleEnabled() === false, "lifetime upgrade sale stays closed");
  assert(STRIPE_CATALOG.lifetime_upgrade.checkoutEnabled === false, "lifetime upgrade catalog off");

  const en = commercialPlanCards("free", "public", "en");
  const es = commercialPlanCards("free", "public", "es");
  const lifetimeEn = en.find((plan) => plan.id === "lifetime");
  const monthlyEn = en.find((plan) => plan.id === "monthly");
  const businessEn = en.find((plan) => plan.id === "business");
  assert(lifetimeEn && monthlyEn && businessEn, "core plans present");

  const forbidden = /current version|latest version|unlimited update|unlimited upgrade|one device\.|upgrade/i;
  for (const plan of [...en, ...es]) {
    assert(!forbidden.test(plan.summary), `forbidden copy in ${plan.id}: ${plan.summary}`);
  }

  assert(lifetimeEn.summary !== monthlyEn.summary, "lifetime and monthly summaries differ");
  assert(lifetimeEn.features.length >= 3 && monthlyEn.features.length >= 3, "plans expose feature bullets");
  assert(
    monthlyEn.features.some((line) => /gmail|outlook/i.test(line)),
    "monthly features mention mail sources",
  );
  assert(
    !lifetimeEn.features.some((line) => /gmail|outlook/i.test(line)),
    "lifetime features do not claim mail sources",
  );
  assert(
    lifetimeEn.features.some((line) => /organis/i.test(line) && /confirm/i.test(line)),
    "lifetime features mention confirmed organisation",
  );
  assert(lifetimeEn.summary.toLowerCase().includes("subscription"), "lifetime mentions no subscription expiry");
  assert(monthlyEn.summary.toLowerCase().includes("subscri"), "monthly mentions subscription");
  assert(
    lifetimeEn.summary.toLowerCase().includes("active device"),
    "personal device limit copy reflects enforcement",
  );

  assert(
    deviceLimitForEdition("personal_lifetime") === PERSONAL_DEVICE_LIMIT,
    "server personal device limit",
  );
  assert(
    deviceLimitForEdition("personal_monthly") === MONTHLY_DEVICE_LIMIT,
    "monthly device limit",
  );
  assert(
    deviceLimitForEdition("business") === BUSINESS_DEVICE_LIMIT,
    "business default device limit",
  );
  assert(deviceLimitForEdition("business", 5) === 5, "business seat override respected");

  assert(licenseJourneySteps("en").length === 5, "journey separates five concepts");
  assert(
    licenseJourneySteps("en").some((step) => step.id === "payment" && step.detail.includes("does not activate")),
    "payment separated from activation",
  );
  assert(activateDeviceCopy("en").intro.includes("6-digit"), "OTP activation copy");

  const licensePanel = read("../packages/product/src/components/LicenseStatusPanel.tsx");
  assert(!licensePanel.includes("Current version"), "settings license has no version restriction copy");
  assert(!licensePanel.includes("Latest version"), "settings license has no latest version copy");
  assert(licensePanel.includes("activateDeviceCopy"), "settings uses shared activation copy");
  assert(
    !/StatusRows[\s\S]*label className="mt-4 block"[\s\S]*Email/.test(licensePanel),
    "email input is not in status block",
  );

  const licensePage = read("components/LicensePlansPage.tsx");
  assert(licensePage.includes("licenseJourneySteps"), "public license page shows journey");
  assert(licensePage.includes("PlanFeatureList"), "public license page renders plan feature bullets");
  assert(!licensePage.includes("planCopy("), "public page uses centralized plan copy");
  assert(licensePanel.includes("PlanFeatureList"), "settings license renders plan feature bullets");

  const plansSource = read("../packages/product/src/lib/license-plans.ts");
  assert(!plansSource.includes("lifetime_upgrade"), "no lifetime upgrade card in plan source");

  console.log("LICENSE-COPY-AND-RIGHTS-AUDIT-001 check passed");
}

runLicenseCopyAuditCheck();
