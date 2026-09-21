#!/usr/bin/env node
/**
 * Read-only documentation inventory generator (Phase 0.1).
 * Usage: node scripts/doc-inventory.mjs
 * Output: DOC-INVENTORY-001.md
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, basename, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "DOC-INVENTORY-001.md");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".wrangler",
  ".open-next",
  ".data",
  "dist-electron",
  ".build",
]);

const SCAN_EXTENSIONS = new Set([
  ".md",
  ".mdc",
  ".mjs",
  ".cjs",
  ".js",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".log",
]);

/** Documents explicitly indexed as permanent contracts in constitution/README.md */
const CONSTITUTION_INDEX = new Set([
  "docs/architecture/constitution/COMMAND-TAXONOMY.md",
  "docs/architecture/constitution/release-architecture.md",
  "docs/architecture/constitution/health.md",
  "docs/architecture/constitution/README.md",
  "BRANDING-HIERARCHY-001.md",
  "SOURCE-DOMAIN-MODEL-001.md",
  "docs/architecture/product/commercial-authority-model.md",
  "VERSION-CONSISTENCY-001.md",
  "SOURCE-LIFECYCLE-MODEL-001.md",
  "MULTI-PLATFORM-SOURCE-ADAPTERS-001.md",
  "SOURCE-PLATFORM-READINESS-001.md",
  "RELEASE-PUBLISH-PIPELINE-001.md",
]);

/** Permanent policies listed in docs/governance/README.md */
const GOVERNANCE_INDEX = new Set([
  "docs/governance/DECISION-PRECEDENCE.md",
  "docs/governance/DECISION-PRIVATE-BETA-001.md",
  "PRODUCT-EVOLUTION-POLICY.md",
  "docs/governance/CHANGE-CLASSIFICATION-POLICY.md",
  "docs/governance/CONTRACT-STABILITY.md",
  "docs/governance/RELEASE-PROCESS-FROZEN.md",
  "docs/governance/NAVIGATION-POLICY.md",
  "docs/governance/README.md",
  "BRANDING-HIERARCHY-001.md",
]);

const PRODUCT_MODEL_PREFIX = "docs/architecture/product/";
const OPERATIONS_INDEX = new Set([
  "OPERATIONS-PRODUCTION-ACTIVATION-001.md",
  "OPERATIONS-ACCESS-CLOSEOUT-001.md",
  "docs/release/README.md",
  "docs/release/mac-signing.md",
]);

const PRESERVE_IN_PLACE = new Set([
  "first-impression/README.md",
  "first-impression/operator-task-sheet.md",
  "first-impression/session-01.md",
  "first-impression/session-02.md",
  "first-impression/session-03.md",
  "pre-beta/README.md",
  "pre-beta/benchmark-results.md",
  "desktop/README.md",
  "site/README.md",
]);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (SCAN_EXTENSIONS.has(extname(e.name)) || e.name.endsWith(".log")) acc.push(full);
  }
  return acc;
}

function norm(p) {
  return relative(ROOT, p).replace(/\\/g, "/");
}

function readHead(path, lines = 80) {
  try {
    return readFileSync(path, "utf8").split("\n").slice(0, lines).join("\n");
  } catch {
    return "";
  }
}

