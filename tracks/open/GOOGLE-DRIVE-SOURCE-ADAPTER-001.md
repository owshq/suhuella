# GOOGLE-DRIVE-SOURCE-ADAPTER-001

```text
STATUS = RESERVED
TYPE = Provider adapter
SCOPE = Google Drive → SourceHandle
```

Implement Google Drive as a SourceHandle after Browser + Desktop are impeccable. Not before **PRIVATE-BETA-001** unless evidence demands it.

Everything above the adapter must remain unchanged.

```text
createGoogleDriveHandle(backend)
registry.bind(source.id, handle)
```

No Domain / Lifecycle / Presentation / UI work. Same contract suite:

```bash
npm run test:adapter-contract --prefix site
```
