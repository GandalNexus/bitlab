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

try {
  init.self_test();
  check('self_test du crate (FIPS 180-4, genesis testnet4, nonce 393743547)', true);
} catch (err) {
  check('self_test du crate', false, String(err));
  process.exit(1);
}

for (const msgHex of ['', 'abcd', '68656c6c6f']) {
  const got = init.sha256d_hex(msgHex);
  const want = sha256dCrypto(msgHex);
  check(`sha256d_hex(${msgHex || '(vide)'})`, got === want, `${got.slice(0, 16)}…`);
}

const target = init.target_from_bits_hex('ffffff20');
const wantTarget = '7fffff' + '00'.repeat(29);
check('target_from_bits_hex(0x207fffff)', target === wantTarget, target.slice(0, 16) + '…');

if (failures > 0) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nMoteur de minage WASM sain.');
