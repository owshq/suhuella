/**
 * LICENSE-VERSION-FINAL-E2E-007 — main-process IPC path gate (executeOrganisationPlan).
 * Runs under Node+mock or real Electron (same handler code as knowledge-set:executePlan).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { LicenseContext } from '@suhuella/product/types.ts'
import { app } from 'electron'
import { runDesktopE2eCheckWhenInvoked } from './e2e-check-runner.ts'
import { executeOrganisationPlan, previewOrganisationPlanForFolders } from './knowledge-set.ts'
import { setLicenseContextForTests } from './license-rights.ts'
import { saveLicenseContext, verifyLicenseSignature } from './license-store.ts'
import { organisationPlanCapability } from '@suhuella/product/lib/generation-capabilities.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function realFolder(absolutePath: string, fileNames: string[]) {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_ipc',
    sourceType: 'local_folder' as const,
    kind: 'folder' as const,
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath: folderName,
    folderName,
    parentTokens: [],
    depth: 1,
    extensions: [],
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

function runIpcGateChecks(context: LicenseContext): void {
  const organiseCap = organisationPlanCapability()
  const root = mkdtempSync(path.join(tmpdir(), 'suhuella-ipc-gate-'))
  try {
    setLicenseContextForTests(null)
    saveLicenseContext(context)
    assert(verifyLicenseSignature(context), 'stored license verifies before IPC path')

    const sourceDir = path.join(root, 'Inbox')
    const destDir = path.join(root, 'Clients', 'ACME')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })
    const sourceFile = path.join(sourceDir, 'invoice.pdf')
    writeFileSync(sourceFile, 'ipc-gate')

    const folders = [realFolder(destDir, [])]
    const preview = previewOrganisationPlanForFolders({ items: [{ path: sourceFile, kind: 'file' }] }, folders)
    assert(preview.ok, 'preview ok')
    const plan = {
      ...preview.data,
      items: preview.data.items.map((item) => ({
        ...item,
        selected: true,
        reviewGroup: 'ready' as const,
      })),
    }

    setLicenseContextForTests({ ...context, capabilities: [] })
    const fakeRecovery = executeOrganisationPlan(
      { plan, confirmed: true, runNumber: 1, recoveryOperation: 'bypass-generation' },
      folders,
    )
    assert(
      !fakeRecovery.ok && fakeRecovery.error.code === 'generation_required',
      'fake recovery IPC flag does not bypass host gate',
    )

    setLicenseContextForTests(null)
    saveLicenseContext(context)

    const licensePath = path.join(app.getPath('userData'), 'license.json')
    const stored = JSON.parse(readFileSync(licensePath, 'utf8')) as { context: LicenseContext }
    stored.context.capabilities = [...stored.context.capabilities, 'business_branding']
    writeFileSync(licensePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8')

    setLicenseContextForTests(null)
    const tamperedDenied = executeOrganisationPlan({ plan, confirmed: true, runNumber: 2 }, folders)
    assert(!tamperedDenied.ok, 'tampered on-disk license rejected on IPC path')

    setLicenseContextForTests(null)
    saveLicenseContext(context)
    const allowed = executeOrganisationPlan({ plan, confirmed: true, runNumber: 3 }, folders)
    assert(allowed.ok, 'IPC-path executeOrganisationPlan allowed with signed rights')

    setLicenseContextForTests({
      ...context,
      capabilities: context.capabilities.filter((cap) => cap !== organiseCap),
    })
    const missingCap = executeOrganisationPlan({ plan, confirmed: true, runNumber: 4 }, folders)
    assert(!missingCap.ok, 'missing signed capability denied on IPC path')
  } finally {
    setLicenseContextForTests(null)
    rmSync(root, { recursive: true, force: true })
  }
}

runDesktopE2eCheckWhenInvoked({
  marker: 'license-ipc-gate-check',
  passLabel: 'license-ipc-gate-check',
  run: () => {
    const raw = process.env.LICENSE_E2E_SIGNED_CONTEXT!.trim()
    runIpcGateChecks(JSON.parse(raw) as LicenseContext)
  },
})
