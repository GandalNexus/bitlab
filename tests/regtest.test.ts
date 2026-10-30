/**
 * BitLab — tests hors-ligne du support regtest (Vitest).
 *
 * Le regtest est la chaîne privée de l'utilisateur : dérivation d'adresses
 * bcrt, traduction Core ⇄ Esplora (fonctions pures), garde-fous de config
 * du nœud local et gabarits de minage à difficulté 1. Aucun réseau, aucun
 * DOM — tout est vérifiable offline.
 */
import { describe, expect, it } from 'vitest';
import { hex } from '@scure/base';
import { WIF } from '@scure/btc-signer';
import {
  blockHashByHeight,
  btcToSats,
  chainInfoToTipHash,
  chainInfoToTipHeight,
  coreBlockToSummary,
  coreTxToEsplora,
  headersToFirstHeader,
  mempoolContentsToRecent,
  mempoolInfoToStats,
  planRegtestRequest,
  scantxoutsetToAddressInfo,
  scantxoutsetToUtxos,
} from '../src/lib/bitcoin/regtest-translate';
import { decodeRegtestHeader, isLocalHost } from '../src/lib/regtest';
import { NETWORKS, NET_ORDER, REGTEST_NETWORK, pathForNetwork, signerNetwork } from '../src/lib/networks';
import { deriveForType } from '../src/lib/bitcoin/keys';
import {
  REGTEST_MIN_BITS,
  assembleHeader76,
  blockHash,
  buildCoinbase,
  compactBitsToTarget,
  headerMeetsTarget,
  headerU32,
} from '../src/lib/mining/core';
import { addressToScript } from '../src/lib/bitcoin/tx';

/** Clé privée fixe (déterministe, usage test uniquement). */
const PRIV = hex.decode('1111111111111111111111111111111111111111111111111111111111111111');

describe('registre des réseaux (regtest ajouté sans rupture)', () => {
  it('expose le regtest dans l’ordre et l’ordre existant est intact', () => {
    expect(NET_ORDER).toEqual(['testnet4', 'testnet3', 'signet', 'regtest', 'mainnet']);
    expect(Object.keys(NETWORKS).sort()).toEqual(['mainnet', 'regtest', 'signet', 'testnet3', 'testnet4']);
  });

  it('marque le regtest local et minable, les autres inchangés', () => {
    expect(NETWORKS.regtest).toMatchObject({ local: true, mineable: 'local', realFunds: false, coinType: 1 });
    expect(NETWORKS.testnet4.mineable).toBe('bip94');
    expect(NETWORKS.testnet3.mineable).toBe('none');
    expect(NETWORKS.signet.mineable).toBe('none');
    expect(NETWORKS.mainnet.mineable).toBe('none');
    expect(NETWORKS.mainnet.realFunds).toBe(true);
  });

  it('paramètres regtest : HRP bcrt, préfixes Base58 testnet, WIF 0xEF', () => {
    expect(REGTEST_NETWORK).toEqual({ bech32: 'bcrt', pubKeyHash: 111, scriptHash: 196, wif: 0xef });
    expect(signerNetwork('regtest')).toBe(REGTEST_NETWORK);
    expect(signerNetwork('testnet4')).not.toBe(REGTEST_NETWORK);
  });

  it('chemins de dérivation : coinType 1 conservé (comme testnet)', () => {
    expect(pathForNetwork("m/84'/1'/0'/0/0", 'regtest')).toBe("m/84'/1'/0'/0/0");
    expect(pathForNetwork("m/84'/1'/0'/0/0", 'mainnet')).toBe("m/84'/0'/0'/0/0");
  });
});

describe('adresses et WIF regtest', () => {
  it('dérive des adresses bcrt1… (segwit), bcrt1p… (taproot), m/n (legacy)', () => {
    const segwit = deriveForType(PRIV, 'segwit', 'regtest');
    const taproot = deriveForType(PRIV, 'taproot', 'regtest');
    const legacy = deriveForType(PRIV, 'legacy', 'regtest');
    expect(segwit.address.startsWith('bcrt1q')).toBe(true);
    expect(taproot.address.startsWith('bcrt1p')).toBe(true);
    expect(/^[mn]/.test(legacy.address)).toBe(true);
    // Même clé → données bech32 identiques sur testnet4 et regtest (préfixes
    // Base58 partagés), hors checksum — il dépend du HRP. La validation réseau
    // reste stricte : un tb1… n'est jamais un bcrt1….
    const segwitTestnet = deriveForType(PRIV, 'segwit', 'testnet4');
    expect(segwit.address.slice(5, -6)).toBe(segwitTestnet.address.slice(3, -6));
  });

  it('encode un WIF préfixe regtest (0xEF) et reboucle via walletFromWif', async () => {
    const wif = WIF(REGTEST_NETWORK).encode(PRIV);
    expect(wif.startsWith('c')).toBe(true); // 0xEF → préfixe « c » (comme testnet)
    const { walletFromWif } = await import('../src/lib/bitcoin/keys');
    const w = walletFromWif(wif, 'segwit', undefined, 'regtest');
    expect(w.privateKeyHex).toBe(hex.encode(PRIV));
    expect(w.address).toBe(deriveForType(PRIV, 'segwit', 'regtest').address);
    expect(w.network).toBe('regtest');
  });
});

