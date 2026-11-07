import { sha256 } from '@noble/hashes/sha2.js';
import { hex } from '@scure/base';

export const MIN_DIFF_BITS = 0x1d00ffff;
export const REGTEST_MIN_BITS = 0x207fffff;
export const BLOCK_SUBSIDY_SATS = 5_000_000_000;
export const TESTNET4_HALVING_INTERVAL = 210_000;
export const REGTEST_HALVING_INTERVAL = 150;
export const WINDOW_SECS = 1200;
export const COINBASE_MATURITY = 100;
export const DIFF_INTERVAL = 2016;

export function blockSubsidy(height: number, net: string): number {
  if (height <= 0) return 0;
  const interval = net === 'regtest' ? REGTEST_HALVING_INTERVAL : TESTNET4_HALVING_INTERVAL;
  const halvings = Math.floor(height / interval);
  if (halvings >= 64) return 0;
  return Math.floor(BLOCK_SUBSIDY_SATS / 2 ** halvings);
}

export function compactBitsToTarget(bits: number): Uint8Array {
  const exponent = bits >>> 24;
  const mantissa = bits & 0x007f_ffff;
  if (exponent < 3 || exponent > 35)
    throw new Error(`exposant nBits hors bornes : 0x${bits.toString(16)}`);
  const target = new Uint8Array(32);
  const bytePos = exponent - 3;
  for (let k = 0; k < 3; k++) {
    const byte = (mantissa >> (8 * (2 - k))) & 0xff;
    const pos = bytePos + (2 - k);
    if (pos >= 0 && pos < 32) target[31 - pos] = byte;
  }
  return target;
}

export function headerMeetsTarget(headerHex80: string, target: Uint8Array): boolean {
  const digest = sha256(sha256(hex.decode(headerHex80)));
  for (let i = 0; i < 32; i++) {
    const h = digest[31 - i];
    if (h < target[i]) return true;
    if (h > target[i]) return false;
  }
  return true;
}

export function blockHash(headerHex80: string): string {
  return hex.encode(sha256(sha256(hex.decode(headerHex80))).reverse());
}

export function bip34Script(height: number): Uint8Array {
  if (!Number.isInteger(height) || height < 1 || height > 0xffff_ffff) {
    throw new Error(`hauteur coinbase invalide : ${height}`);
  }
  const bytes: number[] = [];
  let h = height;
  while (h > 0) {
    bytes.push(h & 0xff);
    h >>>= 8;
  }
  if (bytes.length > 75) {
    return new Uint8Array([76, bytes.length, ...bytes]);
  }
  return new Uint8Array([bytes.length, ...bytes]);
}

export interface CoinbaseParts {
  height: number;
  scriptPubKey: Uint8Array;
  valueSats: number;
  tag: Uint8Array;
}

<<<<<<< HEAD
export function buildCoinbase({ height, scriptPubKey, valueSats, tag }: CoinbaseParts): { txHex: string; txid: string } {
=======
/**
 * Construit la transaction coinbase d'un bloc (sérialisation legacy : la
 * coinbase ne porte pas de témoin). txid = double-SHA256, affiché big-endian.
 */
export function buildCoinbase({ height, scriptPubKey, valueSats, tag }: CoinbaseParts): {
  txHex: string;
  txid: string;
} {
>>>>>>> 92c54ba (style: prettier-format repo)
  const scriptSig = new Uint8Array([...bip34Script(height), ...tag]);
  const parts: number[][] = [];
  const push = (bytes: number[] | Uint8Array) => parts.push(Array.from(bytes));

  push([0x02, 0x00, 0x00, 0x00]);
  push([0x01]);
  push(new Uint8Array(32));
  push([0xff, 0xff, 0xff, 0xff]);
  push([scriptSig.length]);
  push(scriptSig);
  push([0xff, 0xff, 0xff, 0xff]);
  push([0x01]);
  const value = BigInt(valueSats);
  if (value <= 0n || value > 0xffff_ffff_ffffn)
    throw new Error(`valeur coinbase invalide : ${valueSats}`);
  for (let i = 0; i < 8; i++) push([Number((value >> BigInt(8 * i)) & 0xffn)]);
  push([scriptPubKey.length]);
  push(scriptPubKey);
  push([0x00, 0x00, 0x00, 0x00]);

  const tx = new Uint8Array(parts.flat());
  const txid = hex.encode(sha256(sha256(tx)).reverse());
  return { txHex: hex.encode(tx), txid };
}

export interface TemplateParams {
  tipHashHex: string;
  txidHex: string;
  tipTimeSec: number;
  nowMs: number;
  bits: number;
  timeGapSec?: number;
}

<<<<<<< HEAD
export function assembleHeader76({ tipHashHex, txidHex, tipTimeSec, nowMs, bits, timeGapSec = WINDOW_SECS }: TemplateParams): string {
=======
/**
 * Assemble les 76 premiers octets de l'en-tête (version..nBits) — le nonce
 * est balayé par les workers. Tous les champs sont sérialisés little-endian.
 */
export function assembleHeader76({
  tipHashHex,
  txidHex,
  tipTimeSec,
  nowMs,
  bits,
  timeGapSec = WINDOW_SECS,
}: TemplateParams): string {
>>>>>>> 92c54ba (style: prettier-format repo)
  const time = Math.max(Math.floor(nowMs / 1000), tipTimeSec + timeGapSec + 1);
  if (time > Math.floor(nowMs / 1000) + 7200) {
    throw new Error('horodatage de gabarit trop éloigné (tip du futur ?)');
  }
  const out = new Uint8Array(76);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x2000_0000, true);
  out.set(hex.decode(tipHashHex).slice(0, 32).reverse(), 4);
  out.set(hex.decode(txidHex).slice(0, 32).reverse(), 36);
  view.setUint32(68, time, true);
  view.setUint32(72, bits, true);
  return hex.encode(out);
}

export interface WindowStatus {
  open: boolean;
  reason: 'gap-ok' | 'gap-wait' | 'boundary-block';
  secondsUntilOpen: number;
}

export const FUTURE_SAFETY_SEC = 7100;

export function windowStatus(tipTimeSec: number, nowMs: number, nextHeight: number): WindowStatus {
  if (nextHeight % DIFF_INTERVAL === 0) {
    return { open: false, reason: 'boundary-block', secondsUntilOpen: 0 };
  }
  const nowSec = Math.floor(nowMs / 1000);
  const blockTime = Math.max(nowSec, tipTimeSec + WINDOW_SECS + 1);
  const open = blockTime <= nowSec + FUTURE_SAFETY_SEC;
  if (open) return { open: true, reason: 'gap-ok', secondsUntilOpen: 0 };
  return {
    open: false,
    reason: 'gap-wait',
    secondsUntilOpen: blockTime - nowSec - FUTURE_SAFETY_SEC,
  };
}

export function headerU32(headerHex: string, byteOffset: number): number {
  const bytes = hex.decode(headerHex.slice(byteOffset * 2, byteOffset * 2 + 8));
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

export function assembleBlock(header76Hex: string, nonce: number, txHex: string): string {
  const out = new Uint8Array(80 + txHex.length / 2);
  out.set(hex.decode(header76Hex), 0);
  new DataView(out.buffer).setUint32(76, nonce >>> 0, true);
  out.set(hex.decode(txHex), 80);
  return hex.encode(out);
}
