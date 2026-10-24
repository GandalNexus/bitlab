/**
 * BitLab — tests hors-ligne du cœur de minage Testnet4 (Vitest).
 *
 * Référence absolue : l'en-tête genesis Testnet4 réel (données réseau,
 * hash et nonce vérifiés contre l'explorateur) — aucun vecteur inventé.
 * Le double-SHA256 de référence vient de node:crypto (indépendant de
 * @noble/hashes utilisé par le code applicatif).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hex } from '@scure/base';
import {
  MIN_DIFF_BITS,
  assembleBlock,
  assembleHeader76,
  bip34Script,
  blockHash,
  blockSubsidy,
  buildCoinbase,
  compactBitsToTarget,
  headerMeetsTarget,
  headerU32,
  windowStatus,
} from '../src/lib/mining/core';
import { addressToScript, decodeRawTx } from '../src/lib/bitcoin/tx';
import { createWallet } from '../src/lib/bitcoin/keys';
import { BASE_SUBSIDY_SATS, HALVING_INTERVAL } from '../src/lib/regtest-engine/params';

/** Genesis Testnet4 : hauteur 0, nBits 0x1d00ffff, nonce 393743547. */
const GENESIS_HEADER =
  '0100000000000000000000000000000000000000000000000000000000000000000000004e7b2b9128fe0291db0693af2ae418b767e657cd407e80cb1434221eaea7a07a046f3566ffff001dbb0c7817';
const GENESIS_HASH = '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043';
const GENESIS_NONCE = 393743547;
const GENESIS_TIME = 1714777860;

const sha256d = (buf: Uint8Array) =>
  createHash('sha256').update(createHash('sha256').update(buf).digest()).digest();

describe('compactBitsToTarget', () => {
  it('décode la difficulté minimale 0x1d00ffff', () => {
    const target = compactBitsToTarget(MIN_DIFF_BITS);
    // 0xffff × 256^26 → 6 premiers octets 00 00 00 FF FF 00.
    expect([...target.subarray(0, 6)]).toEqual([0x00, 0x00, 0x00, 0xff, 0xff, 0x00]);
    expect(target.subarray(6).every((b) => b === 0)).toBe(true);
  });

  it('rejette un exposant absurde', () => {
    expect(() => compactBitsToTarget(0x0200ffff)).toThrow();
  });
});

describe('blockSubsidy (halvings par réseau — règle de consensus)', () => {
  it('regtest : 50 BTC → halving tous les 150 blocs', () => {
    expect(blockSubsidy(1, 'regtest')).toBe(5_000_000_000);
    expect(blockSubsidy(149, 'regtest')).toBe(5_000_000_000); // dernier bloc de l'ère 0
    expect(blockSubsidy(150, 'regtest')).toBe(2_500_000_000); // le halving s'applique AU bloc 150
    // Hauteur du signalement utilisateur : 4e ère → 312 500 000 sats (3,125 tBTC).
    expect(blockSubsidy(600, 'regtest')).toBe(312_500_000);
    expect(blockSubsidy(661, 'regtest')).toBe(312_500_000);
    expect(blockSubsidy(751, 'regtest')).toBe(156_250_000);
  });

  it('testnet4 : 50 BTC → halving tous les 210 000 blocs', () => {
    expect(blockSubsidy(1, 'testnet4')).toBe(5_000_000_000);
    expect(blockSubsidy(209_999, 'testnet4')).toBe(5_000_000_000);
    expect(blockSubsidy(210_000, 'testnet4')).toBe(2_500_000_000);
  });

  it('genèse et ères épuisées → 0', () => {
    expect(blockSubsidy(0, 'regtest')).toBe(0);
    expect(blockSubsidy(-1, 'testnet4')).toBe(0);
    expect(blockSubsidy(150 * 64, 'regtest')).toBe(0); // 64 halvings
  });

  it('cohérence avec le moteur embarqué regtest (même formule de consensus)', () => {
    // Le gabarit du mineur doit réclamer exactement la subvention du moteur
    // — toute divergence redonne « coinbase excessive » à la diffusion.
    for (const h of [1, 149, 150, 151, 300, 450, 600, 661, 900, 1500]) {
      expect(blockSubsidy(h, 'regtest')).toBe(blockSubsidyRefRegtest(h));
    }
  });
});

