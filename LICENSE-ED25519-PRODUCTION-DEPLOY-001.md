# LICENSE-ED25519-PRODUCTION-DEPLOY-001

```text
STATUS = DEPLOYED (2026-09-24 · Mac+Win published · notices sent via Worker Resend · HMAC self-check PASS)
TYPE = Production deploy — Ed25519 signing + secret separation (Phase 2A)
DEPENDS = SIGNED-LICENSE-RIGHTS-DELIVERY-006 · LICENSE-HMAC-RETIREMENT-2B · Phase 2A code merged and desktop release built
BLOCKS = Retirada de LICENSE_SIGNING_SECRET (cierre 2B en LICENSE-HMAC-RETIREMENT-2B.md) hasta PASS de este deploy
```

One-pager for the operator. **Names only** in logs — never print secret values.

---

## 0. Read this first — versión mínima Ed25519

| Pregunta | Respuesta |
| --- | --- |
| ¿`parsed.algorithm !== 'ed25519'` ya está en desktop publicado? | **No.** Es código **nuevo** del track 006 / Fase 2A (aún no en git release). |
| ¿Qué hace `0.1.0-pre-rc` publicado hoy? | **Permisivo por completo offline:** sin clave embebida, `verifyLicenseSignature` devuelve `true` — **no comprueba ninguna firma**. Cualquier `LicenseContext` con forma válida pasa, firmado o no. No es solo “no cae a Free”; es **cero integridad criptográfica local**. `checkLicense` offline conserva esa caché sin re-verificar. |
| Versión mínima que parsea `ed25519.<body>.<sig>` | **Ninguna publicada aún.** Primera versión = el **próximo release desktop** que incluya 006 + Fase 2A (build con `SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS`). |
| ¿Auto-update lleva al parque a esa versión? | **No.** No hay `electron-updater`. Solo `release-check.ts` → `/api/release` (`mandatory: false`). Los usuarios **reinstalan manualmente**. No contar con actualización silenciosa. |

### Implicación de orden (importante)

| Escenario | Efecto |
| --- | --- |
| **Solo Worker** (Ed25519 + secrets nuevos), clientes en `0.1.0-pre-rc` | **Aditivo / seguro.** Tokens Ed25519 se guardan; verify local no falla (sin secret embebido). Offline sigue mostrando pagado desde caché. |
| **Desktop 006+2B** (dual-verify), Worker sigue HMAC | **Seguro.** Tokens HMAC legacy: gracia online-atestada dentro de `offlineUntil`. Sin regresión vs. parque actual. |
| **Desktop 006+2B + public keys**, Worker sigue HMAC | **Seguro** para HMAC. Ed25519 offline aún no aplica hasta que el Worker emita `ed25519.*`. |
| **Desktop 006 sin 2B** (solo Ed25519 fail-closed), Worker HMAC | **Regresión** — no publicar sin dual-verify. |
| **Worker Ed25519 + desktop 006+2B con public keys** | **Objetivo completo.** HMAC → Ed25519 en check online; offline Ed25519 verificado localmente. |

**Conclusión (post-2B):** Worker secrets, desktop release, y adopción **ya no exigen la misma ventana exacta**. Orden recomendado: (1) merge 006+2A+2B, (2) Worker secrets + migración 0013, (3) publicar desktop con public keys, (4) comunicación §5. Worker puede ir antes del desktop; desktop 006+2B puede ir antes del Worker Ed25519 sin romper HMAC legacy.

### Motivo de negocio (no solo UX)

Hasta que el parque actualice a desktop 006 con claves públicas embebidas, **la verificación offline de licencias pagadas no protege contra manipulación del contexto local** — el cliente publicado confía en la forma del JSON, no en la firma. Este deploy no arregla retroactivamente `0.1.0-pre-rc`; lo arregla 006 (fail-closed Ed25519). Por eso importa **Worker + release desktop + adopción**, no solo el Worker.

