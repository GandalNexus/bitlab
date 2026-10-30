/**
 * BitLab — Testnet4 mining core (pure functions, offline-tested).
 *
 * Miner exploits BIP 94 exceptional block rule: when a block arrives >20 min
 * after its predecessor, the next block is valid at minimum difficulty
 * (nBits = 0x1d00ffff ≈ 2^32 hashes) — within browser reach. Hash engine
 * lives in workers (public/miner); this module assembles templates and
 * verifies results.
 *
 * All testable without network or DOM: see tests/mining.test.ts.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { hex } from '@scure/base';

/** nBits of minimum difficulty (powLimit Testnet4, see chainparams). */
export const MIN_DIFF_BITS = 0x1d00ffff;
/** Regtest nBits: difficulty 1 (regtest powLimit) — every block found in
 * few hashes; template anyway uses tip nBits. */
export const REGTEST_MIN_BITS = 0x207fffff;
/** Initial block subsidy: 50 BTC (first era, all networks). */
export const BLOCK_SUBSIDY_SATS = 5_000_000_000;
/** Halving interval Testnet4/mainnet: 210,000 blocks (consensus). */
export const TESTNET4_HALVING_INTERVAL = 210_000;
/** Halving interval regtest (chainparams.cpp): 150 blocks. */
export const REGTEST_HALVING_INTERVAL = 150;
/** BIP 94 window: block >1200s after previous is exceptional. */
export const WINDOW_SECS = 1200;
/** Coinbase reward maturity (confirmations before spend). */
export const COINBASE_MATURITY = 100;
/** Revaluation interval — first block of period forbids min-diff. */
export const DIFF_INTERVAL = 2016;

/**
 * Block subsidy at `height` per network (0 for genesis) — same formula as
 * consensus rules (halvings = height / interval, integer division by 2^n).
 * Miner template MUST claim exactly this value (+ optional fees): excessive
 * coinbase is rejected by validation. Regtest shortens interval to 150 blocks;
 * all other networks use 210,000.
 */
export function blockSubsidy(height: number, net: string): number {
  if (height <= 0) return 0;
  const interval = net === 'regtest' ? REGTEST_HALVING_INTERVAL : TESTNET4_HALVING_INTERVAL;
  const halvings = Math.floor(height / interval);
  if (halvings >= 64) return 0;
  return Math.floor(BLOCK_SUBSIDY_SATS / 2 ** halvings);
}

/** Decode compact nBits (logical value, e.g., 0x1d00ffff) to 32-byte big-endian target. */
export function compactBitsToTarget(bits: number): Uint8Array {
  const exponent = bits >>> 24;
  const mantissa = bits & 0x007f_ffff;
  if (exponent < 3 || exponent > 35) throw new Error(`exposant nBits hors bornes : 0x${bits.toString(16)}`);
  const target = new Uint8Array(32);
  const bytePos = exponent - 3; // décalage (0 = poids faible) du LSB de la mantisse
  // Mantisse (3 octets, MSB éventuellement nul — ex. 0x00ffff) × 256^bytePos :
  // l'octet MSB de la mantisse se place à `bytePos + 2`, le LSB à `bytePos`.
  // L'ancienne formule (`bytePos + k`) inversait l'ordre des 3 octets et
  // décalait la cible d'un octet dès que le MSB est nul — les blocs minés
  // contre 0x1d00ffff (BIP 94) auraient été invalides ~1 fois sur 256.
  for (let k = 0; k < 3; k++) {
    const byte = (mantissa >> (8 * (2 - k))) & 0xff;
    const pos = bytePos + (2 - k);
    if (pos >= 0 && pos < 32) target[31 - pos] = byte;
  }
  return target;
}

