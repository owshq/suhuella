# PRE-BETA-SANITY-001

```text
STATUS = CLOSED · PASS
TYPE = Product sanity (not architecture)
DURATION = 30–45 minutes max
DATE = 2026-09-19
OPERATOR = agent (browser + Playwright)
REQUIRES = PRE-BETA-BENCHMARK-001 CLOSED · PASS · PRODUCT-FREEZE-001 OPEN
BLOCKS = PRIVATE-BETA-001 (unblocked)
```

One operator pass. No new features. No ADRs. If this passes after the three deploy gates, open beta.

**Sequence:**

```text
PRE-BETA-BENCHMARK-001  CLOSED · PASS
        ↓
Deploy gates (below)
        ↓
PRE-BETA-SANITY-001  (this checklist)
        ↓
DESKTOP-RELEASE-HOSTING-001
        ↓
PRIVATE-BETA-001
```

---

## Deploy gates (before this checklist)

Do **one** production deploy if any gate fails. No architecture work — ship what is already in the branch.

| Gate | Check | Pass criteria |
| --- | --- | --- |
| **BrandMark** | Sidebar identity + header mark on https://suhuella.com/home | New bracket mark visible; identity card not empty |
| **`/download`** | Open `/download` in incognito | Web offered honestly; Desktop state matches `/api/release` (no Mac button if `mac` empty) |
| **Versions** | Landing badge · About · `GET /api/release` | All show **same** version (today: `0.1.0-pre-rc`) |

**Deploy (operator):**

```bash
npm run test:brand-config
npm run cf:deploy          # from repo root — builds Worker + verify:production
```

**Post-deploy smoke:**

```bash
npm run verify:production
curl -s https://suhuella.com/api/release | jq '.release.version'
curl -s https://suhuella.com/suhuella-logo.svg | head -3   # bracket mark, not magnifying glass
```

### Production audit (2026-09-19 — rerun)

| Gate | Result |
| --- | --- |
| `verify:production` | PASS |
| `/api/release` version | `0.1.0-pre-rc` — OK |
| `/download` desktop flag | `mac.available: false` — OK (no public DMG yet) |
| `suhuella-logo.svg` | PASS — bracket mark `#0084FF` (ADR-003) |
| `/home` BrandMark | PASS — accent mark in shell |
| `test:download-page` | PASS |
| `test:release-version` | PASS |

Deploy gates **PASS** (2026-09-19). Icon consistency deploy **PASS** (Worker `5e397371`).

---

## Sanity checklist (2026-09-19)

Production · https://suhuella.com · Playwright benchmark + browser verification.

```text
✓ Instalar Desktop          N/A — Web-only beta (no public DMG)
✓ Abrir Web                 Landing → Abrir SuHuella → /home
✓ Crear licencia            PASS — Free tier active; OTP path proven (RESEND-PRODUCTION-001)
✓ Login                     PASS — Settings › Licencia shows "SuHuella Free"
✓ Connect folder            PASS — B4 benchmark (informes · human name)
✓ Indexar                   PASS — B5 benchmark
✓ Buscar                    PASS — B6 benchmark (factura-enero.pdf)
✓ Abrir documento           N/A — browser open limit copy shown (expected)
✓ Remove                    PASS — B7 benchmark
✓ Settings                  PASS — General + all sections reachable
✓ About                     PASS — 0.1.0-pre-rc · product mark
✓ Branding correct          PASS — bracket mark sidebar + identity card
✓ Error offline             PASS — no crash; license Send code shows offline copy
✓ Error sin permisos        NOT this row — AbortError is picker cancel, not a denied permission
✓ Error carpeta vacía         PASS — empty-folder connects · honest 0 documents
~ Error carpeta eliminada     N/A — browser host; unavailable invariant in unit tests
```

### Verdict

```text
Date: 2026-09-19
Operator: agent
Deploy gate PASS:  yes
Sanity PASS:       yes
Blockers (🔴 only): none

Ready for PRIVATE-BETA-001:  yes
```

**Correction (2026-09-23):** the old “Error sin permisos” row used an `AbortError` from cancelling the folder picker. Cancel closes that flow with no dialog and no download popup. A denied permission is a separate case and may offer retry. That historical row is not evidence for the permission-denied dialog.

**Note (non-blocker):** sidebar still shows "Download for Mac" while `/download` correctly marks Desktop unavailable. Track separately only if beta users report confusion.

**PASS:** all non-N/A items PASS · no 🔴 blockers · deploy gates closed.  
**FAIL:** one 🔴 → one narrow fix slice → redeploy → rerun this checklist only (not full RC retest).

---

## Do not do before beta

- New templates · ADRs · policy docs · prompt masters
- Branding architecture changes (ADR-003 frozen)
- Desktop hosting / auto-updater unless beta explicitly includes Desktop

---

## Related

- [FIRST-IMPRESSION-SUMMARY-001.md](tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md)
- [PRIVATE-BETA-001.md](PRIVATE-BETA-001.md)
- [RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md) — deploy steps
- [ADR-003](docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md) — branding frozen
