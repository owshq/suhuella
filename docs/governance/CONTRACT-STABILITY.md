# Contract Stability

```text
STATUS = ACTIVE · PERMANENT
EFFECTIVE = 2026-09-19
```

Every developer should know immediately what may change freely and what requires an architecture decision.

---

## Stability levels

| Level | Status | Examples | Change rule |
| --- | --- | --- | --- |
| **Domain contracts** | Frozen | Source, Lifecycle, Presentation, Handle-Lifecycle Bridge | ADR + explicit approval |
| **Infrastructure contracts** | Frozen | Handle interface, Registry, HandleStatus, MULTI-PLATFORM-SOURCE-ADAPTERS-001 | ADR + explicit approval |
| **Platform contracts** | Frozen | Release, Branding hierarchy, Navigation | See governance index |
| **Provider adapters** | Evolves | Browser, Electron, Drive, iOS, Android, NAS | New adapter tracks only; pass Adapter Contract Test |
| **UI** | Evolves | React panels, copy, layout | UX / Feature classification |
| **Features** | Evolves | Organise, Search, Activity behaviour | Evidence-driven ([Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md)) |

---

## Architecture stack (frozen shape)

```text
UI → SourcePresentation → Source Domain → Bridge → Registry → Provider Adapters
```

Do not add infrastructure layers without an ADR.

---

## Provider adapter rule

```text
Adapter Contract Test — same suite, every provider.
npm run test:adapter-contract --prefix site
```

```text
Sync Engine → Handle → Provider
```

Never bypass the Handle to call a provider API directly.

```text
The Domain never stores provider-specific information.
Provider-specific metadata belongs exclusively to the Handle.
```

---

## Related

- [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](../../MULTI-PLATFORM-SOURCE-ADAPTERS-001.md)
- [BROWSER-SOURCE-ADAPTER-001.md](../../BROWSER-SOURCE-ADAPTER-001.md)
- [Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md)