/** Compare un hash d'en-tête (hex affichage big-endian) à une cible 32 octets. */
export function headerMeetsTarget(headerHex80: string, target: Uint8Array): boolean {
  const digest = sha256(sha256(hex.decode(headerHex80)));
  // Le hash affiché par Bitcoin est le condensat renversé (little-endian) ;
  // la comparaison numérique se fait sur cette représentation big-endian.
  for (let i = 0; i < 32; i++) {
    const h = digest[31 - i];
    if (h < target[i]) return true;
    if (h > target[i]) return false;
  }
  return true;
}

/** Hash d'un en-tête 80 octets, au format d'affichage (big-endian). */
export function blockHash(headerHex80: string): string {
  return hex.encode(sha256(sha256(hex.decode(headerHex80))).reverse());
}

/**
 * Préfixe BIP 34 du scriptSig coinbase : hauteur de bloc encodée CScriptNum
 * minimale, poussée sur la pile (règle de consensus depuis BIP 34).
 */
export function bip34Script(height: number): Uint8Array {
  if (!Number.isInteger(height) || height < 1 || height > 0xffff_ffff) {
    throw new Error(`hauteur coinbase invalide : ${height}`);
  }
  // Encodage little-endian minimal (octets de poids fort nuls supprimés).
  const bytes: number[] = [];
  let h = height;
  while (h > 0) {
    bytes.push(h & 0xff);
    h >>>= 8;
  }
  if (bytes.length > 75) {
    // OP_PUSHDATA1 — n'arrive qu'au-delà de la hauteur 0xffffff.
    return new Uint8Array([76, bytes.length, ...bytes]);
  }
  return new Uint8Array([bytes.length, ...bytes]);
}

export interface CoinbaseParts {
  /** Hauteur du bloc à miner (BIP 34). */
  height: number;
  /** Script de sortie (scriptPubKey dérivé de l'adresse du portefeuille actif). */
  scriptPubKey: Uint8Array;
  /** Valeur de la sortie en sats (subvention + frais, sans frais ici). */
  valueSats: number;
  /** Octets décoratifs ajoutés au scriptSig (tag + aléa — extranonce). */
  tag: Uint8Array;
}

/**
 * Construit la transaction coinbase d'un bloc (sérialisation legacy : la
 * coinbase ne porte pas de témoin). txid = double-SHA256, affiché big-endian.
 */
export function buildCoinbase({ height, scriptPubKey, valueSats, tag }: CoinbaseParts): { txHex: string; txid: string } {
  const scriptSig = new Uint8Array([...bip34Script(height), ...tag]);
  const parts: number[][] = [];
  const push = (bytes: number[] | Uint8Array) => parts.push(Array.from(bytes));

  push([0x02, 0x00, 0x00, 0x00]); // version 2
  push([0x01]); // 1 entrée
  push(new Uint8Array(32)); // prevout nul (tx coinbase)
  push([0xff, 0xff, 0xff, 0xff]); // index 0xffffffff
  push([scriptSig.length]); // scriptSig ≤ 75 octets garanti (hauteur + tag courts)
  push(scriptSig);
  push([0xff, 0xff, 0xff, 0xff]); // séquence finale
  push([0x01]); // 1 sortie
  const value = BigInt(valueSats);
  if (value <= 0n || value > 0xffff_ffff_ffffn) throw new Error(`valeur coinbase invalide : ${valueSats}`);
  for (let i = 0; i < 8; i++) push([Number((value >> BigInt(8 * i)) & 0xffn)]);
  push([scriptPubKey.length]);
  push(scriptPubKey);
  push([0x00, 0x00, 0x00, 0x00]); // locktime

  const tx = new Uint8Array(parts.flat());
  const txid = hex.encode(sha256(sha256(tx)).reverse());
  return { txHex: hex.encode(tx), txid };
}

export interface TemplateParams {
  /** Hash du tip au format d'affichage (big-endian). */
  tipHashHex: string;
  /** txid de la coinbase (big-endian) — merkle à transaction unique. */
  txidHex: string;
  /** Horodatage du bloc précédent (champ nTime). */
  tipTimeSec: number;
  /** Heure courante (ms) — sert de plancher temporel. */
  nowMs: number;
  /** nBits du gabarit (0x1d00ffff pour une fenêtre BIP 94). */
  bits: number;
  /** Écart minimal avec le tip (BIP 94 : 1200 s ; regtest : 0 — le champ
   * nTime reste simplement > MTP grâce au +1 s). */
  timeGapSec?: number;
}

