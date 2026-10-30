/**
 * BitLab — auto-vérification du moteur de minage WASM (public/miner/).
 *
 * Charge le binaire commité exactement comme le ferait le Web Worker (glue
 * no-modules + pont ESM) puis :
 *   1. exécute `self_test` du crate : vecteurs FIPS 180-4 (SHA-256), hash du
 *      header genesis Testnet4 réel vers le hash officiel du bloc 0, et
 *      récupération du nonce genesis (393743547) par `mine_batch` en une
 *      itération — tout échec lève une exception avec le détail ;
 *   2. contre-vérifie `sha256d_hex` contre node:crypto ;
 *   3. contre-vérifie `target_from_bits_hex` sur une cible exacte
 *      (0x207fffff → mantisse 0x7fffff × 256^(32-3), plein 32 octets).
 *
 * Usage : node scripts/check-miner-wasm.mjs   (exit 0 = moteur sain)
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MINER_DIR = path.resolve(HERE, '../public/miner');

const glue = await import(pathToFileURL(path.join(MINER_DIR, 'miner_bg.js')).href);
const init = glue.default;
await init(readFileSync(path.join(MINER_DIR, 'miner_bg.wasm')));

const sha256dCrypto = (hex) =>
  createHash('sha256').update(createHash('sha256').update(Buffer.from(hex, 'hex')).digest()).digest('hex');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// 1. Self-test du crate (FIPS 180-4 + genesis testnet4 + nonce recovery).
try {
  init.self_test();
  check('self_test du crate (FIPS 180-4, genesis testnet4, nonce 393743547)', true);
} catch (err) {
  check('self_test du crate', false, String(err));
  process.exit(1);
}

// 2. sha256d_hex contre node:crypto sur quelques vecteurs.
for (const msgHex of ['', 'abcd', '68656c6c6f']) {
  const got = init.sha256d_hex(msgHex);
  const want = sha256dCrypto(msgHex);
  check(`sha256d_hex(${msgHex || '(vide)'})`, got === want, `${got.slice(0, 16)}…`);
}

// 3. Cible exacte : nBits 0x207fffff (format wire « ffffff20 ») → mantisse
//    0x7fffff × 256^29 = « 7fffff » suivi de 29 octets nuls (big-endian
//    standard — la formule inversée produisait « ffff7f » et un décalage
//    d'un octet dès que le MSB de la mantisse est nul).
const target = init.target_from_bits_hex('ffffff20');
const wantTarget = '7fffff' + '00'.repeat(29);
check('target_from_bits_hex(0x207fffff)', target === wantTarget, target.slice(0, 16) + '…');

if (failures > 0) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nMoteur de minage WASM sain.');
