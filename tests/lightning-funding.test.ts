import { describe, expect, it } from 'vitest';
import {
  classifyBroadcast,
  LN_CHAIN_BRIDGE_PATH_RX,
  shouldBridgeChain,
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
});
