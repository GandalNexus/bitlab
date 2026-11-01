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

registerNetGetter(() => 'regtest');

const chain = new RegtestChain();

const FUNDING = 500_000_000;
const SEND = 100_000_000;

interface TestWallet {
  type: AddrType;
  privHex: string;
  address: string;
}

function makeWallet(seed: number, type: AddrType): TestWallet {
  const priv = hex.decode(seed.toString(16).padStart(64, '0'));
  const { address } = deriveForType(priv, type, 'regtest');
  return { type, privHex: hex.encode(priv), address };
}

function balanceOf(address: string): number {
  const info = chain.addressInfo(address);
  return info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
}

function fund(address: string): void {
  chain.faucetSend(address, FUNDING);
}

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
  chain.mineTo(null, 1);
  return { res, accepted };
}

describe('adresses regtest bcrt1… (régression du refus « sortie valide »)', () => {
  it('accepte les adresses bcrt1q (P2WPKH), bcrt1p (P2TR) et m/n (P2PKH) dans RX.btcAddress', () => {
    for (const type of ['segwit', 'taproot', 'legacy'] as AddrType[]) {
      const w = makeWallet(0xa1, type);
      expect(w.address.startsWith('bcrt1') || /^[mn2]/.test(w.address)).toBe(true);
      expect(RX.btcAddress.test(w.address)).toBe(true);
    }
  });

  it('rejette toujours les chaînes non-adresses (injections, saisies partielles)', () => {
    expect(RX.btcAddress.test('')).toBe(false);
    expect(RX.btcAddress.test('bcrt1')).toBe(false);
    expect(RX.btcAddress.test('bcrt1q< script >')).toBe(false);
    expect(RX.btcAddress.test('2Mzpp亚马逊')).toBe(false);
    expect(RX.btcAddress.test('TB1QXYKL5TVTWLPUNSTVHHH2FDNQD9SDYVNSNY33GB')).toBe(true);
  });
});

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
    expect(res.feeSats).toBeGreaterThanOrEqual(res.vsize);
    expect(res.feeSats).toBeLessThanOrEqual(res.vsize + 4);
    expect(balanceOf(bob.address)).toBe(SEND);
    expect(balanceOf(alice.address)).toBe(FUNDING - SEND - res.feeSats);
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
    expect(res.vsize).toBeGreaterThan(200);
  });
});

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

    const hop1 = spend(a, [{ address: b.address, amountSats: 200_000_000 }]);
    const hop2 = spend(b, [{ address: c.address, amountSats: 150_000_000 }]);
    const hop3 = spend(c, [{ address: d.address, amountSats: 100_000_000 }]);

    expect(balanceOf(d.address)).toBe(100_000_000);
    expect(balanceOf(b.address)).toBe(200_000_000 - 150_000_000 - hop2.res.feeSats);
    expect(balanceOf(c.address)).toBe(150_000_000 - 100_000_000 - hop3.res.feeSats);
    for (const h of [hop1, hop2, hop3]) {
      expect(h.res.feeSats).toBeGreaterThan(0);
    }
  });
});

describe('sélection multi-UTXO, drain sans change et garde-fous', () => {
  it('multi-entrées : deux UTXO segwit consommés dans une seule transaction', () => {
    const sender = makeWallet(0x15, 'segwit');
    const dest = makeWallet(0x16, 'taproot');
    fund(sender.address);
    fund(sender.address);

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

    const est = estimateVsize('segwit', utxos.length, [{ address: dest.address, amountSats: totalIn }], true);
    const feeEst = Math.ceil(est * 1);
    const amount = totalIn - 300;
    expect(300 - feeEst).toBeLessThan(546);

    const { res } = spend(sender, [{ address: dest.address, amountSats: amount }], { utxos });

    expect(res.changeSats).toBe(0);
    expect(res.feeSats).toBe(300);
    expect(balanceOf(dest.address)).toBe(amount);
    expect(balanceOf(sender.address)).toBe(0);
  });

  it('refuse de dépenser une coinbase immature (fonds issus du minage direct)', () => {
    const miner = makeWallet(0x19, 'taproot');
    chain.mineTo(addressToScriptBcrt(miner.address), 1);

    const utxos = chain.addressUtxos(miner.address);
    expect(utxos.length).toBe(1);
    expect(utxos[0].isCoinbase).toBe(true);

    const signed = buildSignedTx({
      utxos: utxos,
      outputs: [{ address: makeWallet(0x1a, 'segwit').address, amountSats: SEND }],
      feeRateSatVb: 1,
      changeAddress: miner.address,
      privateKeyHex: miner.privHex,
      inputAddress: miner.address,
      inputType: 'taproot',
    });
    expect(() => chain.acceptTx(signed.hex)).toThrow(/coinbase immature/);

    chain.mineTo(null, 99);
    const accepted = chain.acceptTx(signed.hex);
    expect(accepted.txid).toBe(signed.txid);
  });

  it('rejette une adresse d’un autre réseau avec un message pédagogique (pas « wrong bech32 prefix »)', () => {
    const sender = makeWallet(0x1b, 'segwit');
    fund(sender.address);
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
      spend(sender, [{ address: dest, amountSats: 100 }]),
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
      feeRateSatVb: 2,
      changeAddress: sender.address,
      privateKeyHex: sender.privHex,
      inputAddress: sender.address,
      inputType: 'segwit',
    });

    chain.acceptTx(txA.hex);
    expect(() => chain.acceptTx(txB.hex)).toThrow(/double-dépense mempool/);
    chain.mineTo(null, 1);
    expect(balanceOf(r1)).toBe(SEND);
    expect(balanceOf(r2)).toBe(0);
  });
});