describe('regtest-translate : montants et tip', () => {
  it('btcToSats : précision entière sur les montants décimaux Core', () => {
    expect(btcToSats(50)).toBe(5_000_000_000);
    expect(btcToSats(12.3456789)).toBe(1_234_567_890);
    expect(btcToSats(0.00000001)).toBe(1);
    expect(btcToSats('0.1')).toBe(10_000_000);
    expect(btcToSats(undefined)).toBe(0);
    expect(btcToSats(-1)).toBe(0);
  });

  it('chainInfo → hauteur et hash du tip', () => {
    const info = { blocks: 204, bestblockhash: '0123456789abcdef'.repeat(4) };
    expect(chainInfoToTipHeight(info)).toBe(204);
    expect(chainInfoToTipHash(info)).toBe('0123456789abcdef'.repeat(4));
    expect(chainInfoToTipHeight({})).toBeNull();
    expect(chainInfoToTipHash({ bestblockhash: 'zz' })).toBeNull();
  });

  it('blockHashByHeight accepte les deux formes Core (objet ou chaîne brute)', () => {
    const h = 'a'.repeat(64);
    expect(blockHashByHeight({ blockhash: h })).toBe(h);
    expect(blockHashByHeight(`"${h}"`)).toBe(h);
    expect(blockHashByHeight({ blockhash: 'nope' })).toBeNull();
    expect(blockHashByHeight(null)).toBeNull();
  });

  it('headers → premier en-tête 160 hex minuscule', () => {
    const header = 'ab'.repeat(80);
    expect(headersToFirstHeader([header])).toBe(header);
    expect(headersToFirstHeader(['short'])).toBeNull();
    expect(headersToFirstHeader('pas un tableau')).toBeNull();
  });
});

describe('regtest-translate : transactions et UTXOs', () => {
  it('coreTxToEsplora traduit vin/vout au format Esplora', () => {
    const core = {
      txid: 'b'.repeat(64),
      version: 2,
      locktime: 0,
      size: 222,
      weight: 561,
      vin: [
        {
          txid: 'c'.repeat(64),
          vout: 1,
          sequence: 4294967293,
          prevout: {
            value: 50.0,
            scriptPubKey: { hex: '0014abcd', address: 'bcrt1qxy' },
          },
        },
        { coinbase: '0102', sequence: 4294967295 },
      ],
      vout: [
        { value: 49.9999, n: 0, scriptPubKey: { hex: '0014beef', address: 'bcrt1qaa' } },
        { value: 0.0001, n: 1, scriptPubKey: { hex: '76a9', addresses: ['n1legacy'] } },
      ],
    };
    const tx = coreTxToEsplora(core, 'b'.repeat(64));
    expect(tx.txid).toBe('b'.repeat(64));
    expect(tx.version).toBe(2);
    expect(tx.vin[0]).toMatchObject({ txid: 'c'.repeat(64), vout: 1, is_coinbase: false });
    expect(tx.vin[0].prevout).toMatchObject({ scriptpubkey: '0014abcd', scriptpubkey_address: 'bcrt1qxy', value: 5_000_000_000 });
    expect(tx.vin[1].is_coinbase).toBe(true);
    expect(tx.vout[0]).toEqual({ scriptpubkey_address: 'bcrt1qaa', value: 4_999_990_000 });
    expect(tx.vout[1]).toEqual({ scriptpubkey_address: 'n1legacy', value: 10_000 });
    expect(tx.status).toEqual({ confirmed: true });
  });

  it('scantxoutset → UTXOs + synthèse d’adresse (solde = non dépensé)', () => {
    const res = {
      success: true,
      total_amount: 62.5,
      unspents: [
        { txid: 'd'.repeat(64), vout: 0, amount: 50.0, height: 101, desc: 'addr(bcrt1q)#x', scriptPubKey: '0014aa' },
        { txid: 'e'.repeat(64), vout: 2, amount: 12.5, height: 103, desc: 'addr(bcrt1q)#y', scriptPubKey: '0014bb' },
      ],
    };
    const utxos = scantxoutsetToUtxos(res);
    expect(utxos).toHaveLength(2);
    expect(utxos[0]).toMatchObject({ txid: 'd'.repeat(64), vout: 0, value: 5_000_000_000, status: { confirmed: true, block_height: 101 } });
    const info = scantxoutsetToAddressInfo(res, 'bcrt1qtest');
    expect(info.address).toBe('bcrt1qtest');
    expect(info.chain_stats.funded_txo_sum).toBe(6_250_000_000);
    expect(info.chain_stats.spent_txo_sum).toBe(0);
    // Entrées corrompues filtrées, pas de crash.
    expect(scantxoutsetToUtxos({ unspents: [{ txid: 'zz' }, null] })).toEqual([]);
    expect(scantxoutsetToUtxos(null)).toEqual([]);
  });
});

