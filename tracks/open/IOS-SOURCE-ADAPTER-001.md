# IOS-SOURCE-ADAPTER-001

```text
STATUS = RESERVED
TYPE = Provider adapter
SCOPE = iOS filesystem → SourceHandle
```

Implement iOS filesystem access through SourceHandle. No iOS UI. Open only after Browser + Desktop are impeccable.

Business logic must remain untouched.

```text
createIOSHandle(backend)
```

Host access profile: `hostAccessFor('ios')` from [SOURCE-PLATFORM-READINESS-001.md](../../SOURCE-PLATFORM-READINESS-001.md).
