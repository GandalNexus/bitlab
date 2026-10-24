/**
 * BitLab — Moteur de chaîne regtest embarqué : paramètres de consensus.
 *
 * Ce moteur remplace toute dépendance externe pour le réseau regtest : pas
 * de Bitcoin Core à installer, pas de Docker, pas d'hyperviseur — la chaîne
 * privée vit dans le processus serveur de BitLab (JSON persisté sur disque,
 * UTXO set en mémoire). Les règles implémentées sont celles de Bitcoin Core
 * en regtest : difficulté fixe (nBits 0x207fffff), subvention 50 BTC avec
 * halving tous les 150 blocs, maturité coinbase de 100 blocs, BIP 34.
 *
 * Périmètre assumé et documenté (labo pédagogique) : validation des scripts
 * standards (P2WPKH BIP 143, P2TR key-path BIP 341, P2PKH legacy) ; les
 * dépenses vers des scripts non standards (transactions internes de LDK :
 * engagements, HTLC, pénalités) sont acceptées après vérification
 * structurelle — les signatures correspondantes sont produites et vérifiées
 * par LDK lui-même.
 */
import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';

/** nBits regtest : difficulté 1 (powLimit regtest, cf. chainparams.cpp). */
export const REGTEST_BITS = 0x207fffff;

/** En-tête du bloc de genèse regtest (80 octets) — identique à Bitcoin Core.
 * version=1, prev=0, merkle=3ba3edfd… (ordre interne), time=1296688602,
 * nBits=0x207fffff, nonce=2 → hash 0f9188f1…2206 (vérifié par test unitaire). */
export const REGTEST_GENESIS_HEADER_HEX =
  '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4adae5494dffff7f2002000000';

/** Hash du bloc de genèse regtest (affichage big-endian). */
export const REGTEST_GENESIS_HASH = '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206';

/** Transaction coinbase du genèse (« Chancellor on brink… ») — partagée mainnet/regtest. */
export const REGTEST_GENESIS_TX_HEX =
  '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

/** Subvention initiale : 50 BTC (regtest, première ère). */
export const BASE_SUBSIDY_SATS = 5_000_000_000;
/** Intervalle de halving regtest : 150 blocs (chainparams.cpp). */
export const HALVING_INTERVAL = 150;
/** Maturité coinbase : 100 confirmations avant dépense (consensus). */
export const COINBASE_MATURITY = 100;
/** Limite de poids d'un bloc (consensus). */
export const MAX_BLOCK_WEIGHT = 4_000_000;
/** Limite de poids standard d'une transaction (policy). */
export const MAX_STD_TX_WEIGHT = 400_000;
/** Frais de relayage minimaux : 1 000 sat/kvB = 1 sat/vB = weight/4 sats. */
export const MIN_RELAY_FEE_PER_WEIGHT_NUM = 1;
export const MIN_RELAY_FEE_PER_WEIGHT_DEN = 4;
/** Tolérance « dans le futur » appliquée par les pairs (2 h). */
export const MAX_FUTURE_TIME_SEC = 7_200;

/** Rétention mémoire : blocs conservés intégralement (headers au-delà). */
export const MAX_RETAINED_BLOCKS = 2048;
/** Transactions mempool maximales (borne mémoire du labo). */
export const MAX_MEMPOOL_TXS = 1_000;
/** Adresses indexées maximales (historique). */
export const MAX_INDEXED_ADDRESSES = 2_000;
/** Borne de préminage faucet (blocs minés à la création de la chaîne). */
export const FAUCET_PREMINE_BLOCKS = 101;
/** Plafond d'une distribution faucet (par requête) — l'UI propose jusqu'à 50 BTC. */
export const FAUCET_MAX_SATS = 5_000_000_000; // 50 tBTC
/** Distribution par défaut. */
export const FAUCET_DEFAULT_SATS = 100_000_000; // 1 tBTC

/** Subvention du bloc `height` (0 pour le genèse). */
export function blockSubsidy(height: number): number {
  if (height <= 0) return 0;
  const halvings = Math.floor(height / HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  return Math.floor(BASE_SUBSIDY_SATS / 2 ** halvings);
}

/** Frais minimaux pour une transaction de `weight` unités de poids (sats). */
export function minRelayFee(weight: number): number {
  return Math.ceil((weight * MIN_RELAY_FEE_PER_WEIGHT_NUM) / MIN_RELAY_FEE_PER_WEIGHT_DEN);
}

/** Hash160 (RIPEMD160(SHA-256)) — implémenté ici pour rester isomorphe. */
export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

/** Hex inversé (ordre d'affichage ⇄ ordre interne little-endian). */
export function reverseHex(h: string): string {
  const b = hex.decode(h);
  return hex.encode(b.reverse());
}
