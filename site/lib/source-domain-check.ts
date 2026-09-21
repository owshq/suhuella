import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bindSourceHandle, replaceSourceHandle } from "@suhuella/product/lib/source-handle.ts";
import { renameSource, sourceId } from "@suhuella/product/lib/source-identity.ts";
import { sourceRecommendedAction } from "@suhuella/product/lib/source-actions.ts";
import { sourceCapabilities } from "@suhuella/product/lib/source-capabilities.ts";
import { sourceAccessState, UnknownHostStatusError } from "@suhuella/product/lib/source-host-vocabulary.ts";
import {
  shouldRecordSourceTransition,
  sourceTransitionKind,
} from "@suhuella/product/lib/source-lifecycle.ts";
import { buildSourcePresentation, sourceActionLabel } from "@suhuella/product/lib/source-presentation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runSourceDomainCheck(): void {
  assert(sourceAccessState("ready") === "indexed", "host ready maps to indexed");
  assert(sourceAccessState("needs_permission") === "permission_required", "permission maps to token");
  assert(sourceAccessState("indexed") === "indexed", "canonical status is idempotent");
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let unknownHostStatusThrows = false;
  try {
    sourceAccessState("almost_ready");
  } catch (error) {
    unknownHostStatusThrows = error instanceof UnknownHostStatusError;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
  assert(unknownHostStatusThrows, "unknown host status throws in development");
  assert(sourceRecommendedAction("missing") === "locate_folder", "domain recommends an action token");
  assert(sourceRecommendedAction("permission_required") === "restore_permission", "permission recommends restore token");

  assert(
    sourceTransitionKind({ from: "indexed", to: "permission_required", sourceName: "Facturas 2026" }) ===
      "permission_lost",
    "domain records permission_lost, not English",
  );
  assert(
    sourceTransitionKind({ from: null, to: "indexed", sourceName: "Facturas 2026" }) === "source_connected",
    "first connect is source_connected",
  );
  assert(shouldRecordSourceTransition("indexed", "missing"), "first loss is a transition");
  assert(!shouldRecordSourceTransition("missing", "missing"), "same state is not a transition");
  assert(!shouldRecordSourceTransition("indexing", "indexed"), "scan completion is not a transition");

  const unavailable = sourceCapabilities("unavailable");
  assert(unavailable.searchable, "documents remain searchable when the handle is gone");
  assert(!unavailable.openable, "unavailable sources are not openable");
  assert(!unavailable.organisable, "unavailable sources are not organisable");
  assert(unavailable.reconnectable, "unavailable sources can reconnect");
  assert(unavailable.removable, "user can still remove");

  const indexed = sourceCapabilities("indexed");
  assert(indexed.openable && indexed.organisable, "indexed sources can open and organise");
  assert(!indexed.reconnectable, "indexed sources do not ask to reconnect");

  const presentation = buildSourcePresentation({
    id: "src_facturas",
    displayName: "Facturas 2026",
    locationStatus: "permission_denied",
    documentCount: 147,
    lastIndexedAt: "2026-09-18T10:00:00.000Z",
    lastCheckedAt: "2026-09-19T16:00:00.000Z",
  });
  assert(presentation.id === "src_facturas", "presentation keeps the immutable source id");
  assert(presentation.capabilities.organisable === false, "presentation carries derived capabilities");
  assert(presentation.actions.includes("restore_permission"), "presentation exposes action tokens");
  assert(sourceActionLabel("restore_permission") === "Restore permission", "copy lives in presentation");

  const lifecycle = readFileSync(join(process.cwd(), "../packages/product/src/lib/source-lifecycle.ts"), "utf8");
  assert(!lifecycle.includes("Restore permission"), "domain does not speak button copy");
  assert(!lifecycle.includes("Source connected"), "domain does not speak Activity titles");
  assert(!lifecycle.includes("Locate again"), "domain does not speak locate copy");

  const capabilitiesModule = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-capabilities.ts"),
    "utf8",
  );
  assert(!capabilitiesModule.includes("Restore permission"), "capabilities module stays token-only");

  const store = readFileSync(join(process.cwd(), "../packages/product/src/host/browser/store.ts"), "utf8");
  assert(store.includes("never mints a new id"), "reconnect keeps identity");
  const restoreBlock =
    store.match(/export async function restoreSourceAccess[\s\S]*?(?=\nexport async function)/)?.[0] ?? "";
  assert(restoreBlock.length > 0, "restoreSourceAccess exists");
  assert(!restoreBlock.includes("createId("), "restore does not mint a new Source ID");

  const organise = readFileSync(
    join(process.cwd(), "../packages/product/src/components/OrganisePanel.tsx"),
    "utf8",
  );
  assert(organise.includes("capabilities.organisable"), "Organise asks capabilities, not status");
  assert(!organise.includes("sourceIsAccessible"), "Organise no longer inspects lifecycle status");

  const sources = readFileSync(
    join(process.cwd(), "../packages/product/src/components/SourcesPanel.tsx"),
    "utf8",
  );
  assert(sources.includes("buildSourcePresentation") || sources.includes("location.presentation"), "Sources consumes presentation");
  assert(!sources.includes("sourceAccessState"), "Sources does not derive lifecycle state");

  const domainModel = readFileSync(join(process.cwd(), "../SOURCE-DOMAIN-MODEL-001.md"), "utf8");
  assert(domainModel.includes("FROZEN · CORE"), "domain contract is frozen");
  assert(domainModel.includes("Architecture Validation Rule"), "domain contract names validation rule");
  assert(domainModel.includes("cannot be solved in the adapter"), "domain changes require adapter exhaustion proof");
  assert(domainModel.includes("Amend the Constitution"), "domain changes amend constitution after ADR");
  assert(domainModel.includes("Google Drive is the strongest proof"), "validation names cloud as hard case");
  assert(domainModel.includes("Post-freeze discipline"), "domain contract defines adapter-first discipline");
  assert(domainModel.includes("Does this belong to the domain"), "domain contract asks domain vs adapter");

  const guard = readFileSync(join(process.cwd(), "../.cursor/rules/source-domain-guard.mdc"), "utf8");
  assert(guard.includes("SourcePresentation"), "cursor guard requires SourcePresentation");
  assert(guard.includes("alwaysApply: false"), "cursor guard stays minimal");

  const identity = sourceId("src_facturas");
  const renamed = renameSource({ id: identity, displayName: "Facturas 2026" }, "Facturas 2027");
  assert(renamed.id === identity, "rename keeps the Source id");
  const replaced = replaceSourceHandle(
    { sourceId: identity, permission: "denied", adapterId: "browser", contractVersion: 1 },
    { permission: "granted", adapterId: "browser" },
  );
  assert(replaced.sourceId === identity, "replacing a Handle keeps the Source id");
  assert(replaced.permission === "granted", "replacing a Handle swaps permission");
  assert(replaced.contractVersion === 1, "replacing a Handle keeps contractVersion");
  let rejected = false;
  try {
    bindSourceHandle(renamed, {
      sourceId: sourceId("src_other"),
      permission: "granted",
      adapterId: "browser",
      contractVersion: 1,
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "a Handle cannot bind to a different Source");

  assert(!lifecycle.includes("export type SourceHandle"), "lifecycle does not own Handle");
  assert(!lifecycle.includes("export type SourceHealth"), "lifecycle does not own Health");
  assert(!lifecycle.includes("IndexedLocationStatus"), "lifecycle does not import host status");
  const vocabulary = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-host-vocabulary.ts"),
    "utf8",
  );
  assert(!vocabulary.includes("availabilityReasonForStatus"), "vocabulary does not infer health reasons");
  assert(vocabulary.includes("UnknownHostStatusError"), "vocabulary rejects unknown host words in development");
  const bridge = readFileSync(
    join(process.cwd(), "../packages/product/src/host/handle-lifecycle-bridge.ts"),
    "utf8",
  );
  assert(bridge.includes("availabilityReasonForStatus"), "health fallback lives in the handle-lifecycle bridge");
  const adapter = readFileSync(
    join(process.cwd(), "../packages/product/src/host/browser/source-adapter.ts"),
    "utf8",
  );
  assert(adapter.includes("projectBrowserSource"), "browser projection is the adapter factory");
  assert(adapter.includes("contractVersion"), "projection writes Handle contractVersion");
  const presentationModule = readFileSync(
    join(process.cwd(), "../packages/product/src/lib/source-presentation.ts"),
    "utf8",
  );
  assert(presentationModule.includes("never persisted"), "presentation is documented as ephemeral");
  const handleModule = readFileSync(join(process.cwd(), "../packages/product/src/lib/source-handle.ts"), "utf8");
  assert(!handleModule.includes("dropbox"), "Handle does not enumerate providers");
  assert(handleModule.includes("contractVersion"), "Handle carries contractVersion");
  const identityModule = readFileSync(join(process.cwd(), "../packages/product/src/lib/source-identity.ts"), "utf8");
  assert(!identityModule.includes("source-lifecycle"), "identity does not import lifecycle");
  assert(!identityModule.includes("source-presentation"), "identity does not import presentation");

  console.log("SOURCE-DOMAIN-MODEL-001 check passed");
}

runSourceDomainCheck();
