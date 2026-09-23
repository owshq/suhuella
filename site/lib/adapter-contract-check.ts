import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runAdapterContract } from "@suhuella/product/host/adapters/adapter-contract.ts";
import { ADAPTER_CONTRACT_FIXTURES } from "@suhuella/product/host/adapters/adapter-fixtures.ts";
import { BROWSER_FS_ADAPTER_ID } from "@suhuella/product/host/adapters/browser-fs-handle-adapter.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function repoFile(relative: string): string {
  return readFileSync(join(process.cwd(), "..", relative), "utf8");
}

async function runAdapterContractCheck(): Promise<void> {
  const reports: string[] = [];

  for (const fixture of ADAPTER_CONTRACT_FIXTURES) {
    const report = await runAdapterContract(fixture);
    const line = `${report.provider}: ${report.passed.join(", ")}`;
    reports.push(line);
    assert(report.passed.includes("open"), `${fixture.provider} passed open`);
    assert(report.passed.includes("refresh"), `${fixture.provider} passed refresh`);
    assert(report.passed.includes("permission"), `${fixture.provider} passed permission`);
    assert(report.passed.includes("unavailable"), `${fixture.provider} passed unavailable`);
    assert(report.passed.includes("dispose"), `${fixture.provider} passed dispose`);
  }

  assert(reports.length === 10, "contract suite runs against every provider");

  const browserDoc = repoFile("BROWSER-SOURCE-ADAPTER-001.md");
  assert(browserDoc.includes("REFERENCE IMPLEMENTATION"), "browser adapter is the reference");
  assert(browserDoc.includes(BROWSER_FS_ADAPTER_ID), "browser adapter id is documented");

  const stability = repoFile("docs/governance/CONTRACT-STABILITY.md");
  assert(stability.includes("Frozen"), "stability classification exists");
  assert(stability.includes("Provider Adapters"), "provider adapters evolve");

  const multi = repoFile("MULTI-PLATFORM-SOURCE-ADAPTERS-001.md");
  assert(multi.includes("Sync Engine"), "sync path goes through Handle");
  assert(multi.includes("Never"), "sync never bypasses Handle");

  console.log("Adapter Contract Test passed");
  for (const line of reports) {
    console.log(`  ✓ ${line}`);
  }
}

void runAdapterContractCheck();
