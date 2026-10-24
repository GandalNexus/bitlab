/**
 * BitLab — Moteur regtest embarqué : routeur Esplora (fonctions pures).
 *
 * Traduit un chemin Esplora vers les projections de `RegtestChain`, sous la
 * forme exacte attendue par le client (mempool.ts) et le worker Lightning.
 * Aucun effet de bord : testable hors-ligne (cf. tests/regtest-engine.test.ts).
 *
 * Formes renvoyées : { status, type: 'json' | 'text' | 'bin', body } —
 * le proxy (/api/bitcoin) les convertit en NextResponse.
 */
import { hex } from '@scure/base';
import type { RegtestChain } from './chain';

export interface EsploraResult {
  status: number;
  type: 'json' | 'text' | 'bin';
  body: unknown;
}

const TXID_RX = /^[0-9a-f]{64}$/i;
const HASH_RX = /^[0-9a-f]{64}$/i;
const ADDR_RX = /^[a-zA-Z0-9]{6,90}$/; // bech32 max 90 — bcrt P2TR fait 64

/** Frais regtest : pas de marché de frais sur une chaîne privée (1 sat/vB). */
const REGTEST_FEES = { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 };

export function handleEsploraPath(chain: RegtestChain, path: string): EsploraResult {
  // 1) Frais (statique).
  if (path === 'v1/fees/recommended') return json(200, REGTEST_FEES);

  // 2) Tip.
  if (path === 'blocks/tip/height') return text(200, String(chain.tipHeight()));
  if (path === 'blocks/tip/hash') return text(200, chain.tipHash());

  // 3) Adresses : solde, UTXO, historique — tous réels (index du moteur).
  const utxoMatch = path.match(/^address\/([a-zA-Z0-9]{6,90})\/utxo$/i);
  if (utxoMatch) {
    try {
      return json(200, chain.addressUtxos(utxoMatch[1]));
    } catch (err) {
      return badAddress(err);
    }
  }
  const txsMatch = path.match(/^address\/([a-zA-Z0-9]{6,90})\/txs$/i);
  if (txsMatch) {
    try {
      return json(200, chain.addressTxs(txsMatch[1]));
    } catch (err) {
      return badAddress(err);
    }
  }
  const addrMatch = path.match(/^address\/([a-zA-Z0-9]{6,90})$/i);
  if (addrMatch) {
    try {
      return json(200, chain.addressInfo(addrMatch[1]));
    } catch (err) {
      return badAddress(err);
    }
  }

  // 4) Transactions.
  const txHexMatch = path.match(/^tx\/([0-9a-f]{64})\/hex$/i);
  if (txHexMatch) {
    const h = chain.txHex(txHexMatch[1]);
    return h ? text(200, h) : notFound('transaction indisponible (hors rétention ou inconnue)');
  }
  const txMatch = path.match(/^tx\/([0-9a-f]{64})$/i);
  if (txMatch) {
    const info = chain.txInfo(txMatch[1]);
    return info ? json(200, info) : notFound('transaction inconnue');
  }

  // 5) Blocs.
  const rawMatch = path.match(/^block\/([0-9a-f]{64})\/raw$/i);
  if (rawMatch) {
    const raw = chain.rawBlockByHash(rawMatch[1]);
    return raw ? { status: 200, type: 'bin', body: hex.decode(raw) } : notFound('bloc hors rétention');
  }
  const headerMatch = path.match(/^block\/([0-9a-f]{64})\/header$/i);
  if (headerMatch) {
    const header = chain.headerHexByHash(headerMatch[1]);
    return header ? text(200, header) : notFound('bloc inconnu');
  }
  const blockMatch = path.match(/^block\/([0-9a-f]{64})$/i);
  if (blockMatch) {
    const rec = chain.blockByHash(blockMatch[1]);
    if (!rec) return notFound('bloc inconnu');
    return json(200, blockDetail(chain, rec.hash));
  }
  const heightMatch = path.match(/^block-height\/(\d{1,7})$/);
  if (heightMatch) {
    const hash = chain.blockHashAtHeight(Number(heightMatch[1]));
    return hash ? text(200, hash) : notFound('aucun bloc à cette hauteur');
  }

  // 6) Listes de blocs (résumés des n derniers).
  if (path === 'v1/blocks' || /^v1\/blocks\/\d{1,2}$/.test(path)) {
    const wanted = Number(path.split('/')[2] ?? 10) || 10;
    return json(200, chain.recentBlocks(Math.min(10, wanted)));
  }

  // 7) Mempool.
  if (path === 'mempool') {
    const s = chain.mempoolStats();
    return json(200, { ...s, fee_histogram: [] });
  }
  if (path === 'mempool/recent') return json(200, chain.mempoolRecent());

  return json(400, { erreur: 'Chemin API non autorisé.' });
}

/** Détail d'un bloc (forme Esplora /block/{hash}, sous-ensemble utile). */
function blockDetail(chain: RegtestChain, hash: string): Record<string, unknown> {
  const rec = chain.blockByHash(hash);
  const header = chain.headerHexByHash(hash);
  if (!rec || !header) return { id: hash, erreur: 'bloc inconnu' };
  const prev = chain.blockAt(rec.height - 1);
  const bytes = new Uint8Array(80);
  for (let i = 0; i < 80; i++) bytes[i] = parseInt(header.slice(i * 2, i * 2 + 2), 16);
  return {
    id: rec.hash,
    height: rec.height,
    version: bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24),
    timestamp: rec.time,
    tx_count: rec.txids.length,
    size: (rec.raw?.length ?? 160) / 2,
    weight: Math.ceil(((rec.raw?.length ?? 160) / 2) * 4),
    merkle_root: Array.from(hex.decode(header.slice(36, 68)))
      .reverse()
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    previousblockhash: prev?.hash ?? null,
    txids: rec.txids,
  };
}

function json(status: number, body: unknown): EsploraResult {
  return { status, type: 'json', body };
}

function text(status: number, body: string): EsploraResult {
  return { status, type: 'text', body };
}

function notFound(detail: string): EsploraResult {
  return json(404, { erreur: detail });
}

function badAddress(err: unknown): EsploraResult {
  return json(400, { erreur: `adresse regtest invalide : ${(err as Error).message}` });
}

/** Garde réutilisée par les routes POST (txid/hex stricts). */
export function isValidTxid(v: string): boolean {
  return TXID_RX.test(v);
}

export function isValidBlockHash(v: string): boolean {
  return HASH_RX.test(v);
}

export function isValidAddress(v: string): boolean {
  return ADDR_RX.test(v);
}