/** Référence indépendante : formule de chainparams (engine/params.ts). */
function blockSubsidyRefRegtest(height: number): number {
  if (height <= 0) return 0;
  const halvings = Math.floor(height / HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  return Math.floor(BASE_SUBSIDY_SATS / 2 ** halvings);
}

describe('bip34Script (encodage CScriptNum minimal de la hauteur)', () => {
  it('hauteur 1 → push 1 octet', () => {
    expect([...bip34Script(1)]).toEqual([0x01, 0x01]);
  });

  it('hauteur 1000 → push 2 octets little-endian', () => {
    expect([...bip34Script(1000)]).toEqual([0x02, 0xe8, 0x03]);
  });

  it('hauteur 157319 → push 3 octets', () => {
    // 157319 = 0x026687 → LE : 87 66 02.
    expect([...bip34Script(157319)]).toEqual([0x03, 0x87, 0x66, 0x02]);
  });

  it('rejette les hauteurs non entières et 0', () => {
    expect(() => bip34Script(0)).toThrow();
    expect(() => bip34Script(1.5)).toThrow();
  });
});

describe('buildCoinbase', () => {
  const w = createWallet('segwit', 12);
  const script = addressToScript(w.address);

  const cb = buildCoinbase({
    height: 157319,
    scriptPubKey: script,
    valueSats: 5_000_000_000,
    tag: new TextEncoder().encode('/BitLab/abcd1234'),
  });

  it('produit une tx décodable : version 2, prevout nul, sortie 50 tBTC', () => {
    const decoded = decodeRawTx(cb.txHex);
    expect(decoded.version).toBe(2);
    expect(decoded.inputs[0].txid).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(decoded.inputs[0].vout).toBe(0xffffffff);
    expect(decoded.outputs[0].valueSats).toBe(5_000_000_000);
    expect(decoded.outputs[0].scriptHex).toBe(hex.encode(script));
  });

  it('calcule un txid cohérent avec node:crypto (référence indépendante)', () => {
    const expected = hex.encode(sha256d(hex.decode(cb.txHex)).reverse());
    expect(cb.txid).toBe(expected);
  });
});

describe('assembleHeader76 / assembleBlock / blockHash', () => {
  const GENESIS_TXID = '7aa0a7ae1e223414cb807e40cd57e667b718e42aaf9306db9102fe28912b7b4e';

  it('reconstruit l’en-tête genesis octet par octet (version moderne)', () => {
    // Le genesis réel porte version 1 ; notre mineur émet la version standard
    // 0x20000000 — tous les autres champs doivent coller octet pour octet.
    const header76 = assembleHeader76({
      tipHashHex: '0'.repeat(64),
      txidHex: GENESIS_TXID,
      tipTimeSec: GENESIS_TIME - 1201,
      nowMs: GENESIS_TIME * 1000,
      bits: MIN_DIFF_BITS,
    });
    const block = assembleBlock(header76, GENESIS_NONCE, '');
    const expected = '00000020' + GENESIS_HEADER.slice(8);
    expect(block).toBe(expected);
    // NB : le nonce genesis ne résout le PoW qu'avec la version 1 d'origine —
    // la validité du PoW est couverte par le test du hash genesis réel.
  });

  it('calcule le hash genesis attendu et valide le PoW contre la cible', () => {
    expect(blockHash(GENESIS_HEADER)).toBe(GENESIS_HASH);
    expect(headerMeetsTarget(GENESIS_HEADER, compactBitsToTarget(MIN_DIFF_BITS))).toBe(true);
  });

  it('rejette un en-tête dont le nonce ne résout pas le PoW', () => {
    const bumped = GENESIS_HEADER.slice(0, 152) + 'bb0c7818'; // nonce + 1
    expect(headerMeetsTarget(bumped, compactBitsToTarget(MIN_DIFF_BITS))).toBe(false);
  });

  it('assembleHeader76 sérialise bien en little-endian', () => {
    const header76 = assembleHeader76({
      tipHashHex: GENESIS_HASH,
      txidHex: GENESIS_TXID,
      tipTimeSec: GENESIS_TIME,
      nowMs: GENESIS_TIME * 1000,
      bits: MIN_DIFF_BITS,
    });
    const bytes = hex.decode(header76);
    // version 0x20000000 → LE : 00 00 00 20.
    expect([...bytes.subarray(0, 4)]).toEqual([0x00, 0x00, 0x00, 0x20]);
    // prev hash stocké à l’envers (affichage big-endian → champ LE).
    expect(hex.encode(bytes.subarray(4, 36))).toBe(hex.encode(hex.decode(GENESIS_HASH).reverse()));
    // nTime ≥ tipTime + 1201 (fenêtre BIP 94).
    const time = headerU32(header76, 68);
    expect(time).toBeGreaterThanOrEqual(GENESIS_TIME + 1201);
    // nBits à l’offset 72.
    expect(headerU32(header76, 72)).toBe(MIN_DIFF_BITS);
  });
});

describe('headerU32', () => {
  it('lit nTime et nBits du genesis (little-endian)', () => {
    expect(headerU32(GENESIS_HEADER, 68)).toBe(GENESIS_TIME);
    expect(headerU32(GENESIS_HEADER, 72)).toBe(MIN_DIFF_BITS);
  });
});

describe('windowStatus (règle BIP 94 + tips futuristes)', () => {
  const now = 1_800_000_000_000;
  const nowSec = Math.floor(now / 1000);

  it('gap réel court (600 s) : minable via post-datation dans la limite des pairs', () => {
    // BIP 94 compare les horodatages d'en-têtes : un bloc à tip + 1201 s
    // (≈ +10 min dans le futur) est valide — la fenêtre est ouverte.
    const win = windowStatus(nowSec - 600, now, 157319);
    expect(win.open).toBe(true);
    expect(win.reason).toBe('gap-ok');
  });

  it('fenêtre ouverte à 1200 s de gap réel et plus', () => {
    expect(windowStatus(nowSec - 1200, now, 157319).open).toBe(true);
    expect(windowStatus(nowSec - 1200, now, 157319).reason).toBe('gap-ok');
    expect(windowStatus(nowSec - 3600, now, 157319).open).toBe(true);
  });

  it('tip dans le futur (≤ limite des pairs) : minable immédiatement', () => {
    // Les bots BIP 94 datent leurs blocs dans le futur ; la règle compare
    // les horodatages des en-têtes, pas l'horloge murale.
    const win = windowStatus(nowSec + 5000, now, 157319);
    expect(win.open).toBe(true);
    expect(win.reason).toBe('gap-ok');
  });

  it('tip trop loin dans le futur : fenêtre fermée, compte à rebours', () => {
    // blockTime = tip + 1201 = now + 7201 > now + 7100 (marge) → attente.
    const win = windowStatus(nowSec + 6000, now, 157319);
    expect(win.open).toBe(false);
    expect(win.reason).toBe('gap-wait');
    expect(win.secondsUntilOpen).toBe(6000 + 1201 - 7100);
  });

  it('interdit le min-diff au premier bloc d’une période (hauteur % 2016 = 0)', () => {
    const win = windowStatus(nowSec - 7200, now, 159264); // 2016 × 79
    expect(win.open).toBe(false);
    expect(win.reason).toBe('boundary-block');
  });
});

describe('moteur JS de secours (public/miner/js-engine.js)', () => {
  it('retrouve le nonce genesis et égale node:crypto', async () => {
    // @ts-expect-error module JS brut servi hors bundler (sans types)
    const { mineBatchJS, sha256dJS } = await import('../public/miner/js-engine.js');
    const header76 = hex.decode(GENESIS_HEADER.slice(0, 152));
    const target = compactBitsToTarget(MIN_DIFF_BITS);
    expect(mineBatchJS(header76, target, GENESIS_NONCE, 1)).toBe(GENESIS_NONCE);
    expect(mineBatchJS(header76, target, 0, 500_000)).toBe(-1);
    // sha256dJS === référence node:crypto.
    const digest = sha256dJS(hex.decode(GENESIS_HEADER));
    expect(hex.encode(new Uint8Array(digest))).toBe(hex.encode(sha256d(hex.decode(GENESIS_HEADER))));
  });
});
