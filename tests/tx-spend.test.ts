/**
 * BitLab — tests d'envoi entre portefeuilles (Vitest, 100 % hors-ligne).
 *
 * Objectif : prouver que le constructeur de transactions de l'application
 * (buildSignedTx, le même code que celui exécuté dans le navigateur) produit
 * des dépenses acceptées par le moteur regtest embarqué (acceptTx = mêmes
 * règles que Bitcoin Core : BIP 143, BIP 341 key-path, maturité coinbase,
 * anti double-dépense), entre portefeuilles de même type ET de types
 * différents (segwit P2WPKH, taproot P2TR, legacy P2PKH).
 *
 * Le scénario reproduit l'usage réel : deux portefeuilles créés dans le labo,
 * l'un financé, l'autre vide, envoi d'un montant avec change au portefeuille
 * source — exactement le flux « Sélectionner → Construire → Signer → Diffuser ».
 */
import { describe, expect, it } from 'vitest';
import { hex } from '@scure/base';
import {
  RegtestChain,
  addressToScriptBcrt,
} from '../src/lib/regtest-engine/chain';
import { registerNetGetter } from '../src/lib/networks';
import { deriveForType, type AddrType } from '../src/lib/bitcoin/keys';
import { buildSignedTx, estimateVsize, type Utxo } from '../src/lib/bitcoin/tx';
import { RX } from '../src/lib/bitcoin/utils';

// Tout le module tx.ts (décodeur d'adresses, scripts, changements) suit le
// réseau actif du store : on force le regtest embarqué pour ces tests.
registerNetGetter(() => 'regtest');

/** Chaîne regtest neuve en mémoire (préminage 101 blocs → 100 tBTC mûrs). */
const chain = new RegtestChain();

/** 5 tBTC en sats — financement de référence d'un portefeuille de test. */
const FUNDING = 500_000_000;
/** 1 tBTC en sats — montant de référence d'un envoi. */
const SEND = 100_000_000;

interface TestWallet {
  type: AddrType;
  privHex: string;
  address: string;
}

/** Portefeuille déterministe (clé dérivée de `seed`) via le code réel du labo. */
function makeWallet(seed: number, type: AddrType): TestWallet {
  const priv = hex.decode(seed.toString(16).padStart(64, '0'));
  const { address } = deriveForType(priv, type, 'regtest');
  return { type, privHex: hex.encode(priv), address };
}

/** Solde confirmé (forme Esplora du moteur embarqué). */
function balanceOf(address: string): number {
  const info = chain.addressInfo(address);
  return info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
}

/** Finance `address` via le faucet réel du moteur (tx P2WPKH signée + 1 bloc). */
function fund(address: string): void {
  chain.faucetSend(address, FUNDING);
}

/** Envoi signé par buildSignedTx puis accepté et confirmé par le moteur. */
function spend(
  from: TestWallet,
  outputs: { address: string; amountSats: number }[],
  opts: { feeRateSatVb?: number; utxos?: Utxo[] } = {},
) {
  const res = buildSignedTx({
    utxos: opts.utxos ?? chain.addressUtxos(from.address),
    outputs,
    feeRateSatVb: opts.feeRateSatVb ?? 1,
    changeAddress: from.address,
    privateKeyHex: from.privHex,
    inputAddress: from.address,
    inputType: from.type,
  });
  const accepted = chain.acceptTx(res.hex);
  chain.mineTo(null, 1); // confirme la tx (empaquetage réel du mempool)
  return { res, accepted };
}

/* ───────────────────────── Validation des adresses bcrt ───────────────────────── */

