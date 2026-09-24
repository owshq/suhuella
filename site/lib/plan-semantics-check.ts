import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runActivityWhenChecks } from "@suhuella/product/lib/activity-when-check.ts";
import {
  organiseEmptyCopy,
  runOrganiseEmptyChecks,
  runOrganiseSuggestionChecks,
} from "@suhuella/product/lib/organise-copy.ts";
import { hostAccessFor } from "@suhuella/product/lib/platform-capabilities.ts";
import { runPlanExecutionPacingChecks } from "@suhuella/product/lib/plan-execution-pacing-check.ts";
import { runPlanPresentationChecks } from "@suhuella/product/lib/plan-presentation.ts";
import { runPlanSourceChecks } from "@suhuella/product/lib/plan-source.ts";
import { runPlanScopeChecks } from "@suhuella/product/lib/plan-scope.ts";
import { runLocalModelDiscoveryChecks } from "@suhuella/product/lib/local-model-discovery.ts";
import { runPlanComposerScopeChecks } from "@suhuella/product/lib/plan-composer-scope.ts";
import { runDocumentHintChecks } from "@suhuella/product/lib/document-hints.ts";
import { runPlanSourceCandidateChecks } from "@suhuella/product/lib/plan-source-candidate.ts";
import { runSavedPlanRecordChecks } from "@suhuella/product/lib/saved-plan.ts";
import { browserConnectDialogCopy } from "@suhuella/product/lib/sources-ui.ts";
import { toLicenseStatusView } from "@suhuella/product/lib/license-status.ts";
import {
  WORKFLOW_CATEGORIES,
  WORKFLOW_NAME_EXAMPLES,
  runWorkflowCopyChecks,
  workflowAutopilotLabel,
} from "@suhuella/product/lib/workflow-copy.ts";
import type { Workflow } from "@suhuella/product/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const OVERPROMISE =
  /\b(smart learning|autopilot|automatically organi\w+|watches folders|connector|template pack|business category|ai-powered organisation|teaches suhuella|suHuella learned)\b/i;