/**
 * Assemble les 76 premiers octets de l'en-tête (version..nBits) — le nonce
 * est balayé par les workers. Tous les champs sont sérialisés little-endian.
 */
export function assembleHeader76({ tipHashHex, txidHex, tipTimeSec, nowMs, bits, timeGapSec = WINDOW_SECS }: TemplateParams): string {
  const time = Math.max(Math.floor(nowMs / 1000), tipTimeSec + timeGapSec + 1);
  // Le champ nTime doit rester plausible pour les pairs (< 2 h dans le futur).
  if (time > Math.floor(nowMs / 1000) + 7200) {
    throw new Error('horodatage de gabarit trop éloigné (tip du futur ?)');
  }
  const out = new Uint8Array(76);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x2000_0000, true); // version (bits d'extension standard)
  out.set(hex.decode(tipHashHex).slice(0, 32).reverse(), 4); // prev
  out.set(hex.decode(txidHex).slice(0, 32).reverse(), 36); // merkle (tx unique)
  view.setUint32(68, time, true);
  view.setUint32(72, bits, true);
  return hex.encode(out);
}

export interface WindowStatus {
  open: boolean;
  /** 'gap-wait' : fenêtre pas encore ouverte ; 'boundary-block' : 1er bloc
   * d'une période (min-diff interdit, BIP 94) ; 'gap-ok' : minable. */
  reason: 'gap-ok' | 'gap-wait' | 'boundary-block';
  /** Secondes restantes avant ouverture probable (gap-wait uniquement). */
  secondsUntilOpen: number;
}

/** Marge sous la limite stricte des pairs (« time-too-new » à +2 h). *
 * Réalité testnet4 : les bots utilisent l'adjusted time P2P et diffusent
 * des blocs horodatés ~+100 min — acceptés par la swarm. On reste 100 s
 * sous la limite dure : le bloc est relayé par les pairs à horloge décalée
 * même si un nœud « honnête » le refuse momentanément. */
export const FUTURE_SAFETY_SEC = 7100;

/**
 * Détermine si une fenêtre min-difficulty est ouverte pour la hauteur suivante.
 *
 * Subtilité testnet4 (cf. worklog) : les bots datent leurs blocs DANS le
 * futur (parfois +100 min). La règle BIP 94 compare les horodatages des
 * en-têtes — pas l'horloge murale. Un tip futur n'empêche donc pas de miner
 * : le gabarit utilise nTime = max(maintenant, tip + 1201) et la fenêtre ne
 * se referme que si cet horodatage sort de la limite « 2 h dans le futur »
 * appliquée par les pairs.
 */
export function windowStatus(tipTimeSec: number, nowMs: number, nextHeight: number): WindowStatus {
  // Règle BIP 94 §1 : le PREMIER bloc d'une période doit rester à la
  // difficulté réelle — inutile de miner du min-diff à cette hauteur.
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

/** Champ u32 little-endian lu dans un en-tête hexadécimal (offset en octets). */
export function headerU32(headerHex: string, byteOffset: number): number {
  const bytes = hex.decode(headerHex.slice(byteOffset * 2, byteOffset * 2 + 8));
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

/** Assemble le bloc complet (en-tête 80 octets + coinbase) en hexadécimal. */
export function assembleBlock(header76Hex: string, nonce: number, txHex: string): string {
  const out = new Uint8Array(80 + txHex.length / 2);
  out.set(hex.decode(header76Hex), 0);
  new DataView(out.buffer).setUint32(76, nonce >>> 0, true);
  out.set(hex.decode(txHex), 80);
  return hex.encode(out);
}