describe('adresses regtest bcrt1… (régression du refus « sortie valide »)', () => {
  it('accepte les adresses bcrt1q (P2WPKH), bcrt1p (P2TR) et m/n (P2PKH) dans RX.btcAddress', () => {
    for (const type of ['segwit', 'taproot', 'legacy'] as AddrType[]) {
      const w = makeWallet(0xa1, type);
      expect(w.address.startsWith('bcrt1') || /^[mn2]/.test(w.address)).toBe(true);
      // LE bug corrigé : la regex du labo rejetait tout préfixe bcrt1…
      // → « Renseignez au moins une sortie valide à l'étape Construire. »
      expect(RX.btcAddress.test(w.address)).toBe(true);
    }
  });

  it('rejette toujours les chaînes non-adresses (injections, saisies partielles)', () => {
    expect(RX.btcAddress.test('')).toBe(false);
    expect(RX.btcAddress.test('bcrt1')).toBe(false);
    expect(RX.btcAddress.test('bcrt1q< script >')).toBe(false);
    expect(RX.btcAddress.test('2Mzpp亚马逊')).toBe(false);
    expect(RX.btcAddress.test('TB1QXYKL5TVTWLPUNSTVHHH2FDNQD9SDYVNSNY33GB')).toBe(true); // majuscules bech32 tolérées
  });
});

/* ───────────────── Envois entre portefeuilles de même type ───────────────── */

describe('envois entre portefeuilles de même type', () => {
  it('segwit → segwit : P2WPKH → P2WPKH avec change au portefeuille source', () => {
    const alice = makeWallet(0x01, 'segwit');
    const bob = makeWallet(0x02, 'segwit');
    fund(alice.address);
    expect(balanceOf(alice.address)).toBe(FUNDING);
    expect(balanceOf(bob.address)).toBe(0);

    const { res, accepted } = spend(alice, [{ address: bob.address, amountSats: SEND }]);

    expect(accepted.txid).toBe(res.txid);
    expect(res.feeSats).toBeGreaterThan(0);
    // Estimation conservatrice : les frais réels ≥ vsize × 1 sat/vB demandé.
    expect(res.feeSats).toBeGreaterThanOrEqual(res.vsize);
    expect(res.feeSats).toBeLessThanOrEqual(res.vsize + 4);
    expect(balanceOf(bob.address)).toBe(SEND);
    expect(balanceOf(alice.address)).toBe(FUNDING - SEND - res.feeSats); // change réel
  });

  it('taproot → taproot : P2TR key-path (Schnorr) → P2TR avec change', () => {
    const alice = makeWallet(0x03, 'taproot');
    const bob = makeWallet(0x04, 'taproot');
    fund(alice.address);
    expect(balanceOf(bob.address)).toBe(0);

    const { res } = spend(alice, [{ address: bob.address, amountSats: SEND }]);

    expect(balanceOf(bob.address)).toBe(SEND);
    expect(balanceOf(alice.address)).toBe(FUNDING - SEND - res.feeSats);
  });

  it('legacy → legacy : P2PKH → P2PKH (scriptSig complet, entrées plus lourdes)', () => {
    const alice = makeWallet(0x05, 'legacy');
    const bob = makeWallet(0x06, 'legacy');
    fund(alice.address);

    const { res } = spend(alice, [{ address: bob.address, amountSats: SEND }]);

    expect(balanceOf(bob.address)).toBe(SEND);
    expect(balanceOf(alice.address)).toBe(FUNDING - SEND - res.feeSats);
    // Une entrée P2PKH pèse ~148 vB : vsize total > 200 vB contre ~140 en segwit.
    expect(res.vsize).toBeGreaterThan(200);
  });
});

/* ─────────────── Envois entre portefeuilles de types différents ─────────────── */