describe('regtest-translate : mempool et blocs', () => {
  it('mempool/info → statistiques', () => {
    const stats = mempoolInfoToStats({ size: 3, bytes: 900, total_fee: 0.00001234 });
    expect(stats).toEqual({ count: 3, vsize: 900, total_fee: 1234, fee_histogram: [] });
  });

  it('mempool/contents → transactions récentes (deux formes de frais Core)', () => {
    const contents = {
      aa: { fee: 0.00001, size: 220, time: 1, height: 2 },
      bb: { fees: { base: 0.00002 }, vsize: 141, time: 2, height: 2 },
    };
    const recent = mempoolContentsToRecent(contents);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toEqual({ txid: 'bb', fee: 2000, vsize: 141, value: 0 });
    expect(recent[1].fee).toBe(1000);
    expect(mempoolContentsToRecent([1, 2])).toEqual([]);
  });

  it('coreBlockToSummary → résumé de liste', () => {
    const b = coreBlockToSummary({ hash: 'f'.repeat(64), height: 42, time: 1_700_000_000, size: 900, tx: [{}, {}] });
    expect(b).toEqual({ id: 'f'.repeat(64), height: 42, timestamp: 1_700_000_000, tx_count: 2, size: 900 });
    expect(coreBlockToSummary({ height: 1 })).toBeNull();
  });
});

describe('planRegtestRequest : routage des chemins Esplora', () => {
  it('statique (frais), vide (historique) et refus (chemin inconnu)', () => {
    expect(planRegtestRequest('v1/fees/recommended')).toEqual({
      kind: 'static',
      body: { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 },
      type: 'json',
    });
    expect(planRegtestRequest('address/bcrt1qxyz/txs')).toEqual({ kind: 'empty', type: 'json' });
    expect(planRegtestRequest('v1/lightning/statistics/latest').kind).toBe('unsupported');
  });

  it('RPC scantxoutset pour le solde et les UTXOs', () => {
    expect(planRegtestRequest('address/bcrt1qxyz')).toEqual({ kind: 'rpc', method: 'scantxoutset', address: 'bcrt1qxyz' });
    expect(planRegtestRequest('address/bcrt1qxyz/utxo')).toEqual({ kind: 'rpc', method: 'scantxoutset', address: 'bcrt1qxyz' });
  });

  it('REST pour tip, tx, blocs et mempool', () => {
    expect(planRegtestRequest('blocks/tip/height')).toEqual({ kind: 'rest', upstream: 'chaininfo.json', accept: 'json' });
    expect(planRegtestRequest('blocks/tip/hash')).toEqual({ kind: 'rest', upstream: 'chaininfo.json', accept: 'json' });
    expect(planRegtestRequest(`tx/${'a'.repeat(64)}`)).toEqual({ kind: 'rest', upstream: `tx/${'a'.repeat(64)}.json`, accept: 'json' });
    expect(planRegtestRequest(`tx/${'a'.repeat(64)}/hex`)).toEqual({ kind: 'rest', upstream: `tx/${'a'.repeat(64)}.hex`, accept: 'hex' });
    expect(planRegtestRequest(`block/${'b'.repeat(64)}/raw`)).toEqual({ kind: 'rest', upstream: `block/${'b'.repeat(64)}.bin`, accept: 'bin' });
    expect(planRegtestRequest(`block/${'b'.repeat(64)}/header`)).toEqual({ kind: 'rest', upstream: `headers/1/${'b'.repeat(64)}.json`, accept: 'json' });
    expect(planRegtestRequest('block-height/150')).toEqual({ kind: 'rest', upstream: 'blockhashbyheight/150.json', accept: 'json' });
    expect(planRegtestRequest('mempool')).toEqual({ kind: 'rest', upstream: 'mempool/info.json', accept: 'json' });
    expect(planRegtestRequest('mempool/recent')).toEqual({ kind: 'rest', upstream: 'mempool/contents.json', accept: 'json' });
    expect(planRegtestRequest('v1/blocks')).toEqual({ kind: 'rest', upstream: 'chaininfo.json', accept: 'json' });
  });
});

