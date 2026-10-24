/**
 * BitLab — Utilitaires Bitcoin bas niveau
 * Encodage d'adresses base58check / bech32 / bech32m + helpers de formatage.
 * Tout s'exécute côté navigateur (client-side sandbox), aucune clé ne quitte l'instance locale.
 */
import { base58, bech32, bech32m, hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { tLocale } from '../i18n';

export { hex };

/** Double SHA-256 (checksum Bitcoin). */
export function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/** Encodage Base58Check manuel (payload + 4 octets de checksum sha256d). */
export function b58checkEncode(payload: Uint8Array): string {
  const checksum = sha256d(payload).slice(0, 4);
  return base58.encode(concatBytes(payload, checksum));
}

/** Adresse P2PKH Testnet (préfixe 0x6f → commence par m ou n). */
export function addressP2PKH(hash20: Uint8Array): string {
  return b58checkEncode(concatBytes(new Uint8Array([0x6f]), hash20));
}

/** Adresse P2SH Testnet (préfixe 0xc4 → commence par 2). */
export function addressP2SH(hash20: Uint8Array): string {
  return b58checkEncode(concatBytes(new Uint8Array([0xc4]), hash20));
}

/** Adresse SegWit v0 (P2WPKH/P2WSH) Testnet → tb1q... */
export function addressSegWitV0(program: Uint8Array): string {
  const words = bech32.toWords(program);
  return bech32.encode('tb', [0, ...words]);
}

/** Adresse Taproot (SegWit v1, bech32m) Testnet → tb1p... */
export function addressTaproot(xOnlyKey32: Uint8Array): string {
  const words = bech32m.toWords(xOnlyKey32);
  return bech32m.encode('tb', [1, ...words]);
}

/** Formatage sats → BTC lisible. */
export function satsToBtc(sats: number | bigint): string {
  return (Number(sats) / 1e8).toFixed(8);
}

/** Formatage compact des grands nombres — séparateurs selon la langue active (fr-FR / en-US). */
export function fmtInt(n: number | bigint): string {
  const locale = typeof window === 'undefined' ? 'fr-FR' : tLocale();
  return Number(n).toLocaleString(locale);
}

/** Troncature hex lisible : 8 premiers + 8 derniers caractères. */
export function shortHex(h: string, head = 10, tail = 8): string {
  if (!h) return '';
  return h.length <= head + tail + 3 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** Génère un id court unique côté client. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Regex strictes de sanitisation (cf. protocole de sécurité du cahier des charges). */
export const RX = {
  hex: /^[0-9a-fA-F]+$/,
  txid: /^[0-9a-fA-F]{64}$/,
  // Adresses bech32/bech32m (bc1/tb1/bcrt1) + base58 mainnet (1…, 3…) et
  // testnet/regtest (m…, n…, 2…). Le HRP « bcrt » du regtest embarqué est
  // accepté partout, insensible à la casse (bech32 majuscules valides) —
  // la validation définitive (checksum, hrp, réseau) reste l'apanage de
  // Address().decode() au moment de la construction (tx.ts).
  btcAddress: /^((bcrt|bc|tb)[13][a-z0-9]{20,60}|[13mn2][a-km-zA-HJ-NP-Z1-9]{25,50})$/i,
  wif: /^[cKLT95][a-km-zA-HJ-NP-Z1-9]{50,52}$/,
  bolt11: /^lntb[a-z0-9]+$/i,
};
