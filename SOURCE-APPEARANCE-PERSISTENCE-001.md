# SOURCE-APPEARANCE-PERSISTENCE-001

**STATUS:** CLOSED · PASS

**TYPE:** Source appearance persistence parity (desktop + browser)

---

## Closed with

- `sourceAppearance` persisted in desktop `settings.json` and browser `localStorage`
- Shared color validation (`CORPORATE_COLORS` / `isCorporateColor`)
- Shared key normalization (`normalizeSourceKey`)
- Appearance cleanup on `removeIndexedLocation` (both hosts)
- Persistence guard: `canPersistSourceAppearanceColor` — cloud/external/non-customizable sources reject new colors at store layer (not UI-only)
- Load-time prune: `normalizeSourceAppearanceStore` drops colors for non-customizable keys

---

## Remaining accepted limitations

- **Browser recents are not OS recents** — browser `recentFolders` mirrors connected source ids; desktop records real folder paths from the OS.
- **Desktop/browser appearance is intentionally host-local** — desktop keys are absolute paths; browser keys are source ids or `suhuella:*` tokens. No cross-host sync (different authorities: path vs `FileSystemHandle`).
- **Orphan cleanup on startup deferred** — keys for removed sources may linger until next remove or load-time non-customizable prune; low cost, not RC-blocking.

---

## Policy (by source group)

| Group | Icon | Color customizable | Persist guard |
|---|---|---|---|
| `computer` (local well-known) | Catalog icon | Yes | Yes |
| `other` (custom local folder) | Folder | Yes | Yes |
| `cloud` | Service logo | No | Rejected at store |
| `external` | Generic volume/USB | No | Rejected at store |

---

## Files

| Area | Files |
|---|---|
| Policy + normalization | `desktop/src/lib/source-appearance.ts` |
| Desktop store | `desktop/electron/settings-store.ts` |
| Browser host | `desktop/src/host/install-browser-host.ts` |
| UI | `desktop/src/components/SourceIconBadge.tsx`, `SettingsWindow.tsx`, `SourcesPanel.tsx` |
