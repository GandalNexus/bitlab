import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyBroadcast,
  LN_CHAIN_BRIDGE_PATH_RX,
  LN_CHAIN_BRIDGE_TX_RX,
  maxPayableSats,
  readDesiredNets,
  shouldBridgeChain,
  writeDesiredNets,
  type LnChannelView,
  type LnNetId,
} from '../src/lib/lightning';

describe('classifyBroadcast — duplicate funding broadcast', () => {
  it('treats a duplicate (already in chain) as success', () => {
    expect(classifyBroadcast(false, 'transaction déjà connue')).toEqual({ ok: true, detail: '' });
    expect(classifyBroadcast(false, 'txn-already-in-mempool (already known)')).toEqual({
      ok: true,
      detail: '',
    });
  });

  it('keeps real broadcast failures as failures', () => {
    expect(classifyBroadcast(false, 'coinbase immature')).toEqual({
      ok: false,
      detail: 'coinbase immature',
    });
    expect(classifyBroadcast(false, 'bad-txns-inputs-missing')).toEqual({
      ok: false,
      detail: 'bad-txns-inputs-missing',
    });
  });

  it('preserves successes unchanged', () => {
    expect(classifyBroadcast(true, '')).toEqual({ ok: true, detail: '' });
    expect(classifyBroadcast(true, 'txid')).toEqual({ ok: true, detail: 'txid' });
  });
});

describe('pont chaîne du laboratoire Lightning (regtest embarqué)', () => {
  it('active le pont uniquement en regtest embarqué', () => {
    expect(shouldBridgeChain('regtest', 'embedded')).toBe(true);
    expect(shouldBridgeChain('regtest', 'external')).toBe(false);
    expect(shouldBridgeChain('testnet4', 'embedded')).toBe(false);
    expect(shouldBridgeChain('signet', 'external')).toBe(false);
  });

  it('n’autorise que les chemins Esplora requis par le worker Lightning', () => {
    const allowed = [
      'blocks/tip/height',
      'blocks/tip/hash',
      'block-height/102',
      `block/${'a'.repeat(64)}/raw`,
      'v1/fees/recommended',
    ];
    for (const path of allowed) {
      expect(LN_CHAIN_BRIDGE_PATH_RX.test(path)).toBe(true);
    }
    const rejected = [
      'address/bcrt1qabc/utxo',
      'tx/a'.padEnd(66, '0'),
      `block/${'a'.repeat(64)}`,
      'v1/lightning/statistics/latest',
      'mempool',
      'blocks/tip/height/extra',
      'block-height/abc',
      `tx/${'a'.repeat(64)}`,
      '',
      '../admin',
    ];
    for (const path of rejected) {
      expect(LN_CHAIN_BRIDGE_PATH_RX.test(path)).toBe(false);
    }
  });

  it('accepte uniquement les transactions brutes hexadécimales complètes', () => {
    const fundingTxHex = 'ab'.repeat(110);
    expect(LN_CHAIN_BRIDGE_TX_RX.test(fundingTxHex)).toBe(true);
    expect(LN_CHAIN_BRIDGE_TX_RX.test('ab'.repeat(59))).toBe(false);
    expect(LN_CHAIN_BRIDGE_TX_RX.test('')).toBe(false);
    expect(LN_CHAIN_BRIDGE_TX_RX.test(`${'ab'.repeat(60)}zz`)).toBe(false);
    expect(LN_CHAIN_BRIDGE_TX_RX.test('0x' + 'ab'.repeat(110))).toBe(false);
  });

  it('le worker Lightning et le pont hôte partagent le même champ de transaction', () => {
    const worker = readFileSync(new URL('../public/lnlab/worker.js', import.meta.url), 'utf8');
    expect(worker).toContain("askBridge({ path: 'tx', tx: txHex })");
    expect(worker).not.toContain("path: 'tx', txHex");
    const host = readFileSync(new URL('../src/lib/lightning.ts', import.meta.url), 'utf8');
    expect(host).toContain("String(req.tx ?? '')");
  });
});

describe('désir d’activation persistant du laboratoire Lightning', () => {
  const fakeStore = (initial: Record<string, string> = {}) => {
    const backing = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => backing.set(key, value),
      removeItem: (key: string) => backing.delete(key),
    };
  };

  it('retourne une liste vide sans stockage ou sans valeur enregistrée', () => {
    expect(readDesiredNets(null)).toEqual([]);
    expect(readDesiredNets(fakeStore())).toEqual([]);
  });

  it('filtre les réseaux inconnus et les charges corrompues', () => {
    expect(readDesiredNets(fakeStore({ 'lnlab-desired-nets': 'not json' }))).toEqual([]);
    expect(
      readDesiredNets(fakeStore({ 'lnlab-desired-nets': '["regtest","mainnet",42]' })),
    ).toEqual<LnNetId[]>(['regtest']);
  });

  it('écrit puis relit le désir d’activation, et efface la clé au dernier retrait', () => {
    const store = fakeStore();
    writeDesiredNets(store, ['regtest']);
    expect(readDesiredNets(store)).toEqual<LnNetId[]>(['regtest']);
    writeDesiredNets(store, ['regtest', 'testnet4']);
    expect(readDesiredNets(store)).toEqual<LnNetId[]>(['regtest', 'testnet4']);
    writeDesiredNets(store, []);
    expect(store.getItem('lnlab-desired-nets')).toBeNull();
  });

  it('tolère un stockage qui lève sur écriture', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    expect(() => writeDesiredNets(hostile, ['regtest'])).not.toThrow();
  });
});

describe('maxPayableSats — limite HTLC par canal (10 % LDK)', () => {
  const channel = (over: Partial<LnChannelView>): LnChannelView => ({
    channelId: 'c',
    userChannelId: 'u',
    counterparty: '02ff',
    valueSats: '100000',
    outboundMsat: '50000000',
    inboundMsat: '49000000',
    isOutbound: true,
    isReady: true,
    isUsable: true,
    isAnnounced: false,
    ...over,
  });

  it('limite un paiement unique à 10 % de la capacité du meilleur canal utilisable', () => {
    expect(maxPayableSats([channel({ valueSats: '100000' })])).toBe(10000);
    expect(maxPayableSats([channel({ valueSats: '250000' })])).toBe(25000);
    expect(maxPayableSats([channel({ valueSats: '50000' }), channel({ valueSats: '300000' })])).toBe(
      30000,
    );
  });

  it('ignore les canaux non prêts et répond zéro sans canal', () => {
    expect(maxPayableSats([channel({ isReady: false, isUsable: false })])).toBe(0);
    expect(maxPayableSats([])).toBe(0);
  });
});