export function runPlanSemanticsCheck(): void {
  const home = read("packages/product/src/components/HomePanel.tsx");
  const organise = read("packages/product/src/components/OrganisePanel.tsx");
  const planLocalModelPicker = read("packages/product/src/components/PlanLocalModelPicker.tsx");
  const preferences = read("packages/product/src/components/PreferencesPanel.tsx");
  const workflowsList = read("packages/product/src/components/WorkflowsList.tsx");
  const recommendations = read("packages/product/src/host/browser/recommendations.ts");
  const settings = read("packages/product/src/windows/SettingsWindow.tsx");

  assert(!home.includes("recognised"), "Home must not show recognised-name chips");
  assert(!/Your knowledge workspace|Knowledge quality|Invoices · Clients/i.test(home), "Home must not present a knowledge taxonomy");
  assert(home.includes("homeOrganiseOpportunity"), "Home offers a factual Organise action when documents exist");
  assert(settings.includes("startOrganiseFromHome"), "Home routes to Organise with scope prepared");

  assert(organise.includes("previewOrganisationPlan"), "Plan preview stays separate from execution");
  assert(organise.includes("confirmed: true"), "execution requires explicit confirmation");
  assert(!organise.includes("confirmed: false"), "Organise must not execute without confirmation");
  assert(organise.includes("PLAN_PROMPT_ACTIONS"), "Plan Mode offers Prepare Plan actions");
  assert(!organise.includes("PLAN_PROMPT_EXAMPLES.map"), "Prepare Plan actions are not a plain example list");
  assert(organise.includes("plan.items.map"), "saved Plan Run restores stored plan items");
  assert(!organise.includes("await addItems(plan.knowledgeSet.items)"), "saved Plan Run does not re-analyse from scratch");
  assert(!organise.includes("FeaturePromoCard"), "Plan Mode empty state does not block on Connect source banner");
  assert(organise.includes("PLAN_PROMPT_PLACEHOLDER"), "Plan Mode composer stays anchored to the screen question");
  assert(!organise.includes("ORGANISE_EMPTY_PLAN_PROMISE"), "Plan promise lives in the composer placeholder, not a second line");
  assert(organise.includes("resolvePlanComposerScope"), "Plan Mode resolves scope and candidate sources together");
  assert(organise.includes("PlanLocalModelPicker"), "Plan Mode composes local model discovery inline");
  assert(planLocalModelPicker.includes("PLAN_MODEL_MANUAL_TOGGLE"), "Plan Mode keeps manual local connection as advanced path");
  assert(planLocalModelPicker.includes("PLAN_MODEL_DETECTED_SUFFIX"), "Plan Mode labels detected local models distinctly");
  assert(!organise.includes('value="settings"'), "Plan Mode does not route local models only through Settings");
  assert(organise.includes("ORGANISE_TRUST_LINE"), "selected scope stays pre-execution");
  assert(!/WORKFLOW_CATEGORIES/.test(organise), "Organise must not expose reserved workflow categories");
  assert(!/WORKFLOW_CATEGORIES/.test(workflowsList), "workflow list must not expose category pickers");

  assert(!OVERPROMISE.test(preferences), "Settings AI copy must not overpromise learning or autopilot");
  assert(
    preferences.includes("BYOK_OPTIONAL_NOTE") || preferences.includes("Core organisation works without connecting an AI provider"),
    "Settings states BYOK is optional",
  );
  assert(!preferences.includes("Recommendation Engine"), "Settings must not expose engine internals");

  assert(!/\blearn from\b/i.test(browserConnectDialogCopy("en").body), "browser connect must not say learn from");
  assert(!/\blearn from\b/i.test(browserConnectDialogCopy("es").body), "Spanish connect must not say aprender de");

  const license = toLicenseStatusView(
    {
      licenseId: "test",
      customerId: "test",
      email: "test@example.com",
      edition: "personal",
      status: "active",
      capabilities: [],
      enabledKnowledgeSources: [],
      deviceLimit: 2,
      activatedDevices: 1,
      validUntil: null,
      lastCheckedAt: new Date().toISOString(),
      offlineUntil: new Date().toISOString(),
      channel: "stable",
      licenseToken: "token",
    },
    { learningOk: true },
  );
  assert(
    license.health.some((item) => item.id === "learning" && item.label === "Sources"),
    "license health uses Sources, not Learning",
  );
  assert(!license.health.some((item) => item.label === "Learning"), "Learning must not appear in license health");

  assert(WORKFLOW_NAME_EXAMPLES.every((example) => !/\b(invoices|clients|finance|receipts)\b/i.test(example)), "workflow examples avoid vertical categories");
  assert(workflowAutopilotLabel({ autopilotEnabled: true, approvedPlan: { items: [] } } as Workflow) === null, "autopilot is not a product surface");
  assert(WORKFLOW_CATEGORIES.length > 0, "categories stay reserved internally only");

  assert(recommendations.includes("Never uses BYOK"), "Recommendation engine stays independent of BYOK");

  runOrganiseEmptyChecks();
  runSavedPlanRecordChecks();
  runPlanScopeChecks();
  runPlanSourceChecks();
  runLocalModelDiscoveryChecks();
  runPlanSourceCandidateChecks();
  runPlanComposerScopeChecks();
  runDocumentHintChecks();
  runOrganiseSuggestionChecks();
  runPlanPresentationChecks();
  runPlanExecutionPacingChecks();
  runWorkflowCopyChecks();
  runActivityWhenChecks();

  const desktopReady = organiseEmptyCopy(hostAccessFor("electron"), { hasSources: true });
  assert(/Plan/.test(desktopReady.description) && /confirm/i.test(desktopReady.description), "empty Organise explains Plan before confirm");

  console.log("PLAN-SEMANTICS-001 product contract check passed");
}

runPlanSemanticsCheck();