describe('envois entre portefeuilles de types différents', () => {
  it('segwit → taproot : sortie P2TR (bech32m) dépensable par le portefeuille taproot', () => {
    const sender = makeWallet(0x07, 'segwit');
    const dest = makeWallet(0x08, 'taproot');
    fund(sender.address);

    const { res } = spend(sender, [{ address: dest.address, amountSats: SEND }]);

    expect(balanceOf(dest.address)).toBe(SEND);
    expect(balanceOf(sender.address)).toBe(FUNDING - SEND - res.feeSats);
  });

  it('taproot → segwit : dépense Schnorr vers P2WPKH classique', () => {
    const sender = makeWallet(0x09, 'taproot');
    const dest = makeWallet(0x0a, 'segwit');
    fund(sender.address);

    const { res } = spend(sender, [{ address: dest.address, amountSats: SEND }]);

    expect(balanceOf(dest.address)).toBe(SEND);
    expect(balanceOf(sender.address)).toBe(FUNDING - SEND - res.feeSats);
  });

  it('taproot → legacy : sortie P2PKH base58 (m/n…) depuis une entrée P2TR', () => {
    const sender = makeWallet(0x0b, 'taproot');
    const dest = makeWallet(0x0c, 'legacy');
    fund(sender.address);
    expect(dest.address).toMatch(/^[mn]/);

    const { res } = spend(sender, [{ address: dest.address, amountSats: SEND }]);

    expect(balanceOf(dest.address)).toBe(SEND);
    expect(balanceOf(sender.address)).toBe(FUNDING - SEND - res.feeSats);
  });

  it('legacy → taproot : sortie P2TR (bcrt1p…) depuis une entrée P2PKH', () => {
    const sender = makeWallet(0x0d, 'legacy');
    const dest = makeWallet(0x0e, 'taproot');
    fund(sender.address);
    expect(dest.address.startsWith('bcrt1p')).toBe(true);

    const { res } = spend(sender, [{ address: dest.address, amountSats: SEND }]);

    expect(balanceOf(dest.address)).toBe(SEND);
    expect(balanceOf(sender.address)).toBe(FUNDING - SEND - res.feeSats);
  });

  it('chaîne croisée segwit → taproot → legacy → segwit : les fonds circulent entre types', () => {
    const a = makeWallet(0x11, 'segwit');
    const b = makeWallet(0x12, 'taproot');
    const c = makeWallet(0x13, 'legacy');
    const d = makeWallet(0x14, 'segwit');
    fund(a.address);

    // Chaque saut laisse la marge de frais : 2 → 1,5 → 1 tBTC.
    const hop1 = spend(a, [{ address: b.address, amountSats: 200_000_000 }]);
    const hop2 = spend(b, [{ address: c.address, amountSats: 150_000_000 }]);
    const hop3 = spend(c, [{ address: d.address, amountSats: 100_000_000 }]);

    expect(balanceOf(d.address)).toBe(100_000_000);
    expect(balanceOf(b.address)).toBe(200_000_000 - 150_000_000 - hop2.res.feeSats);
    expect(balanceOf(c.address)).toBe(150_000_000 - 100_000_000 - hop3.res.feeSats);
    // Chaque saut garde la conservation : entrée = sorties + frais.
    for (const h of [hop1, hop2, hop3]) {
      expect(h.res.feeSats).toBeGreaterThan(0);
    }
  });
});

/* ───────────────────────────── Cas limites réels ───────────────────────────── */

