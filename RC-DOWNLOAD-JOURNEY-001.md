```text
RC-DOWNLOAD-JOURNEY-001 — CLOSED · PASS
STRATEGY = B
RELEASE_VERSION = 0.1.0-pre-rc
```

Los dos P0 están cerrados en el mismo tren de producción.

**Descarga.** No hay URL pública usable: R2 no está habilitado en la cuenta, Windows no se puede empaquetar en este Mac, y el `.dmg` local no se puede publicar. STRATEGY A habría repetido el P0. STRATEGY B es la verdad: el CTA principal es **Abrir SuHuella** (`/home`). No hay “Descargar SuHuella”. No hay botones Windows/Mac “Aún no disponible”. El FAQ ya no dice cómo instalar algo que no existe.

**`/api/release` ahora:**

```json
{"ok":true,"release":{"version":"0.1.0-pre-rc","channel":"stable","minimumVersion":"0.1.0-pre-rc","mandatory":false}}
```

Sin `windows: ""` ni `mac: ""`. Badge en vivo: `v0.1.0-pre-rc`.

**Worker.** Ya no es el del 18 de septiembre. Versión viva: `467e7e69-3a37-4437-a463-4dad48174256` (2026-09-19). `LICENSE_DB` ligado. Incluye LICENSE-PAID-GRANT-DURABILITY-001. `verify-session` falso sigue en 400. Checkout lifetime/monthly sigue en unavailable.

Informe: [RC-DOWNLOAD-JOURNEY-001.md](RC-DOWNLOAD-JOURNEY-001.md).

Siguiente: [PRE-RC-TRACKS-001](PRE-RC-TRACKS-001.md). No reabrir PRODUCTION-READINESS-001 hasta que esos tracks cierren. No etiquetar `0.1.0-rc1` desde este cierre.