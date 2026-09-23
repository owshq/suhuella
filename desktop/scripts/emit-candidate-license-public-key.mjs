/**
 * Emit one Ed25519 SPKI public key (base64url) for CI candidate builds when
 * SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS is not configured yet.
 * NOT for production — Worker must deploy matching LICENSE_SIGNING_PUBLIC_KEYS before release.
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey } = generateKeyPairSync('ed25519')
const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')
process.stdout.write(spki)
