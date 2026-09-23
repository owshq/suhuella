# Release validation (operator)

Platform-specific guides for **trusted** desktop artifacts. Generic flow:

```text
package → validate-release --platform <os> → publish → verify → smoke → manual user gates
```

| Platform | Trust mechanism | Guide |
| --- | --- | --- |
| macOS | Developer ID · notarization · stapler · spctl | [mac-signing.md](./mac-signing.md) |
| Windows | Authenticode · signtool / WinVerifyTrust | `scripts/validate-release-windows.mjs` |
| Linux | Not opened | `validate-release --platform linux` fails honestly |

Release validation is platform-specific. macOS uses Developer ID, notarization, stapling, and spctl. Windows uses Authenticode and Windows signature verification. Linux is not opened yet.

**Private Beta bar:** both macOS and Windows require OS-trusted signing. Unsigned published artifacts are a known current limitation — not the final standard.

## Private Beta bar

Private Beta requires **macOS + Windows user-launchable**. Gate 6 is platform-specific; global PASS only when every **advertised** desktop platform passes.

Until `validate-release --platform windows` PASSes: hide Windows download or mark internal-only — do not present unsigned Windows as a normal beta download.
