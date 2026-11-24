import { describe, expect, it } from 'vitest';
import {
  decodeShortChannelId,
  encodeShortChannelId,
  formatShortChannelId,
  parseFundingOutpoint,
  scidFromConfirmedStatus,
} from '../src/lib/bitcoin/scid';

const TXID = 'e0471f102f5eec0622693726beff4b264ddc411e5191556486cbaf0670797f08';

describe('encodeShortChannelId', () => {
  it('encodes the BOLT-03 layout height << 40 | txIndex << 16 | vout', () => {
    expect(encodeShortChannelId(102, 1, 0)).toBe((BigInt(102) << 40n) | (1n << 16n));
    expect(encodeShortChannelId(830603, 231, 0)).toBe(
      (BigInt(830603) << 40n) | (BigInt(231) << 16n),
    );
    expect(encodeShortChannelId(0, 0, 0)).toBe(0n);
  });

  it('rejects out-of-range components', () => {
    expect(encodeShortChannelId(-1, 0, 0)).toBeNull();
    expect(encodeShortChannelId(1 << 24, 0, 0)).toBeNull();
    expect(encodeShortChannelId(0, -1, 0)).toBeNull();
    expect(encodeShortChannelId(0, 1 << 24, 0)).toBeNull();
    expect(encodeShortChannelId(0, 0, 1 << 16)).toBeNull();
    expect(encodeShortChannelId(0, 0, -1)).toBeNull();
    expect(encodeShortChannelId(0.5, 0, 0)).toBeNull();
    expect(encodeShortChannelId(Number.NaN, 0, 0)).toBeNull();
  });

  it('accepts every boundary value', () => {
    expect(encodeShortChannelId((1 << 24) - 1, (1 << 24) - 1, (1 << 16) - 1)).not.toBeNull();
  });
});

describe('formatShortChannelId', () => {
  it('formats as height x txIndex x vout', () => {
    expect(formatShortChannelId(102, 1, 0)).toBe('102x1x0');
    expect(formatShortChannelId(830603, 231, 5)).toBe('830603x231x5');
  });

  it('returns null for invalid input', () => {
    expect(formatShortChannelId(-5, 0, 0)).toBeNull();
    expect(formatShortChannelId(0, 0, 70000)).toBeNull();
  });
});

describe('decodeShortChannelId', () => {
  it('round-trips with encode', () => {
    const scid = encodeShortChannelId(101, 2, 3)!;
    expect(decodeShortChannelId(scid)).toEqual({ height: 101, txIndex: 2, vout: 3 });
    const max = encodeShortChannelId((1 << 24) - 1, (1 << 24) - 1, (1 << 16) - 1)!;
    expect(decodeShortChannelId(max)).toEqual({
      height: (1 << 24) - 1,
      txIndex: (1 << 24) - 1,
      vout: (1 << 16) - 1,
    });
  });

  it('rejects negative and oversized values', () => {
    expect(decodeShortChannelId(-1n)).toBeNull();
    expect(decodeShortChannelId(1n << 64n)).toBeNull();
  });
});

describe('parseFundingOutpoint', () => {
  it('parses a txid:vout outpoint', () => {
    expect(parseFundingOutpoint(`${TXID}:0`)).toEqual({ txid: TXID, vout: 0 });
    expect(parseFundingOutpoint(` ${TXID.toUpperCase()}:42 `)).toEqual({
      txid: TXID,
      vout: 42,
    });
  });

  it('rejects malformed outpoints', () => {
    expect(parseFundingOutpoint('')).toBeNull();
    expect(parseFundingOutpoint('deadbeef:0')).toBeNull();
    expect(parseFundingOutpoint(`${TXID}zz:0`)).toBeNull();
    expect(parseFundingOutpoint(`${TXID}:`)).toBeNull();
    expect(parseFundingOutpoint(`${TXID}:-1`)).toBeNull();
    expect(parseFundingOutpoint(`${TXID}:65536`)).toBeNull();
    expect(parseFundingOutpoint(`${TXID}:3.5`)).toBeNull();
  });
});

describe('scidFromConfirmedStatus', () => {
  it('derives the canonical scid from a confirmed Esplora status', () => {
    expect(scidFromConfirmedStatus({ confirmed: true, block_height: 102, block_index: 1 }, 0)).toBe(
      '102x1x0',
    );
  });

  it('returns null while the funding tx is unconfirmed or placement is unknown', () => {
    expect(scidFromConfirmedStatus({ confirmed: false }, 0)).toBeNull();
    expect(scidFromConfirmedStatus({ confirmed: true }, 0)).toBeNull();
    expect(scidFromConfirmedStatus({ confirmed: true, block_height: 102 }, 0)).toBeNull();
    expect(
      scidFromConfirmedStatus({ confirmed: true, block_height: 102, block_index: 0 }, 65536),
    ).toBeNull();
  });
});
