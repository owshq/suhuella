/**
 * Browser runtime entry for Playwright — runs assertHostExecutorGenerationRights in real Chromium.
 */
import { assertHostExecutorGenerationRights } from "@suhuella/product/host/generation-executor-gate.ts";
import type { LicenseContext } from "@suhuella/product/types.ts";

export type BrowserLicenseGateCase = {
  id: string;
  capability: string;
  expectOk: boolean;
  context: LicenseContext;
};

export function runBrowserLicenseGateCases(cases: BrowserLicenseGateCase[]): Array<{
  id: string;
  pass: boolean;
  actualOk: boolean;
  code: string | null;
}> {
  return cases.map((testCase) => {
    const verdict = assertHostExecutorGenerationRights(testCase.context, testCase.capability);
    return {
      id: testCase.id,
      pass: verdict.ok === testCase.expectOk,
      actualOk: verdict.ok,
      code: verdict.ok ? null : verdict.error.code,
    };
  });
}

declare global {
  interface Window {
    runBrowserLicenseGateCases: typeof runBrowserLicenseGateCases;
  }
}

window.runBrowserLicenseGateCases = runBrowserLicenseGateCases;
