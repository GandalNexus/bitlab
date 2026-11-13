export interface FundingOutpoint {
  txid: string;
  vout: number;
}

export interface ConfirmedTxStatus {
  confirmed: boolean;
  block_height?: number;
  block_index?: number;
}

const MAX_HEIGHT = 1 << 24;
const MAX_TX_INDEX = 1 << 24;
const MAX_VOUT = 1 << 16;

export function encodeShortChannelId(height: number, txIndex: number, vout: number): bigint | null {
  if (!Number.isInteger(height) || height < 0 || height >= MAX_HEIGHT) return null;
  if (!Number.isInteger(txIndex) || txIndex < 0 || txIndex >= MAX_TX_INDEX) return null;
  if (!Number.isInteger(vout) || vout < 0 || vout >= MAX_VOUT) return null;
  return (BigInt(height) << 40n) | (BigInt(txIndex) << 16n) | BigInt(vout);
}

export function formatShortChannelId(height: number, txIndex: number, vout: number): string | null {
  const scid = encodeShortChannelId(height, txIndex, vout);
  if (scid === null) return null;
  return `${height}x${txIndex}x${vout}`;
}

export function decodeShortChannelId(scid: bigint): {
  height: number;
  txIndex: number;
  vout: number;
} | null {
  if (scid < 0n || scid >= 1n << 64n) return null;
  return {
    height: Number(scid >> 40n) & (MAX_HEIGHT - 1),
    txIndex: Number((scid >> 16n) & BigInt(MAX_TX_INDEX - 1)),
    vout: Number(scid & BigInt(MAX_VOUT - 1)),
  };
}

export function parseFundingOutpoint(raw: string): FundingOutpoint | null {
  const match = /^([0-9a-f]{64}):(\d{1,10})$/i.exec(raw.trim());
  if (!match) return null;
  const vout = Number(match[2]);
  if (!Number.isInteger(vout) || vout < 0 || vout >= MAX_VOUT) return null;
  return { txid: match[1].toLowerCase(), vout };
}

export function scidFromConfirmedStatus(status: ConfirmedTxStatus, vout: number): string | null {
  if (!status.confirmed) return null;
  if (
    status.block_height === undefined ||
    status.block_index === undefined ||
    !Number.isInteger(status.block_height) ||
    !Number.isInteger(status.block_index)
  ) {
    return null;
  }
  return formatShortChannelId(status.block_height, status.block_index, vout);
}
