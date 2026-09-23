/**
 * LICENSE-VERSION-FINAL-E2E-007 — Desktop executor slice (temp dirs only).
 */
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { LicenseContext } from '@suhuella/product/types.ts'
import {
  executeOrganisationPlan,
  previewOrganisationPlanForFolders,
} from './knowledge-set.ts'
import { setLicenseContextForTests } from './license-rights.ts'
import { assertSignedExecutorRights } from '@suhuella/product/lib/signed-license-contract.ts'
import { organisationPlanCapability } from '@suhuella/product/lib/generation-capabilities.ts'
import { verifyLicenseSignature } from './license-store.ts'
import { runDesktopE2eCheckWhenInvoked } from './e2e-check-runner.ts'

const upgradeCap = 'rename_file'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function realFolder(absolutePath: string, fileNames: string[]) {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_e2e',
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

function runDesktopExecutorSlice(context: LicenseContext): void {
  const organiseCap = organisationPlanCapability()
  const root = mkdtempSync(path.join(tmpdir(), 'suhuella-e2e-desktop-'))
  try {
    assert(verifyLicenseSignature(context), 'desktop verifies Ed25519 before executor')

    const renameDenied = assertSignedExecutorRights(context, upgradeCap)
    const renameAllowed = renameDenied.ok
    const expectRenameAllowed = process.env.LICENSE_E2E_EXPECT_RENAME === 'true'
    assert(renameAllowed === expectRenameAllowed, expectRenameAllowed ? 'upgrade rename allowed' : 'pre-upgrade rename denied')

    const allowed = assertSignedExecutorRights(context, organiseCap)
    assert(allowed.ok, 'organise capability allowed throughout')

    const sourceDir = path.join(root, 'Downloads')
    const destDir = path.join(root, 'Clients', 'ACME', 'Invoices')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })
    writeFileSync(path.join(destDir, 'Invoice_ACME_2024.pdf'), 'seed')
    const sourceFile = path.join(sourceDir, 'Invoice_ACME_E2E.pdf')
    writeFileSync(sourceFile, 'e2e-invoice')

    setLicenseContextForTests(context)

    const folders = [realFolder(destDir, ['Invoice_ACME_2024.pdf'])]
    const preview = previewOrganisationPlanForFolders(
      { items: [{ path: sourceFile, kind: 'file' }] },
      folders,
    )
    assert(preview.ok && preview.data.items[0]?.action === 'move', 'plan previews move')
    const plan = {
      ...preview.data,
      items: preview.data.items.map((item) => ({
        ...item,
        selected: true,
        reviewGroup: 'ready' as const,
      })),
    }
    const executed = executeOrganisationPlan({ plan, confirmed: true, runNumber: 1 }, folders)
    assert(executed.ok && executed.data.appliedCount === 1, 'confirmed move applies on temp files')
    assert(!existsSync(sourceFile), 'source removed after allowed move')

    const renameTarget = path.join(sourceDir, 'Invoice_renamed.pdf')
    writeFileSync(renameTarget, 'rename-me')
    if (expectRenameAllowed) {
      const renameRights = assertSignedExecutorRights(context, upgradeCap)
      assert(renameRights.ok, 'rename_file signed before filesystem rename')
      renameSync(renameTarget, path.join(sourceDir, 'Invoice_renamed_done.pdf'))
      assert(existsSync(path.join(sourceDir, 'Invoice_renamed_done.pdf')), 'rename applied after upgrade')
    } else {
      assert(!renameAllowed, 'rename blocked before upgrade payment')
      assert(existsSync(renameTarget), 'rename target untouched when denied')
    }
  } finally {
    setLicenseContextForTests(null)
    rmSync(root, { recursive: true, force: true })
  }
}

runDesktopE2eCheckWhenInvoked({
  marker: 'license-version-e2e-executor-check',
  passLabel: 'license-version-e2e-executor-check',
  run: () => {
    const raw = process.env.LICENSE_E2E_SIGNED_CONTEXT!.trim()
    runDesktopExecutorSlice(JSON.parse(raw) as LicenseContext)
  },
})
