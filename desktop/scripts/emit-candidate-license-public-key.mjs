/**
 * Emit one Ed25519 SPKI public key (base64url) for CI compile/candidate builds when
 * SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS is not configured yet.
 * NOT for production — Worker must deploy matching LICENSE_SIGNING_PUBLIC_KEYS before release.
 * Caller must set SUHUELLA_LICENSE_KEYS_EPHEMERAL=1 (see desktop-windows-build.yml).
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey } = generateKeyPairSync('ed25519')
const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')
console.error('[license-keys] ephemeral SPKI generated for CI artifact — not production Worker keys')
process.stdout.write(spki)
