# ANDROID-SOURCE-ADAPTER-001

```text
STATUS = RESERVED
TYPE = Provider adapter
SCOPE = Android filesystem → SourceHandle
```

Implement Android filesystem access through SourceHandle. No Android UI. Open only after Browser + Desktop are impeccable.

Business logic must remain untouched.

```text
createAndroidHandle(backend)
```

Host access profile: `hostAccessFor('android')` from [SOURCE-PLATFORM-READINESS-001.md](../../SOURCE-PLATFORM-READINESS-001.md).
