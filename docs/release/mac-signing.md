# macOS release signing

Gate 6 (manual download → install → open) requires a **Developer ID Application**–signed and **notarized** DMG. Adhoc builds pass local `codesign --verify` but Gatekeeper rejects them after a browser download.

See also [README.md](./README.md) for the cross-platform release validation contract.

## Prerequisites

| Requirement | Purpose |
| --- | --- |
| Apple Developer membership | Issue Developer ID Application certificate |
| Developer ID Application certificate | Installed in Keychain Access on the build Mac |
| `CSC_NAME` | Codesign identity (e.g. `Developer ID Application: Your Name (TEAMID)`) |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_TEAM_ID` | 10-character team id |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_TEAM_ID="TEAMID"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

## Release flow

```text
npm run package:mac --prefix desktop
        ↓
  verify-mac-bundle.mjs          (bundle integrity — adhoc OK for local dev)
        ↓
  seal-mac-dmg.mjs               (DMG sign + notarytool + stapler when credentials set)
        ↓
npm run validate-release -- --platform mac
        ↓
npm run publish:desktop-mac      (refuses if validation failed)
        ↓
  verify · smoke · deploy
        ↓
Gate 6 — user download from suhuella.com (Chrome)
```

## validate-release (macOS)

`desktop/scripts/require-mac-release-signing.mjs` implements the macOS checks. All must PASS:

| Check | Command |
| --- | --- |
| Bundle integrity | `codesign --verify --deep --strict SuHuella.app` |
| Gatekeeper | `spctl --assess --type execute SuHuella.app` |
| Bundle id | `Identifier == com.suhuella.desktop` |
| Team | `TeamIdentifier` present |
| Not adhoc | Developer ID Application (not `-`) |
| DMG signed | Developer ID Application on `.dmg` |
| Notarization | `xcrun stapler validate SuHuella-*.dmg` |

If any check fails, publish exits with **macOS release validation FAIL** and no GitHub upload.

## Local without Developer ID

`package:mac` still works for engineering (adhoc sign, `codesign --verify` PASS). `validate-release` and publish will not PASS until the certificate and notarization credentials are configured.

## Gate 6

After a successful publish, validate as a user:

1. https://suhuella.com/download
2. Install from DMG (Chrome download — quarantine path)
3. Open SuHuella — no “damaged” dialog, no `xattr` workaround

Do not claim Gate 6 PASS until this succeeds on a notarized artifact.

## Related

- [DESKTOP-RELEASE-PRODUCTION-001.md](../../DESKTOP-RELEASE-PRODUCTION-001.md) — gated runbook
- [RELEASE-PUBLISH-PIPELINE-001.md](../../RELEASE-PUBLISH-PIPELINE-001.md) — pipeline contract (frozen)
- `desktop/build/entitlements.mac.plist` — hardened runtime entitlements
