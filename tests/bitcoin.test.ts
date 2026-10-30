/**
 * BitLab — tests hors-ligne du cœur Bitcoin (Vitest).
 * Suite de validation Bitcoin (ex-tooling hors suite) : génération de clés (3 types),
 * WIF, mnémonique BIP39, construction/signature Legacy/SegWit/Taproot,
 * décodage raw, multisig P2WSH, estimation des frais.
 * Aucune connexion réseau requise.
 */
import { describe, expect, it } from 'vitest';
import {
  TYPE_INFO,
  createWallet,
  walletFromMnemonic,
  walletFromWif,
  deriveForType,
} from '../src/lib/bitcoin/keys';
import {
  buildSignedTx,
  decodeRawTx,
  createMultisig,
  addressToScript,
  detectScriptType,
  scriptToAddress,
  estimateVsize,
} from '../src/lib/bitcoin/tx';
import { hex } from '../src/lib/bitcoin/utils';

type Wallet = ReturnType<typeof createWallet>;
const wallets: Record<'legacy' | 'segwit' | 'taproot', Wallet> = {
  legacy: createWallet('legacy', 24),
  segwit: createWallet('segwit', 24),
  taproot: createWallet('taproot', 24),
};

function fakeUtxo(value: number) {
  return { txid: '1'.repeat(64), vout: 0, value };
}

describe('1. Génération de portefeuilles (3 types)', () => {
  for (const t of ['legacy', 'segwit', 'taproot'] as const) {
    it(`dérive une adresse ${TYPE_INFO[t].label} (${TYPE_INFO[t].tech}) valide`, () => {
      const w = wallets[t];
      const expectedPrefix =
        t === 'legacy' ? /^[mn2]/ : t === 'segwit' ? /^tb1q/ : /^tb1p/;
      expect(w.address).toMatch(expectedPrefix);
      expect(w.mnemonic!.split(' ')).toHaveLength(24);
      expect(w.wif[0]).toMatch(/^[cKLT9]/);
      expect(w.derivationPath).toBe(TYPE_INFO[t].path);
    });
  }
});

describe('2. Import WIF', () => {
  it('retrouve la même clé privée et la même adresse', () => {
    const fromWif = walletFromWif(wallets.segwit.wif, 'segwit');
    expect(fromWif.privateKeyHex).toBe(wallets.segwit.privateKeyHex);
    expect(fromWif.address).toBe(wallets.segwit.address);
  });

  it('la même clé privée donne une adresse legacy différente', () => {
    const fromWif = walletFromWif(wallets.segwit.wif, 'segwit');
    const asLegacy = deriveForType(hex.decode(fromWif.privateKeyHex), 'legacy');
    expect(asLegacy.address).not.toBe(fromWif.address);
  });
});

describe('3. Import mnémonique (déterminisme)', () => {
  it('retrouve la même adresse', () => {
    const again = walletFromMnemonic(wallets.segwit.mnemonic!, 'segwit');
    expect(again.address).toBe(wallets.segwit.address);
  });
});

describe('4. Scripts et adresses (aller-retour)', () => {
  for (const t of ['legacy', 'segwit', 'taproot'] as const) {
    it(`reconstruit l'adresse ${t} depuis son script`, () => {
      const script = addressToScript(wallets[t].address);
      expect(detectScriptType(script)).toBe(t);
      expect(scriptToAddress(script)).toBe(wallets[t].address);
    });
  }
});

describe('5. Construction + signature de transactions', () => {
  for (const t of ['legacy', 'segwit', 'taproot'] as const) {
    it(`produit une transaction ${t} signée et décodable`, () => {
      const res = buildSignedTx({
        utxos: [fakeUtxo(50_000)],
        outputs: [{ address: wallets.segwit.address, amountSats: 20_000 }],
        feeRateSatVb: 5,
        changeAddress: wallets[t].address,
        privateKeyHex: wallets[t].privateKeyHex,
        inputAddress: wallets[t].address,
        inputType: t,
      });
      const dec = decodeRawTx(res.hex);
      expect(dec.isSigned).toBe(true);
      expect(dec.txid).toBe(res.txid);
      expect(res.feeSats).toBeGreaterThan(0);
    });
  }
});

describe('6. Cas limites', () => {
  it('rejette des sorties supérieures aux entrées', () => {
    expect(() =>
      buildSignedTx({
        utxos: [fakeUtxo(1000)],
        outputs: [{ address: wallets.segwit.address, amountSats: 5000 }],
        feeRateSatVb: 2,
        changeAddress: wallets.segwit.address,
        privateKeyHex: wallets.segwit.privateKeyHex,
        inputAddress: wallets.segwit.address,
        inputType: 'segwit',
      }),
    ).toThrow(/dépasse/);
  });

  it('rejette un montant poussière', () => {
    expect(() =>
      buildSignedTx({
        utxos: [fakeUtxo(100_000)],
        outputs: [{ address: wallets.segwit.address, amountSats: 20 }],
        feeRateSatVb: 2,
        changeAddress: wallets.segwit.address,
        privateKeyHex: wallets.segwit.privateKeyHex,
        inputAddress: wallets.segwit.address,
        inputType: 'segwit',
      }),
    ).toThrow(/poussière/);
  });
});

describe('7. Multisig 2-de-3 (P2WSH)', () => {
  it('génère une adresse et un script témoin valides', () => {
    const ms = createMultisig(
      [wallets.legacy.publicKeyHex, wallets.segwit.publicKeyHex, wallets.taproot.publicKeyHex],
      2,
    );
    expect(ms.address).toMatch(/^tb1q/);
    expect(ms.witnessScriptHex.length).toBeGreaterThan(40);
    expect(hex.encode(addressToScript(ms.address))).toMatch(/^0020/);
  });
});

describe('8. Estimation des frais', () => {
  it('estime la vsize segwit 2-in dans une fourchette réaliste', () => {
    const est = estimateVsize(
      'segwit',
      2,
      [{ address: wallets.legacy.address, amountSats: 1000 }],
      true,
    );
    expect(est).toBeGreaterThan(100);
    expect(est).toBeLessThan(300);
  });

  it('estime la vsize taproot 1-in dans une fourchette réaliste', () => {
    const estTr = estimateVsize(
      'taproot',
      1,
      [{ address: wallets.segwit.address, amountSats: 1000 }],
      true,
    );
    expect(estTr).toBeGreaterThan(80);
    expect(estTr).toBeLessThan(200);
  });
});
