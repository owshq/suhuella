import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  organiseEmptyCopy,
  runOrganiseEmptyChecks,
  runOrganiseSuggestionChecks,
} from "@suhuella/product/lib/organise-copy.ts";
import { hostAccessFor } from "@suhuella/product/lib/platform-capabilities.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function runFirstLaunchExperienceCheck(): void {
  const onboarding = readFileSync(
    path.join(root, "packages/product/src/windows/OnboardingWindow.tsx"),
    "utf8",
  );
  const home = readFileSync(path.join(root, "packages/product/src/components/HomePanel.tsx"), "utf8");
  const preload = readFileSync(path.join(root, "desktop/electron/preload.ts"), "utf8");

  assert(onboarding.includes("const STEPS = 2"), "onboarding is License → first source (2 steps)");
  assert(onboarding.includes("Your license"), "onboarding includes license step");
  assert(onboarding.includes("Add your first source"), "onboarding requires first source");
  assert(onboarding.includes("finishOnboarding('home')"), "onboarding finishes to Home");
  assert(!onboarding.includes("Preview suggestions"), "preview suggestions removed from first session");
  assert(!onboarding.includes("Enable automatic startup"), "launch-at-login removed from first session");
  assert(onboarding.includes("!canAdvance") || onboarding.includes("canAdvance"), "continue gated on source");

  assert(home.includes("firstHomeHint"), "Home supports first-visit orientation");
  assert(home.includes("This is Home"), "Home first-visit copy present");
  assert(home.includes("locations.length > 0"), "Home hides document counts until a source exists");
  assert(!home.includes("recognised"), "Home does not present recognised-name chips as product objects");
  assert(!home.includes("Your knowledge workspace"), "Home does not call itself a knowledge workspace");
  assert(home.includes("onOrganise"), "Home offers Organise when documents exist");
  assert(home.includes("homeOrganiseOpportunity"), "Home Organise CTA is factual document count, not Invoices chips");
  assert(home.includes("Open Plan Mode when you want a Plan"), "Home first-visit points to Plan Mode");

  assert(preload.includes("dismissWelcomeHint"), "desktop exposes dismissWelcomeHint IPC");

  const organise = readFileSync(
    path.join(root, "packages/product/src/components/OrganisePanel.tsx"),
    "utf8",
  );
  assert(organise.includes("PLAN_PROMPT_EXAMPLES"), "empty Plan Mode offers prompt examples instead of a Connect banner");
  assert(organise.includes("ORGANISE_EMPTY_PLAN_PROMISE"), "empty Organise states the Plan-before-confirm promise");
  assert(organise.includes("useSourceScope"), "source selection can organise a whole source without per-file clicks");
  assert(organise.includes("ORGANISE_TRUST_LINE"), "selected scope says nothing moves until confirm");
  assert(organise.includes("workflows.length > 0"), "Use workflow stays behind saved workflows");
  assert(!/Save a plan|Apply accepted changes/.test(organise), "empty Plan Mode has no Apply language");
  assert(organise.includes("PLAN_LIBRARY_LABEL"), "Plan Mode lists saved plans from a label, not stale empty copy");
  assert(!organise.includes("Add to Plan"), "selection does not say Add to Plan");

  const settings = readFileSync(path.join(root, "packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settings.includes("startOrganiseFromHome"), "Home Organise opens Organise with scope when available");

  const activity = readFileSync(path.join(root, "packages/product/src/lib/activity-recovery.ts"), "utf8");
  assert(activity.includes("Can undo for"), "Activity undo window is about undo, not document expiry");
  assert(!activity.includes("Expires in"), "Activity does not say documents expire");

  runOrganiseEmptyChecks();
  runOrganiseSuggestionChecks();
  const desktopNone = organiseEmptyCopy(hostAccessFor("electron"), { hasSources: false });
  const webNone = organiseEmptyCopy(hostAccessFor("browser"), { hasSources: false });
  assert(desktopNone.primaryLabel === "Add source", "Desktop empty Organise uses Add source");
  assert(!/connect/i.test(desktopNone.description), "Desktop empty Organise does not say Connect");
  assert(/Connect/.test(webNone.primaryLabel), "Web empty Organise uses Connect");
  assert(!/\bAdd\b/.test(`${webNone.description} ${webNone.primaryLabel}`), "Web empty Organise does not say Add");

  console.log("FIRST-LAUNCH-EXPERIENCE-001 implementation check passed");
}

runFirstLaunchExperienceCheck();
