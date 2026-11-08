import { describe, expect, it } from 'vitest';
import { classifyBroadcast } from '../src/lib/lightning';

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