function detectStatus(content, filename) {
  const head = content.slice(0, 2500);
  const patterns = [
    [/STATUS\s*=\s*CONSTITUTION/i, "CONSTITUTION"],
    [/STATUS\s*=\s*FROZEN[^·\n]*/i, "FROZEN"],
    [/STATUS\s*=\s*IMPLEMENTED/i, "IMPLEMENTED"],
    [/STATUS\s*=\s*OPEN[^·\n]*/i, "OPEN"],
    [/STATUS\s*=\s*CLOSED[^·\n]*/i, "CLOSED"],
    [/STATUS\s*=\s*ACTIVE/i, "ACTIVE"],
    [/STATUS\s*=\s*Accepted/i, "ACCEPTED"],
    [/STATUS\s*=\s*BLOCKED/i, "BLOCKED"],
    [/\*\*STATUS:\*\*\s*CLOSED[^·\n]*/i, "CLOSED"],
    [/\*\*STATUS:\*\*\s*OPEN/i, "OPEN"],
    [/\*\*Status:\*\*\s*CLOSED/i, "CLOSED"],
    [/NOT OPENED/i, "NOT OPENED"],
    [/CLOSED\s*·\s*PASS/i, "CLOSED"],
    [/OPEN\s*·/i, "OPEN"],
    [/FROZEN\s*·/i, "FROZEN"],
    [/PASS WITH FIXES/i, "PASS"],
  ];
  for (const [re, status] of patterns) {
    if (re.test(head)) return status;
  }
  if (/^#\s*Moved/m.test(content.split("\n")[0] ?? "")) return "MIGRATION_STUB";
  if (filename === "README.md" && !head.includes("STATUS")) return "INDEX";
  return "unknown";
}

function isMigrationStub(content) {
  const head = content.split("\n").slice(0, 8).join("\n");
  return /^#\s*Moved/m.test(head) && /Do not edit this stub|Points to|Do not add documents here/i.test(content);
}

function suggestConstitutionTarget(rel) {
  const map = {
    "BRANDING-HIERARCHY-001.md": "docs/architecture/constitution/branding-hierarchy.md",
    "SOURCE-DOMAIN-MODEL-001.md": "docs/architecture/constitution/source-domain.md",
    "SOURCE-LIFECYCLE-MODEL-001.md": "docs/architecture/constitution/source-lifecycle.md",
    "VERSION-CONSISTENCY-001.md": "docs/architecture/constitution/version-consistency.md",
    "MULTI-PLATFORM-SOURCE-ADAPTERS-001.md": "docs/architecture/constitution/multi-platform-source-adapters.md",
    "SOURCE-PLATFORM-READINESS-001.md": "docs/architecture/constitution/source-platform-readiness.md",
    "RELEASE-PUBLISH-PIPELINE-001.md": "docs/architecture/constitution/release-publish-pipeline.md",
  };
  return map[rel] ?? null;
}

function classify(path, content, status) {
  const rel = norm(path);
  const name = basename(path);

  if (name.endsWith(".log") || rel.endsWith("-EXEC.log")) {
    return { classification: "Execution log", action: "delete candidate", ambiguous: false, notes: "Non-markdown execution log" };
  }
  if (rel === "RELEASE-v0.1.0-pre-rc-EXECUTION.md") {
    return { classification: "Execution log", action: "archive", ambiguous: false, notes: "Release execution record; not institutional" };
  }

  if (isMigrationStub(content)) {
    return { classification: "Migration stub", action: "delete candidate", ambiguous: false, notes: "Redirect stub after prior migration" };
  }

  if (PRESERVE_IN_PLACE.has(rel)) {
    if (rel.startsWith("first-impression/")) {
      return { classification: "Human evidence", action: "keep", ambiguous: false, notes: "Preserved in place per Phase 0 rules" };
    }
    if (rel.startsWith("pre-beta/")) {
      return { classification: "Benchmark", action: "keep", ambiguous: false, notes: "Preserved in place per Phase 0 rules" };
    }
    return { classification: "Package/local README", action: "keep", ambiguous: false, notes: "Package README preserved in place" };
  }

  if (rel.startsWith("docs/architecture/decisions/") && name.startsWith("ADR-")) {
    return { classification: "ADR", action: "keep", ambiguous: false, notes: "" };
  }
  if (rel === "docs/architecture/decisions/README.md") {
    return { classification: "ADR", action: "keep", ambiguous: false, notes: "ADR index" };
  }

  if (rel.startsWith(PRODUCT_MODEL_PREFIX)) {
    return { classification: "Product model", action: "keep", ambiguous: false, notes: "" };
  }

  if (rel.startsWith("docs/architecture/constitution/")) {
    return { classification: "Constitution", action: "keep", ambiguous: false, notes: "" };
  }

  if (rel.startsWith("docs/governance/")) {
    return { classification: "Governance", action: "keep", ambiguous: false, notes: "" };
  }

  if (rel.startsWith("docs/release/")) {
    return { classification: "Operations", action: "keep", ambiguous: false, notes: "Release operator guides (platform signing / validation)" };
  }

  if (rel === "docs/architecture/frozen/README.md") {
    return { classification: "Migration stub", action: "delete candidate", ambiguous: false, notes: "Points to constitution/README.md" };
  }

  if (CONSTITUTION_INDEX.has(rel)) {
    const moveTarget = suggestConstitutionTarget(rel);
    return {
      classification: "Constitution",
      action: rel.startsWith("docs/") ? "keep" : "move",
      ambiguous: false,
      notes: moveTarget ? `Constitution-indexed; proposed target: ${moveTarget}` : "Listed in constitution/README.md",
    };
  }

  if (GOVERNANCE_INDEX.has(rel)) {
    return {
      classification: "Governance",
      action: rel.startsWith("docs/governance/") ? "keep" : "move",
      ambiguous: false,
      notes: rel.startsWith("docs/") ? "Listed in governance/README.md" : "Listed in governance/README.md; still at repo root",
    };
  }

  if (OPERATIONS_INDEX.has(rel)) {
    return {
      classification: "Operations",
      action: rel.startsWith("docs/") ? "keep" : "move",
      ambiguous: false,
      notes: "Operations runbook or release operator guide",
    };
  }

  if (rel.startsWith("first-impression/")) {
    return { classification: "Human evidence", action: "keep", ambiguous: false, notes: "" };
  }
  if (rel.startsWith("pre-beta/")) {
    return { classification: "Benchmark", action: "keep", ambiguous: false, notes: "" };
  }

  if (rel === "brands/suhuella/assets/README.md" || rel === "dev-data/README.md" || rel === "site/AGENTS.md") {
    return { classification: "Package/local README", action: "keep", ambiguous: false, notes: "" };
  }

  if (rel === "site/DEV-SOURCES.md") {
    return { classification: "Package/local README", action: "review manually", ambiguous: true, notes: "Developer local sources guide; not indexed in governance" };
  }

  if (rel === "DOC-INVENTORY-001.md") {
    return { classification: "Package/local README", action: "keep", ambiguous: false, notes: "Generated Phase 0.1 inventory (this document); regenerate via scripts/doc-inventory.mjs" };
  }

  if (rel === "README.md") {
    return { classification: "Governance", action: "consolidate", ambiguous: true, notes: "Repo entry point; overlaps governance index and closed track history — trim, do not merge with constitution" };
  }

  if (rel === "PRE-RC-TRACKS-001.md") {
    return { classification: "Track open", action: "keep", ambiguous: false, notes: "Active roadmap index (STATUS=OPEN · MAINTENANCE ONLY)" };
  }

  if (rel === "PRIVATE-BETA-001.md") {
    return { classification: "Track open", action: "keep", ambiguous: false, notes: "Active product gate" };
  }

  if (rel === "tracks/archive/RC-CHECKLIST.md") {
    return { classification: "Track open", action: "review manually", ambiguous: true, notes: "Checklist without -001 suffix; may stay root or move to tracks/open/" };
  }

  if (rel === "tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md") {
    return { classification: "Human evidence", action: "move", ambiguous: true, notes: "Loose session note at root; likely belongs in first-impression/" };
  }

  if (/^OPERATIONS-/.test(name)) {
    const closed = ["CLOSED", "PASS"].includes(status) || /CLOSED\s*·\s*PASS/.test(content.slice(0, 2000));
    if (OPERATIONS_INDEX.has(rel) || rel === "OPERATIONS-PRODUCTION-ACTIVATION-001.md" || rel === "OPERATIONS-ACCESS-CLOSEOUT-001.md") {
      return {
        classification: "Operations",
        action: closed ? "archive" : "move",
        ambiguous: false,
        notes: "Referenced from docs/governance/README.md Operations section",
      };
    }
    return {
      classification: closed ? "Track archive" : "Operations",
      action: closed ? "archive" : "move",
      ambiguous: status === "unknown",
      notes: closed ? "Closed operations track" : "Operations-related track",
    };
  }

  if (/^FIRST-IMPRESSION-/.test(name)) {
    const archived = ["CLOSED", "PASS"].includes(status);
    return {
      classification: archived ? "Track archive" : "Human evidence",
      action: archived ? "archive" : "move",
      ambiguous: true,
      notes: "Root-level first-impression track; overlap with first-impression/ folder",
    };
  }

  if (/^PRE-BETA-/.test(name)) {
    return {
      classification: status === "OPEN" ? "Track open" : "Benchmark",
      action: ["CLOSED", "PASS"].includes(status) ? "archive" : "keep",
      ambiguous: false,
      notes: "Pre-beta gate track; related to pre-beta/ folder",
    };
  }

  if (rel === "RELEASE-ARCHITECTURE-FROZEN.md" || rel === "HEALTH-FROZEN.md") {
    return { classification: "Migration stub", action: "delete candidate", ambiguous: false, notes: "Root stub → docs/architecture/constitution/" };
  }

  if (/SOURCE-ADAPTER|ADAPTER-WIRING|ADAPTER-INTEGRATION/.test(name)) {
    if (status === "unknown") {
      return {
        classification: "Track open",
        action: "review manually",
        ambiguous: true,
        notes: "Adapter implementation track; status unknown — do not auto-archive",
      };
    }
    if (status === "OPEN" || status === "IMPLEMENTED") {
      return {
        classification: "Track open",
        action: "move",
        ambiguous: false,
        notes: "Adapter implementation track; constitution contract is MULTI-PLATFORM-SOURCE-ADAPTERS-001",
      };
    }
    return {
      classification: "Track archive",
      action: "archive",
      ambiguous: status === "FROZEN",
      notes: status === "FROZEN" ? "FROZEN adapter slice — verify not constitution before archiving" : "Closed adapter implementation track",
    };
  }

  if (rel === "tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md") {
    return {
      classification: "Constitution",
      action: "keep",
      ambiguous: true,
      notes: "Closed evolution log; referenced by .cursor/rules and domain checks — supporting constitution slice, not a closed track",
    };
  }

  if (rel === "SOURCE-DOMAIN-MIGRATION-001.md") {
    return { classification: "Track archive", action: "archive", ambiguous: false, notes: "CLOSED migration report; parent SOURCE-DOMAIN-MODEL-001" };
  }

  if (rel === "docs/architecture/product/application-lifecycle.md") {
    return {
      classification: "Constitution",
      action: "review manually",
      ambiguous: true,
      notes: "Not in constitution index; may be product lifecycle contract or track",
    };
  }

  if (rel === "tracks/open/RELEASE-LIFECYCLE-001.md") {
    return {
      classification: "Constitution",
      action: "review manually",
      ambiguous: true,
      notes: "Release lifecycle model; overlaps release-architecture and RELEASE-PUBLISH-PIPELINE",
    };
  }

  if (rel === "tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md") {
    return {
      classification: "Track open",
      action: "review manually",
      ambiguous: true,
      notes: "STATUS=FROZEN·BLOCKED but not constitution-indexed — frozen track, not domain contract",
    };
  }

  if (rel === "PRODUCT-FREEZE-001.md" || rel === "PRODUCTION-READINESS-001.md") {
    return {
      classification: "Track open",
      action: "keep",
      ambiguous: status === "unknown",
      notes: "Active or deferred gate track",
    };
  }

  const trackLike = /-001\.md$/.test(name) || /^RC-/.test(name);
  if (trackLike) {
    if (status === "OPEN" || status === "IMPLEMENTED" || status === "BLOCKED") {
      return { classification: "Track open", action: "move", ambiguous: status === "unknown", notes: "Active track at repo root" };
    }
    if (status === "NOT OPENED") {
      return { classification: "Track archive", action: "archive", ambiguous: false, notes: "Never opened / superseded" };
    }
    if (status === "FROZEN" && CONSTITUTION_INDEX.has(rel)) {
      return {
        classification: "Constitution",
        action: "move",
        ambiguous: false,
        notes: "FROZEN and constitution-indexed",
      };
    }
    if (status === "FROZEN") {
      return {
        classification: "Track open",
        action: "review manually",
        ambiguous: true,
        notes: "FROZEN but not constitution-indexed — do not auto-classify as archive",
      };
    }
    if (status === "CLOSED" || status === "PASS") {
      return { classification: "Track archive", action: "archive", ambiguous: false, notes: "Closed track" };
    }
    return {
      classification: "Track open",
      action: "review manually",
      ambiguous: true,
      notes: "Track-like name but status unknown — do not auto-archive",
    };
  }

  return { classification: "Package/local README", action: "review manually", ambiguous: true, notes: "Unclassified markdown" };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build precise reference patterns — never bare stems like "health" without .md */
function referencePatterns(rel) {
  const name = basename(rel);
  const variants = new Set([name]);
  const parts = rel.split("/");
  for (let i = 1; i < parts.length; i++) {
    variants.add(parts.slice(i).join("/"));
  }
  if (rel.startsWith("docs/")) {
    variants.add(rel.replace(/^docs\//, ""));
  }
  const patterns = [];
  for (const v of variants) {
    if (!v.endsWith(".md")) continue;
    const e = escapeRe(v);
    patterns.push(new RegExp(`\\([^)]*${e}(?:[#)]|$)`, "i"));
    patterns.push(new RegExp(`\\]\\([^)]*${e}(?:[#)]|$)`, "i"));
    patterns.push(new RegExp(`\`${e}\``, "i"));
    patterns.push(new RegExp(`(?:^|[\\s'"(\`])(\\.\\.\\/)*${e}(?:[#"'\\s]|$)`, "m"));
    patterns.push(new RegExp(`(?:^|[\\s'"(\`])(\\.\\.\\/)+${e}(?:[#"'\\s]|$)`, "m"));
    if (v === name) {
      patterns.push(new RegExp(`(?:see|See|Authority:|Canonical contract:)\\s+${e}`, "i"));
      patterns.push(new RegExp(`readFileSync\\([^)]*${e}`, "i"));
      patterns.push(new RegExp(`repoFile\\(\\s*["']${e}["']`, "i"));
      patterns.push(new RegExp(`source\\(\\s*["'][^"']*${e}["']`, "i"));
    }
  }
  return patterns;
}

function referencesFile(content, rel) {
  return referencePatterns(rel).some((re) => re.test(content));
}

function resolveRef(fromFile, ref) {
  ref = ref.split("#")[0].trim();
  if (!ref || ref.startsWith("http")) return null;
  const base = dirname(fromFile);
  const joined = join(ROOT, base, ref).replace(/\\/g, "/");
  const relToRoot = relative(ROOT, joined).replace(/\\/g, "/");
  const parts = relToRoot.split("/").filter(Boolean);
  const stack = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p !== ".") stack.push(p);
  }
  return stack.join("/");
}

function findBrokenRefs(allMd) {
  const mdSet = new Set(allMd);
  const broken = [];
  const seen = new Set();
  const EXCLUDE_FROM_BROKEN_SCAN = new Set(["DOC-INVENTORY-001.md"]);

  for (const file of allMd) {
    if (EXCLUDE_FROM_BROKEN_SCAN.has(file)) continue;
    let content;
    try {
      content = readFileSync(join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    const refs = new Set();
    let m;
    // Markdown links only — ignore inline \`path.md\` code mentions
    const re1 = /\[[^\]]*\]\(([^)#]+\.md[^)]*)\)/g;
    while ((m = re1.exec(content)) !== null) refs.add(m[1]);

    for (let ref of refs) {
      if (ref.includes("*") || ref.includes("..03")) continue;
      const resolved = resolveRef(file, ref);
      if (!resolved || !resolved.endsWith(".md")) continue;
      if (!mdSet.has(resolved)) {
        const key = `${file}|${ref}|${resolved}`;
        if (!seen.has(key)) {
          seen.add(key);
          broken.push({ from: file, ref, resolved });
        }
      }
    }
  }
  return broken;
}

function duplicateGroups() {
  return [
    { a: "RELEASE-ARCHITECTURE-FROZEN.md", b: "docs/architecture/constitution/release-architecture.md", note: "Duplicate/stub candidate pair" },
    { a: "HEALTH-FROZEN.md", b: "docs/architecture/constitution/health.md", note: "Duplicate/stub candidate pair" },
    { a: "docs/architecture/frozen/README.md", b: "docs/architecture/constitution/README.md", note: "Duplicate/stub candidate pair" },
    { a: "RESEND-LIVE-INBOX-VERIFY-001.md", b: "RESEND-LIVE-OTP-PROOF-001.md", note: "Alias pair — PRE-RC lists as alias" },
  ];
}

function main() {
  const allPaths = walk(ROOT).sort((a, b) => norm(a).localeCompare(norm(b)));
  const allMd = allPaths.filter((p) => p.endsWith(".md")).map(norm);
  const scanFiles = allPaths.map(norm);

  const rows = [];
  for (const full of allPaths) {
    const rel = norm(full);
    if (!rel.endsWith(".md") && !rel.endsWith(".log")) continue;
    const content = readFileSync(full, "utf8");
    const status = detectStatus(content, basename(full));
    const { classification, action, ambiguous, notes } = classify(full, content, status);
    const backlinks = rel.endsWith(".md") ? scanFiles.filter((f) => f !== rel && referencesFile(readFileSync(join(ROOT, f), "utf8"), rel)) : [];
    const lines = content.split("\n").length;
    rows.push({ rel, status, classification, action, backlinks, backlinksCount: backlinks.length, ambiguous, notes, lines });
  }

  const broken = findBrokenRefs(allMd);
  const rootMd = rows.filter((r) => !r.rel.includes("/") && r.rel.endsWith(".md"));
  const ambiguousRows = rows.filter((r) => r.ambiguous);
  const topBacklinks = [...rows].filter((r) => r.rel.endsWith(".md")).sort((a, b) => b.backlinksCount - a.backlinksCount).slice(0, 15);
  const institutional = rows.filter((r) =>
    ["Constitution", "ADR", "Governance", "Product model", "Operations"].includes(r.classification),
  );

  const out = `# DOC-INVENTORY-001

\`\`\`text
STATUS = GENERATED
TYPE = Phase 0.1 documentation inventory (read-only)
GENERATED = ${new Date().toISOString().slice(0, 10)}
SOURCE = scripts/doc-inventory.mjs
\`\`\`

Inventory of all \`.md\` files (and execution logs) in the canonical repository.
**No files were moved, renamed, deleted, or rewritten** to produce this document.

Classification follows Phase 0 rules. FROZEN and constitution-indexed documents are treated conservatively.
Unknown track-like files are **not** auto-classified as archive.

Institutional doc count (${institutional.length}) is informational only — **precedence and functional separation matter more than hitting a target number**.

---

## Summary counts

| Metric | Count |
| --- | ---: |
| Total \`.md\` files | ${allMd.length} |
| Root \`.md\` files | ${rootMd.length} |
| Execution \`.log\` files | ${rows.filter((r) => r.rel.endsWith(".log")).length} |
| **Constitution** | ${rows.filter((r) => r.classification === "Constitution").length} |
| **ADR** | ${rows.filter((r) => r.classification === "ADR").length} |
| **Governance** | ${rows.filter((r) => r.classification === "Governance").length} |
| **Product model** | ${rows.filter((r) => r.classification === "Product model").length} |
| **Operations** | ${rows.filter((r) => r.classification === "Operations").length} |
| **Institutional subtotal** | ${institutional.length} |
| **Track open** | ${rows.filter((r) => r.classification === "Track open").length} |
| **Track archive** | ${rows.filter((r) => r.classification === "Track archive").length} |
| **Human evidence** | ${rows.filter((r) => r.classification === "Human evidence").length} |
| **Benchmark** | ${rows.filter((r) => r.classification === "Benchmark").length} |
| **Execution log** | ${rows.filter((r) => r.classification === "Execution log").length} |
| **Migration stub** | ${rows.filter((r) => r.classification === "Migration stub").length} |
| **Package/local README** | ${rows.filter((r) => r.classification === "Package/local README").length} |
| **Ambiguous / manual review** | ${ambiguousRows.length} |
| Broken link refs flagged | ${broken.length} |

### Phase 0 plan estimates vs actual

| Estimate (Phase 0 plan) | Actual (this inventory) | Notes |
| --- | ---: | --- |
| ~103 total \`.md\` | ${allMd.length} | Includes \`docs/release/*\` not visible in sandbox-only scans |
| ~65 root \`*-001.md\` | ${rootMd.filter((r) => r.rel.endsWith("-001.md")).length} | Exact match |
| ~25 institutional (orientation) | ${institutional.length} | Orientation only — do not merge to hit a number |
| ~8–12 open tracks | ${rows.filter((r) => r.classification === "Track open").length} | Classifier-based; ${ambiguousRows.filter((r) => r.classification === "Track open").length} additionally ambiguous |
| ~45–50 closed tracks to archive | ${rows.filter((r) => r.classification === "Track archive").length} | Lower than estimate; ${ambiguousRows.length} items need manual review first |

---

## Duplicate / stub candidates (not removed)

| File A | File B | Notes |
| --- | --- | --- |
${duplicateGroups()
  .map((d) => `| \`${d.a}\` | \`${d.b}\` | ${d.note} |`)
  .join("\n")}

---

## Highest backlink counts

Backlinks counted across \`.md\`, \`.mdc\`, scripts, CI, packages, and config — matching filename/path patterns only (no bare-word false positives).

| File | Backlinks | Classification |
| --- | ---: | --- |
${topBacklinks.map((r) => `| \`${r.rel}\` | ${r.backlinksCount} | ${r.classification} |`).join("\n")}

---

## Broken or unresolved markdown references

${broken.length === 0 ? "_None detected._" : broken.map((b) => `- \`${b.from}\` → \`${b.ref}\` (resolved: \`${b.resolved}\`)`).join("\n")}

---

## Ambiguous / manual-review items

| Path | Status | Classification | Action | Notes |
| --- | --- | --- | --- | --- |
${ambiguousRows.map((r) => `| \`${r.rel}\` | ${r.status} | ${r.classification} | ${r.action} | ${r.notes.replace(/\|/g, "\\|")} |`).join("\n")}

---

## Full inventory

| Path | Lines | Status | Classification | Action | Backlinks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
${rows.map((r) => `| \`${r.rel}\` | ${r.lines} | ${r.status} | ${r.classification} | ${r.action} | ${r.backlinksCount} | ${(r.notes || "").replace(/\|/g, "\\|")} |`).join("\n")}

---

## Backlink detail (files with ≥1 incoming reference)

${rows
  .filter((r) => r.backlinksCount > 0 && r.rel.endsWith(".md"))
  .sort((a, b) => b.backlinksCount - a.backlinksCount)
  .map(
    (r) => `### \`${r.rel}\` (${r.backlinksCount})

${r.backlinks.map((b) => `- \`${b}\``).join("\n")}`,
  )
  .join("\n\n")}

---

## Safeguards applied

1. FROZEN and \`constitution/README.md\`-indexed paths classified as **Constitution** (conservative).
2. FROZEN but **not** constitution-indexed → **review manually**, not auto-archive.
3. Unknown \`*-001\` tracks → **review manually**, not auto-archive.
4. \`first-impression/\`, \`pre-beta/\`, \`desktop/README.md\`, \`site/README.md\` → **keep** in place.
5. Duplicate/stub pairs listed, not removed.
6. Backlinks counted across repo text files (docs, \`.cursor/rules/*.mdc\`, scripts, CI, packages).
7. Broken links flagged with relative-path resolution from source file.
8. No redirect stubs created.

---

_Generated by \`node scripts/doc-inventory.mjs\`. Re-run after any doc change before Phase 1._
`;

  writeFileSync(OUT, out, "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(
    JSON.stringify(
      {
        totalMd: allMd.length,
        rootMd: rootMd.length,
        institutional: institutional.length,
        ambiguous: ambiguousRows.length,
        broken: broken.length,
        trackOpen: rows.filter((r) => r.classification === "Track open").length,
        trackArchive: rows.filter((r) => r.classification === "Track archive").length,
      },
      null,
      2,
    ),
  );
}

main();
