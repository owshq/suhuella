import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  homeOrganiseOpportunity,
  homeOrganiseScope,
} from "@suhuella/product/lib/home-organise.ts";
import {
  ORGANISE_TRUST_LINE,
  organiseEmptyCopy,
  runOrganiseEmptyChecks,
} from "@suhuella/product/lib/organise-copy.ts";
import { hostAccessFor } from "@suhuella/product/lib/platform-capabilities.ts";
import { sourceSightLabel } from "@suhuella/product/lib/sources-ui.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

export function runFirstRunUxCheck(): void {
  const home = read("packages/product/src/components/HomePanel.tsx");
  const organise = read("packages/product/src/components/OrganisePanel.tsx");
  const plan = read("packages/product/src/components/PlanEditor.tsx");
  const sources = read("packages/product/src/components/SourcesPanel.tsx");
  const settings = read("packages/product/src/windows/SettingsWindow.tsx");
  const recommendations = read("packages/product/src/host/browser/recommendations.ts");

  assert(home.includes("Connect a source") && home.includes("Add a source"), "no-source Home has one Add/Connect path");
  assert(!home.includes("recognised"), "Home does not show recognised-name taxonomy");
  assert(home.includes("homeOrganiseOpportunity"), "source-ready Home offers Organise");
  assert(home.includes("Create a Plan"), "empty Home explains the next action, not architecture");
  assert(!/BYOK|OpenAI|Anthropic|workflow categor/i.test(home), "Home first-run does not expose AI or workflow setup");

  const single = homeOrganiseScope([
    { path: "/Users/demo/Downloads", name: "Downloads", fileCount: 18, status: "ready", exists: true },
  ]);
  assert(single?.name === "Downloads", "one ready source becomes Home scope");
  const opportunity = homeOrganiseOpportunity(18, single?.name ?? null);
  assert(opportunity?.line.includes("Downloads"), "Home recommendation names the real scope");
  assert(opportunity?.actionLabel === "Plan Downloads", "Home CTA carries the scope name");
  assert(homeOrganiseOpportunity(0) === null, "Home does not invent an Organise action without documents");
  assert(
    homeOrganiseScope([
      { path: "/a", name: "Downloads", fileCount: 10, status: "ready", exists: true },
      { path: "/b", name: "Documents", fileCount: 8, status: "ready", exists: true },
    ]) === null,
    "multiple sources do not invent a fake Home scope",
  );

  assert(settings.includes("startOrganiseFromHome"), "Home action can write pending Organise scope");
  assert(settings.includes("buildPendingOrganiseContext"), "Home reuses the existing Organise bridge");

  const desktopNone = organiseEmptyCopy(hostAccessFor("electron"), { hasSources: false });
  const desktopReady = organiseEmptyCopy(hostAccessFor("electron"), { hasSources: true });
  const webNone = organiseEmptyCopy(hostAccessFor("browser"), { hasSources: false });
  const webReady = organiseEmptyCopy(hostAccessFor("browser"), { hasSources: true });
  assert(desktopNone.primaryKind === "add_source", "Organise distinguishes no Source");
  assert(desktopReady.primaryKind === "open_sources", "Desktop Organise with sources opens Sources");
  assert(webNone.primaryKind === "add_source", "Web Organise with no Source points to Connect");
  assert(webReady.primaryKind === "select_from_sources", "Web Organise with sources asks for scope");
  assert(webReady.description.includes("Choose a source"), "Web empty Organise is scope-first");
  assert(organise.includes("useSourceScope"), "valid source selection can create a Plan without 20 clicks");
  assert(organise.includes("previewOrganisationPlan"), "valid selection generates a Plan");
  assert(organise.includes("confirmed: true"), "Plan generation does not execute");
  assert(recommendations.includes("Never uses BYOK"), "Plan generation does not require BYOK");
  assert(!/WORKFLOW_CATEGORIES|Autopilot on/.test(organise), "first-run Organise does not expose workflow categories or autopilot");

  assert(plan.includes("ORGANISE_TRUST_LINE"), "Plan states nothing moves before confirmation");
  assert(ORGANISE_TRUST_LINE === "Nothing moves until you confirm.", "trust sentence stays explicit");

  assert(sourceSightLabel("coming_later") === "Coming later", "future cloud Sources stay Coming later");
  assert(sources.includes('sight="coming_later"'), "cloud catalog is non-actionable");
  assert(sources.includes("aria-disabled={sight === 'coming_later'"), "coming-later cards expose disabled semantics");
  assert(!sources.includes("browserIntegrationsActionLabel"), "empty Sources does not promote Integrations as a first-run CTA");
  assert(sources.includes("Coming later"), "unavailable cloud is labelled Coming later");

  runOrganiseEmptyChecks();
  console.log("FIRST-RUN-UX-001 product contract check passed");
}

runFirstRunUxCheck();
