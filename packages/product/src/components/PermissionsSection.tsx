import { useEffect, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import { writeProductLocation } from '../lib/app-routes'
import { capabilitiesOf } from '../host/capabilities'
import {
  PERMISSION_CHANGE_FOLDERS_DETAIL,
  PERMISSION_CHANGE_FOLDERS_TITLE,
  PERMISSION_MODEL_LINK,
  PERMISSION_MODEL_TITLE,
  PERMISSION_SCREEN_DETAIL,
  PERMISSION_SCREEN_TITLE,
  PERMISSION_TRASH_DETAIL,
  PERMISSION_TRASH_TITLE,
  PERMISSION_VIEW_FOLDERS_DETAIL,
  PERMISSION_VIEW_FOLDERS_TITLE,
  PERMISSIONS_SECTION_LEAD,
  permissionChangeFoldersStatus,
  permissionModelStatus,
  permissionViewFoldersStatus,
} from '../lib/permissions-copy'
import type { AppHost, AppInfo, AppSettings, ByokStatus, PlanAssistantStatus } from '../types'
import { PermissionRow, PermissionToggle } from './PermissionRow'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--sidebar-line)] bg-[var(--app-bg)] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  )
}

export function PermissionsSection({
  appInfo,
  settings,
  onSettingsChange,
}: {
  appInfo: AppInfo
  settings: AppSettings | null
  onSettingsChange?: (settings: AppSettings) => void
}) {
  const host: AppHost = appInfo.host ?? 'browser'
  const caps = capabilitiesOf(appInfo)
  const [busy, setBusy] = useState<string | null>(null)
  const [byok, setByok] = useState<ByokStatus | null>(null)
  const [assistant, setAssistant] = useState<PlanAssistantStatus | null>(null)

  useEffect(() => {
    void getSuhuellaApi()
      .getByokStatus()
      .then(setByok)
      .catch(() => setByok(null))
    void getSuhuellaApi()
      .getPlanAssistantStatus()
      .then(setAssistant)
      .catch(() => setAssistant(null))
  }, [])

  const indexedCount = settings?.indexedLocations.length ?? 0
  const viewFoldersOn = indexedCount > 0
  const allowFolderChanges = settings?.permissions.allowFolderChanges ?? true
  const trashEnabled = settings?.permissions.trashEnabled ?? false
  const modelStatus = permissionModelStatus(host, byok, assistant)

  async function updatePermissions(prefs: { allowFolderChanges?: boolean; trashEnabled?: boolean }) {
    setBusy(Object.keys(prefs).join('-'))
    try {
      const next = await getSuhuellaApi().setPermissionPreferences(prefs)
      onSettingsChange?.(next)
    } finally {
      setBusy(null)
    }
  }

  async function revokeViewFolders() {
    if (!settings || indexedCount === 0) return
    setBusy('view-folders')
    try {
      let next = settings
      for (const location of [...settings.indexedLocations]) {
        next = await getSuhuellaApi().removeIndexedLocation(location)
      }
      onSettingsChange?.(next)
    } finally {
      setBusy(null)
    }
  }

  function openSources() {
    writeProductLocation('locations')
  }

  function openAiSettings() {
    writeProductLocation('settings', 'ai')
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold text-[var(--app-fg)]">Permissions</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-fg)] opacity-60">
          {PERMISSIONS_SECTION_LEAD}
        </p>
        <div className="mt-4 flex flex-col">
          <PermissionRow
            title={PERMISSION_VIEW_FOLDERS_TITLE}
            statusLine={permissionViewFoldersStatus(indexedCount)}
            detail={PERMISSION_VIEW_FOLDERS_DETAIL}
            trailing={
              <div className="flex flex-col items-end gap-2">
                <PermissionToggle
                  label={PERMISSION_VIEW_FOLDERS_TITLE}
                  checked={viewFoldersOn}
                  busy={busy === 'view-folders'}
                  onChange={(next) => {
                    if (next) openSources()
                    else void revokeViewFolders()
                  }}
                />
                <button
                  type="button"
                  onClick={openSources}
                  className="text-[12px] font-semibold text-[var(--brand-accent)] hover:underline"
                >
                  Open Sources
                </button>
              </div>
            }
          />
          <PermissionRow
            title={PERMISSION_CHANGE_FOLDERS_TITLE}
            statusLine={permissionChangeFoldersStatus(indexedCount, allowFolderChanges, caps.organise)}
            detail={PERMISSION_CHANGE_FOLDERS_DETAIL}
            trailing={
              <PermissionToggle
                label={PERMISSION_CHANGE_FOLDERS_TITLE}
                checked={allowFolderChanges && indexedCount > 0 && caps.organise}
                disabled={indexedCount === 0 || !caps.organise}
                busy={busy === 'allowFolderChanges'}
                onChange={(next) => void updatePermissions({ allowFolderChanges: next })}
              />
            }
          />
          <PermissionRow
            title={PERMISSION_TRASH_TITLE}
            statusLine={trashEnabled ? 'On (not active yet)' : 'Off'}
            detail={PERMISSION_TRASH_DETAIL}
            trailing={
              <PermissionToggle
                label={PERMISSION_TRASH_TITLE}
                checked={trashEnabled}
                busy={busy === 'trashEnabled'}
                onChange={(next) => void updatePermissions({ trashEnabled: next })}
              />
            }
          />
          <PermissionRow
            title={PERMISSION_MODEL_TITLE}
            statusLine={modelStatus.label}
            trailing={
              <button
                type="button"
                onClick={openAiSettings}
                className="rounded-full border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-3 py-1.5 text-[12px] font-semibold text-[var(--app-fg)] hover:opacity-90"
              >
                {PERMISSION_MODEL_LINK}
              </button>
            }
          />
          <PermissionRow
            title={PERMISSION_SCREEN_TITLE}
            statusLine={PERMISSION_SCREEN_DETAIL}
            disabled
            trailing={
              <PermissionToggle
                label={PERMISSION_SCREEN_TITLE}
                checked={false}
                disabled
                onChange={() => {}}
              />
            }
          />
        </div>
      </Card>
    </div>
  )
}