describe('sélection multi-UTXO, drain sans change et garde-fous', () => {
  it('multi-entrées : deux UTXO segwit consommés dans une seule transaction', () => {
    const sender = makeWallet(0x15, 'segwit');
    const dest = makeWallet(0x16, 'taproot');
    fund(sender.address);
    fund(sender.address); // deuxième UTXO

    const utxos = chain.addressUtxos(sender.address);
    expect(utxos.length).toBe(2);

    const { res } = spend(sender, [{ address: dest.address, amountSats: 2 * SEND }], { utxos });

    expect(balanceOf(dest.address)).toBe(2 * SEND);
    expect(balanceOf(sender.address)).toBe(2 * FUNDING - 2 * SEND - res.feeSats);
  });

  it('drain exact : change sous la limite de poussière ajouté aux frais (pas de sortie de change)', () => {
    const sender = makeWallet(0x17, 'segwit');
    const dest = makeWallet(0x18, 'segwit');
    fund(sender.address);
    const utxos = chain.addressUtxos(sender.address);
    const totalIn = utxos.reduce((s, u) => s + u.value, 0);

    // Montant = total − 300 sats : le change (300 − frais réels) tombe sous 546.
    const est = estimateVsize('segwit', utxos.length, [{ address: dest.address, amountSats: totalIn }], true);
    const feeEst = Math.ceil(est * 1);
    const amount = totalIn - 300;
    expect(300 - feeEst).toBeLessThan(546);

    const { res } = spend(sender, [{ address: dest.address, amountSats: amount }], { utxos });

    expect(res.changeSats).toBe(0); // aucune sortie de change
    expect(res.feeSats).toBe(300); // tout le reste part en frais
    expect(balanceOf(dest.address)).toBe(amount);
    expect(balanceOf(sender.address)).toBe(0);
  });

  it('refuse de dépenser une coinbase immature (fonds issus du minage direct)', () => {
    const miner = makeWallet(0x19, 'taproot');
    // Le minage paie la coinbase directement au portefeuille (generatetoaddress).
    chain.mineTo(addressToScriptBcrt(miner.address), 1);

    const utxos = chain.addressUtxos(miner.address);
    expect(utxos.length).toBe(1);
    expect(utxos[0].isCoinbase).toBe(true); // champ exposé à l'UI

    // La signature locale réussit (côté navigateur)…
    const signed = buildSignedTx({
      utxos: utxos,
      outputs: [{ address: makeWallet(0x1a, 'segwit').address, amountSats: SEND }],
      feeRateSatVb: 1,
      changeAddress: miner.address,
      privateKeyHex: miner.privHex,
      inputAddress: miner.address,
      inputType: 'taproot',
    });
    // …mais le moteur applique la règle de consensus : maturité 100 blocs.
    expect(() => chain.acceptTx(signed.hex)).toThrow(/coinbase immature/);

    // 99 blocs de plus → hauteur de dépense 100 → la coinbase devient mûre.
    chain.mineTo(null, 99);
    const accepted = chain.acceptTx(signed.hex);
    expect(accepted.txid).toBe(signed.txid);
  });

  it('rejette une adresse d’un autre réseau avec un message pédagogique (pas « wrong bech32 prefix »)', () => {
    const sender = makeWallet(0x1b, 'segwit');
    fund(sender.address);
    // Adresse testnet4 valide (tb1q…) — le HRP ne correspond pas au bcrt regtest.
    const foreign = deriveForType(hex.decode('aa'.repeat(32)), 'segwit', 'testnet4').address;
    expect(foreign.startsWith('tb1q')).toBe(true);

    let message = '';
    try {
      buildSignedTx({
        utxos: chain.addressUtxos(sender.address),
        outputs: [{ address: foreign, amountSats: SEND }],
        feeRateSatVb: 1,
        changeAddress: sender.address,
        privateKeyHex: sender.privHex,
        inputAddress: sender.address,
        inputType: 'segwit',
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('format attendu');
    expect(message).toContain(foreign);
    expect(message).not.toContain('wrong bech32');
  });

  it('refuse la sur-dépense et les montants sous la limite de poussière', () => {
    const sender = makeWallet(0x1c, 'segwit');
    fund(sender.address);
    const dest = makeWallet(0x1d, 'legacy').address;

    expect(() =>
      spend(sender, [{ address: dest, amountSats: FUNDING + 1 }]),
    ).toThrow(/dépasse/);

    expect(() =>
      spend(sender, [{ address: dest, amountSats: 100 }]), // < 546 sats
    ).toThrow(/poussière/);
  });

  it('anti double-dépense : deux transactions concurrentes sur le même UTXO', () => {
    const sender = makeWallet(0x1e, 'segwit');
    const r1 = makeWallet(0x1f, 'taproot').address;
    const r2 = makeWallet(0x20, 'legacy').address;
    fund(sender.address);
    const utxos = chain.addressUtxos(sender.address);

    const txA = buildSignedTx({
      utxos,
      outputs: [{ address: r1, amountSats: SEND }],
      feeRateSatVb: 1,
      changeAddress: sender.address,
      privateKeyHex: sender.privHex,
      inputAddress: sender.address,
      inputType: 'segwit',
    });
    const txB = buildSignedTx({
      utxos,
      outputs: [{ address: r2, amountSats: SEND }],
      feeRateSatVb: 2, // mêmes entrées, destinataire différent
      changeAddress: sender.address,
      privateKeyHex: sender.privHex,
      inputAddress: sender.address,
      inputType: 'segwit',
    });

    chain.acceptTx(txA.hex); // première entrée dans le mempool
    expect(() => chain.acceptTx(txB.hex)).toThrow(/double-dépense mempool/);
    chain.mineTo(null, 1); // confirme A — B est rejetée, le fond est protégé
    expect(balanceOf(r1)).toBe(SEND);
    expect(balanceOf(r2)).toBe(0);
  });
});