### Ventana operador vs. perspectiva usuario

Con 2B, publicar desktop antes del Worker ya no rompe HMAC. Sin `electron-updater`, la adopción sigue siendo manual — el beneficio Ed25519 offline llega cuando el usuario instala **y** el Worker emite `ed25519.*` (check online).

---

## 1. Pre-flight (antes de tocar producción)

- [ ] Fase 2A + **2B dual-verify** mergeadas; tag/release desktop con `SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS` en build CI.
- [ ] Migración D1 `0013_license_token_algorithm.sql` aplicada (`npm run test:license-hmac-retirement-2b --prefix site` pasa).
- [ ] Keypair Ed25519 generado offline (PKCS#8 privada → Worker; SPKI pública → `LICENSE_SIGNING_PUBLIC_KEYS` + build desktop). Guardar backup del par en gestor de secretos.
- [ ] Decidir ventana de mantenimiento (5–15 min) — ver efectos secundarios §4.
- [ ] Avisar internamente: partners con sesión activa y OTP en vuelo (§4).
- [ ] Licencia de prueba pagada lista (gift / test grant) + dispositivo desktop para smoke modo avión.

---

## 2. Orden de despliegue

### Paso A — Confirmar parque cliente (no bloqueante para Worker-only)

1. Asumir que **casi todo el parque está en `0.1.0-pre-rc`** (o anterior) — **sin** parsing Ed25519.
2. **No** esperes auto-update. Si quieres el fix offline real, planifica **release desktop + comunicación de reinstalación** en la misma ventana que el Worker Ed25519.

### Paso B — Generar valores nuevos (local, nunca en git)

```bash
# Ejemplo: generar par Ed25519 (guardar salida en gestor de secretos)
node -e "
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
console.log('LICENSE_SIGNING_PRIVATE_KEY=' + privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'));
console.log('LICENSE_SIGNING_PUBLIC_KEYS=' + publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'));
"
# Valores NUEVOS e independientes (openssl rand -hex 32 o similar):
# LICENSE_EMAIL_OTP_SECRET=
# PARTNER_SESSION_SECRET=
```

### Paso C — Worker secrets (`cd site`)

Ejecutar **en este orden** (cada `put` despliega una versión nueva del Worker):

```bash
npx wrangler secret put LICENSE_SIGNING_PRIVATE_KEY      # Ed25519 sign (nuevo)
npx wrangler secret put LICENSE_SIGNING_PUBLIC_KEYS      # Ed25519 verify allowlist (misma SPKI que build desktop)
npx wrangler secret put LICENSE_EMAIL_OTP_SECRET         # NUEVO — distinto de LICENSE_SIGNING_SECRET
npx wrangler secret put PARTNER_SESSION_SECRET           # NUEVO — distinto de LICENSE_SIGNING_SECRET
# NO rotar LICENSE_SIGNING_SECRET — sigue para HMAC legacy server-side hasta Fase 2B
```

Verificar nombres (sin valores):

```bash
npx wrangler secret list
# Debe incluir: LICENSE_SIGNING_PRIVATE_KEY, LICENSE_SIGNING_PUBLIC_KEYS,
#               LICENSE_EMAIL_OTP_SECRET, PARTNER_SESSION_SECRET, LICENSE_SIGNING_SECRET
```

### Paso D — Desktop release (misma ventana que Paso C, o inmediatamente después)

```bash
export SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS="<misma SPKI que LICENSE_SIGNING_PUBLIC_KEYS>"
cd desktop
npm run package:check   # falla si falta la env (excepto SUHUELLA_DESKTOP_CI=1)
npm run build           # inlining check automático si la env está set
npm run test:license-build-inlining
npm run test:license-offline-verify
npm run test:license-dual-verify
npm run test:license-hmac-retirement-2b --prefix ../site
# Publicar artefacto según RELEASE-PUBLISH-PIPELINE-001 / DESKTOP-RELEASE-PRODUCTION-001
```

Actualizar `brands/suhuella/release.json` + publicar.

---

## 3. Verificación post-deploy (PASS / FAIL)

### 3a. Worker — token Ed25519

- [ ] Activar licencia de prueba (Operations gift o checkout test).
- [ ] Inspeccionar token devuelto: debe empezar por `ed25519.` (no solo `body.sig` HMAC).
- [ ] `POST /api/license/check` con ese token → `ok: true`.

### 3b. Desktop — offline pagado (el criterio real)

En build **empaquetado** con claves embebidas (no dev):

1. Activar licencia de prueba en desktop recién instalado (con red).
2. Confirmar edición pagada en Settings.
3. **Modo avión** (o bloquear `suhuella.com`).
4. Reiniciar app.
5. **PASS:** sigue pagado; capacidades de executor respetan token firmado; `offlineUntil` en el futuro.
6. **FAIL:** cae a Free → revisar build env, Worker private key, o mismatch SPKI.

### 3c. Regresión HMAC legacy

- [ ] Licencia emitida **antes** del deploy con token HMAC legacy: `check` server-side sigue OK (`LICENSE_SIGNING_SECRET` intacto).
- [ ] Cliente **0.1.0-pre-rc** antiguo: no empeora (verify local permisivo).

### 3d. OTP y partner (post-rotación secrets)

- [ ] Solicitar código OTP nuevo → verificar → activar (usa `LICENSE_EMAIL_OTP_SECRET`).
- [ ] Login portal partner → sesión nueva (usa `PARTNER_SESSION_SECRET`).

---

## 4. Efectos secundarios esperados (avisar, no sorpresa)

| Cambio | Efecto inmediato | Mitigación |
| --- | --- | --- |
| `PARTNER_SESSION_SECRET` nuevo | **Todas las cookies de sesión partner/applicant activas invalidadas.** Relogin obligatorio. | Avisar partners antes; ventana de bajo tráfico. |
| `LICENSE_EMAIL_OTP_SECRET` nuevo | **Códigos OTP en vuelo invalidados** en el instante del deploy (~10 min TTL). | Usuario pide código de nuevo; impacto mínimo. |
| `LICENSE_SIGNING_PRIVATE_KEY` (Worker) | Nuevas activaciones/checks emiten `ed25519.*`. Tokens HMAC viejos siguen en server verify vía `LICENSE_SIGNING_SECRET`. | Desktop 006+2B: HMAC legacy sigue en gracia online-atestada dentro de `offlineUntil` (sin secret embebido). |
| Clientes sin actualizar desktop | Siguen como hoy (caché permisiva, sin integridad offline). | Ver §5 — comunicación **después** del smoke PASS. |

---

## 5. Comunicación a usuarios (tras smoke test PASS)

**Disparador:** solo después de que §3a + §3b confirmen PASS (token `ed25519.` + modo avión en build empaquetado). Comunicar antes del smoke solo si el release incluye **2B** (sin regresión HMAC); el beneficio Ed25519 offline completo requiere Worker + check online previo.

**Tono:** mejora de fiabilidad offline, no alarma de seguridad ni de licencia en riesgo. El usuario actual no tiene ningún síntoma visible hoy.

**Canal recomendado:** **B + C** (§6) — email activo a pagados + `mandatory: true` en `release.json` para quien abra About.

**No decir:** “reinstala”, “urgente”, “tu licencia está en riesgo”, “bug crítico”, “security breach”.

### 5a. Lista de destinatarios (operador)

Pagados con email en D1 `LICENSE_DB` (ajustar si el esquema difiere):

```bash
cd site
npx wrangler d1 execute suhuella-license --remote --command \
  "SELECT DISTINCT normalized_email FROM license_grant WHERE status = 'active' AND edition != 'free' ORDER BY normalized_email"
```

- Enviar **solo** a inbox que controláis en pre-beta / private beta.
- No usar Resend masivo sin probar primero con una dirección interna.
- **From:** `SuHuella <licenses@suhuella.com>` · **Reply-To:** `support@suhuella.com` (BrandConfig).

### 5b. Email — plantilla (inglés, mismo tono que OTP)

**Subject:** `SuHuella desktop update — improved offline license reliability`

**Body (text):**

```text
Hi,

A new SuHuella desktop release is available with improved offline license verification.

If you use SuHuella without an internet connection, this update helps your paid license stay
recognized reliably while you are offline.

Your license is tied to your account — installing the update does not remove or reset it.

Download the latest version for your computer:
  https://suhuella.com/download

Run the installer on top of your current install. SuHuella stays in the menu bar / tray as usual.

If anything looks wrong after updating, reply to this email — we read support@suhuella.com.

— SuHuella
```

**Body (HTML):** mismo contenido; un enlace a `https://suhuella.com/download`. Sin imágenes de marketing.

### 5c. Nota en sitio de descarga (opcional, mismo deploy)

Añadir una línea breve en `/download` o release notes (no alarmista):

> **Desktop:** Latest release includes improved offline license verification for paid users. Install over your current version — your license is unchanged.

### 5d. `release.json` — visibilidad en About (opción C · Track A)

#### A.1 — Cómo se consume hoy (investigado)

| Capa | Formato | Rol |
| --- | --- | --- |
| **Autoridad** | JSON estricto | `brands/suhuella/release.json` — único archivo que edita el operador |
| **Import TS** | `import … from "./release.json" with { type: "json" }` | `brands/suhuella/brand.ts` → `BrandConfig.release` (`mandatory`; `notes` no van al brand bundle) |
| **Normalización** | JS | `brands/release-manifest-io.mjs` — `mandatory = raw.mandatory === true`, `notes = trim(raw.notes)` |
| **Espejo site** | JSON estricto | `node brands/project-release.mjs` copia autoridad → `site/release.json` (incluye `notes`) |
| **Runtime API** | bundled + deploy | `site/lib/release-manifest.ts` → `GET /api/release` vía `publicReleasePayload()` |
| **Desktop About** | fetch live | `desktop/electron/release-check.ts` → `decideReleaseState({ mandatory, notes, … })` |

**No hay JSONC, no hay generación TS del manifest, no admite comentarios** — JSON.parse / import JSON fallan con `//`.

#### A.1b — `mandatory` + `notes` en producto

1. `decideReleaseState` (`release-lifecycle.ts`): si `installed < latest` y (`mandatory === true` **o** `installed < minimum`) → `kind: 'update_mandatory'`; si no → `update_available`. `notes` viaja en el `ReleaseDecision`.
2. `release-generation-policy.ts`: `update_mandatory` → intent `security_or_maintenance` → copy “An update is recommended. Security fixes are not sold as generation upgrades…”.
3. `PreferencesPanel.tsx` About: muestra `releaseStatusCopy(decision)` + `releaseCheckUserMessage(decision)` + botón descarga si `canInstall`.

**No rompe el framing** — `mandatory: true` es exactamente el camino “security/maintenance” ya descrito.

#### A.2 — Preparación inerte (esta tarea)

**`brands/suhuella/release.json` NO se modifica en repo.** Motivo: JSON estricto sin comentarios; cualquier `mandatory: true` committed activaría el flag en el próximo sync/deploy.

Estado committed hoy (sin cambio):

```json
"mandatory": false,
"notes": ""
```

**Activación 100% manual el día del deploy**, tras smoke PASS (§3 + §8).

#### A.2b — Patch exacto (operador, día del deploy)

En `brands/suhuella/release.json`, cambiar **solo** estos dos campos (dejar `version`, `downloads`, etc. como queden tras publicar el artefacto 006):

```json
"mandatory": true,
"notes": "Improved offline license verification. Install over your current version — your license is unchanged."
```

Luego:

```bash
node brands/project-release.mjs          # espeja → site/release.json
curl -s https://suhuella.com/api/release | jq '{mandatory, notes, latest, minimum}'
# deploy Worker site (bundled release.json) según RELEASE-PUBLISH-PIPELINE-001
```

Desktop About (Settings → About) debe mostrar “Version … is required/recommended” + mensaje security/maintenance.

**Revertir post-adopción (opcional):** volver `mandatory: false`, `notes: ""`, re-sync, re-deploy.

### 5e. Registro en log de deploy

```text
DEPLOY-LOG · LICENSE-ED25519 · YYYY-MM-DD
Smoke PASS: [ ] §3a  [ ] §3b  [ ] §3c
Adopción elegida: [ ] A  [ ] B  [ ] C  [x] B+C
Email enviado: [ ] sí  destinatarios: ___  fecha: ___
release.json mandatory: [ ] true  versión publicada: ___
Operador: ___
```

---

## 6. Adopción del release — decisión consciente (investigado en código)

**Pregunta:** ¿El parque consulta `/api/release` con frecuencia?

**Respuesta (código, sin telemetría de producción):**

| Hecho | Fuente |
| --- | --- |
| **No hay polling en arranque** ni background | `desktop/electron/main.ts` — `release:check` solo vía IPC |
| **Solo al abrir Settings → About** | `PreferencesPanel.tsx` — `useEffect` en `AboutSection` llama `checkRelease()` al montar |
| **Botón manual** “Check for updates” en la misma pantalla | Idem |
| **Sin analytics** de cuántos usuarios llegan a About | `desktop/README.md` — “No cloud, accounts, or analytics in app” |
| **`mandatory: true` no instala nada** | Solo cambia copy en About a “update recommended / required” + enlace descarga; no hay `electron-updater` |

**Conclusión operativa:** asumir que **la mayoría se queda en `0.1.0-pre-rc` indefinidamente** salvo aviso externo o visita espontánea a About. Un aviso pasivo (solo `release.json` + About) **no basta** para llevar integridad offline al parque pagado en semanas razonables.

**Decisión a registrar (operador, no implementar en este doc):**

| Opción | Efecto |
| --- | --- |
| **A — Aviso pasivo** | About + `/api/release`; adopción lenta; integridad offline llega tarde |
| **B — Comunicación activa a pagados** | Email a grants activos / lista Operations; mejor adopción sin cambiar producto |
| **C — `mandatory: true` en este release** | About muestra framing “security/maintenance” (`release-generation-policy.ts`); sigue sin instalación forzada, pero sube visibilidad si el usuario abre About |
| **B + C** | Recomendable para corrección de **integridad** offline, no solo feature |

Registrar en el log de deploy qué opción se eligió y por qué.

---

## 7. Rollback

| Qué falló | Acción |
| --- | --- |
| Worker Ed25519 | `wrangler rollback` (código) **no** revierte secrets. Volver a firmar solo HMAC requiere quitar `LICENSE_SIGNING_PRIVATE_KEY` (operador) o desactivar path Ed25519 en código — **planificar antes**. |
| OTP / partner | `wrangler secret put` con valor anterior si lo guardaste; si no, usuarios deben re-autenticar. |
| Desktop build | Republicar release anterior; usuarios reinstalan. |

---

## 8. Cierre

Marcar **PASS** en `SIGNED-LICENSE-RIGHTS-DELIVERY-006.md` solo cuando §3a + §3b + §3c pasen con evidencia (fecha, versión desktop, captura/log modo avión) **y** §5 / §6 queden registrados (comunicación enviada + decisión de adopción).

Siguiente track (post-PASS): monitorizar D1 (`last_presented_token_algorithm`) hasta cierre 2B en [LICENSE-HMAC-RETIREMENT-2B.md](./LICENSE-HMAC-RETIREMENT-2B.md); retirada de `LICENSE_SIGNING_SECRET` solo tras criterios explícitos.
