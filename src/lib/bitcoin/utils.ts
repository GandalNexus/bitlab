import { base58, bech32, bech32m, hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { tLocale } from '../i18n';

export { hex };

export function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

export function b58checkEncode(payload: Uint8Array): string {
  const checksum = sha256d(payload).slice(0, 4);
  return base58.encode(concatBytes(payload, checksum));
}

export function addressP2PKH(hash20: Uint8Array): string {
  return b58checkEncode(concatBytes(new Uint8Array([0x6f]), hash20));
}

export function addressP2SH(hash20: Uint8Array): string {
  return b58checkEncode(concatBytes(new Uint8Array([0xc4]), hash20));
}

export function addressSegWitV0(program: Uint8Array): string {
  const words = bech32.toWords(program);
  return bech32.encode('tb', [0, ...words]);
}

export function addressTaproot(xOnlyKey32: Uint8Array): string {
  const words = bech32m.toWords(xOnlyKey32);
  return bech32m.encode('tb', [1, ...words]);
}

export function satsToBtc(sats: number | bigint): string {
  return (Number(sats) / 1e8).toFixed(8);
}

export function fmtInt(n: number | bigint): string {
  const locale = typeof window === 'undefined' ? 'fr-FR' : tLocale();
  return Number(n).toLocaleString(locale);
}

export function shortHex(h: string, head = 10, tail = 8): string {
  if (!h) return '';
  return h.length <= head + tail + 3 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function uid(prefix = 'id'): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  const rand = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export const RX = {
  hex: /^[0-9a-fA-F]+$/,
  txid: /^[0-9a-fA-F]{64}$/,
  btcAddress: /^((bcrt|bc|tb)[13][a-z0-9]{20,60}|[13mn2][a-km-zA-HJ-NP-Z1-9]{25,50})$/i,
  wif: /^[cKLT95][a-km-zA-HJ-NP-Z1-9]{50,52}$/,
  bolt11: /^lntb[a-z0-9]+$/i,
};