describe('config du nœud local (garde anti-SSRF)', () => {
  it('isLocalHost : boucle locale et LAN seulement', () => {
    for (const h of ['127.0.0.1', 'localhost', '::1', '10.0.0.5', '192.168.1.20', '172.16.0.1', '172.31.255.255']) {
      expect(isLocalHost(h)).toBe(true);
    }
    for (const h of ['mempool.space', '8.8.8.8', '11.0.0.1', '172.32.0.1', '192.169.1.1', '', 'example.com']) {
      expect(isLocalHost(h)).toBe(false);
    }
  });

  it('decodeRegtestHeader : aller-retour JSON base64 + rejets propres', () => {
    const payload = Buffer.from(JSON.stringify({ host: '127.0.0.1', port: 18443, user: 'u', pass: 'p' })).toString('base64');
    expect(decodeRegtestHeader(payload)).toEqual({ host: '127.0.0.1', port: 18443, user: 'u', pass: 'p' });
    expect(decodeRegtestHeader(null)).toBeNull();
    expect(decodeRegtestHeader('pas-du-base64!')).toBeNull();
    const badPort = Buffer.from(JSON.stringify({ host: '127.0.0.1', port: 99_999 })).toString('base64');
    expect(decodeRegtestHeader(badPort)).toBeNull();
  });
});

describe('minage regtest : difficulté 1, gabarits continus', () => {
  it('REGTEST_MIN_BITS (0x207fffff) décode vers une cible quasi libre', () => {
    const target = compactBitsToTarget(REGTEST_MIN_BITS);
    // Mantisse 0x7fffff × 256^29 : cible big-endian standard « 7fffff » suivi
    // de 29 octets nuls (la formule inversée produisait « ffff7f » + un
    // décalage d'un octet dès que le MSB de la mantisse est nul).
    expect([...target.subarray(0, 3)]).toEqual([0x7f, 0xff, 0xff]);
    expect(target.subarray(3).every((b) => b === 0)).toBe(true);
  });

  it('timeGapSec = 0 : nTime = max(maintenant, tip + 1) — pas de datation BIP 94', () => {
    const nowMs = 1_800_000_000_000;
    const tipTime = Math.floor(nowMs / 1000) - 3600; // chaîne regtest inactive depuis 1 h
    const header76 = assembleHeader76({
      tipHashHex: '1'.repeat(64),
      txidHex: '2'.repeat(64),
      tipTimeSec: tipTime,
      nowMs,
      bits: REGTEST_MIN_BITS,
      timeGapSec: 0,
    });
    expect(headerU32(header76, 68)).toBe(Math.floor(nowMs / 1000));
    // La seconde suivante suffit même si le tip date de la même seconde (règle MTP).
    const consecutive = assembleHeader76({
      tipHashHex: '1'.repeat(64),
      txidHex: '2'.repeat(64),
      tipTimeSec: Math.floor(nowMs / 1000),
      nowMs,
      bits: REGTEST_MIN_BITS,
      timeGapSec: 0,
    });
    expect(headerU32(consecutive, 68)).toBe(Math.floor(nowMs / 1000) + 1);
  });

  it('bloc regtest complet : coinbase bcrt → nonce trouvé en quelques hachages', () => {
    const address = deriveForType(PRIV, 'segwit', 'regtest').address;
    const { txHex, txid } = buildCoinbase({
      height: 205,
      scriptPubKey: addressToScript(address, 'regtest'),
      valueSats: 5_000_000_000,
      tag: new TextEncoder().encode('/BitLab/regtest01'),
    });
    const header76 = assembleHeader76({
      tipHashHex: '3'.repeat(64),
      txidHex: txid,
      tipTimeSec: 1_800_000_000,
      nowMs: 1_800_000_000_000,
      bits: REGTEST_MIN_BITS,
      timeGapSec: 0,
    });
    const target = compactBitsToTarget(REGTEST_MIN_BITS);
    let nonce = -1;
    for (let n = 0; n < 1_000_000; n++) {
      // Test direct sur l'en-tête assemblé (le worker balaie le champ nonce).
      const candidate = header76 + n.toString(16).padStart(8, '0');
      if (headerMeetsTarget(candidate, target)) {
        nonce = n;
        break;
      }
    }
    expect(nonce).toBeGreaterThanOrEqual(0);
    // Difficulté 1 ≈ 1,5 hachage attendu par bloc : un nonce < 1000 est
    // statistiquement certain (p(échec) < 10^-400) — c'est le propos pédagogique.
    expect(nonce).toBeLessThan(1000);
    const hash = blockHash(header76 + (nonce as number).toString(16).padStart(8, '0'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // La coinbase référence bien l'adresse bcrt (script P2WPKH 0014…).
    expect(txHex).toContain(hex.encode(addressToScript(address, 'regtest')));
  });
});
