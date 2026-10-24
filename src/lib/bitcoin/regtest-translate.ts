/**
 * BitLab — Traduction Core ⇄ Esplora pour le réseau regtest (fonctions pures).
 *
 * Le regtest n'a pas d'API Esplora publique : le proxy /api/bitcoin dialogue
 * avec le Bitcoin Core local de l'utilisateur (interface REST activée par
 * `-rest=1`, port partagé avec le RPC). Ce module traduit les réponses Core
 * vers les formes Esplora attendues par le client (mempool.ts) — sans effet
 * de bord, donc testable hors-ligne (cf. tests/regtest.test.ts).
 *
 * Limite documentée : sans `-txindex`, l'historique d'adresse n'est pas
 * reconstruisible ; `address/{a}/txs` répond une liste vide et `tx` est
 * déclaré confirmé (les blocs regtest sont quasi instantanés).
 */
import type { AddressInfo, AddressUtxo, BlockSummary, MempoolStats, RecentTx, TxInfo } from '../mempool';

/** Satoshi = 10^8 BTC ; Core renvoie des montants décimaux flottants. */
export function btcToSats(amount: number | string | undefined | null): number {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1e8);
}

/** Adresse lisible d'un scriptPubKey Core (v22+ : `address`, plus ancien : `addresses[]`). */
function coreAddress(spk: { address?: unknown; addresses?: unknown } | undefined): string | undefined {
  if (!spk) return undefined;
  if (typeof spk.address === 'string') return spk.address;
  if (Array.isArray(spk.addresses) && typeof spk.addresses[0] === 'string') return spk.addresses[0];
  return undefined;
}

/** Frais recommandés regtest : pas de marché de frais sur une chaîne privée. */
export function regtestFees(): { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number } {
  return { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 };
}

/** /rest/chaininfo.json → hauteur du tip. */
export function chainInfoToTipHeight(info: { blocks?: unknown }): number | null {
  const n = Number(info?.blocks);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** /rest/chaininfo.json → hash du tip. */
export function chainInfoToTipHash(info: { bestblockhash?: unknown }): string | null {
  const h = info?.bestblockhash;
  return typeof h === 'string' && /^[0-9a-f]{64}$/i.test(h) ? h : null;
}

/** /rest/blockhashbyheight/{h}.json → hash (forme objet ou chaîne brute selon version). */
export function blockHashByHeight(payload: unknown): string | null {
  const fromObject = (payload as { blockhash?: unknown })?.blockhash;
  const candidate = typeof fromObject === 'string' ? fromObject : typeof payload === 'string' ? payload : '';
  const cleaned = candidate.replace(/"/g, '').trim();
  return /^[0-9a-f]{64}$/i.test(cleaned) ? cleaned : null;
}

/** /rest/headers/{n}/{hash}.json → tableau d'hex ; on retourne le premier (160 caractères). */
export function headersToFirstHeader(payload: unknown): string | null {
  if (!Array.isArray(payload)) return null;
  const first = payload[0];
  if (typeof first !== 'string') return null;
  const cleaned = first.trim().toLowerCase();
  return cleaned.length === 160 && /^[0-9a-f]+$/.test(cleaned) ? cleaned : null;
}

/** /rest/tx/{txid}.json (format Core) → TxInfo (forme Esplora). */
export function coreTxToEsplora(core: unknown, txid: string): TxInfo {
  const c = (core ?? {}) as {
    version?: unknown;
    locktime?: unknown;
    size?: unknown;
    weight?: unknown;
    vin?: unknown[];
    vout?: unknown[];
  };
  const vin = Array.isArray(c.vin) ? c.vin : [];
  const vout = Array.isArray(c.vout) ? c.vout : [];
  return {
    txid,
    version: Number(c.version ?? 2),
    locktime: Number(c.locktime ?? 0),
    vin: vin.map((raw) => {
      const v = (raw ?? {}) as {
        txid?: unknown;
        vout?: unknown;
        sequence?: unknown;
        coinbase?: unknown;
        prevout?: { value?: unknown; scriptPubKey?: { hex?: unknown; address?: unknown; addresses?: unknown } };
      };
      const isCoinbase = typeof v.coinbase === 'string';
      return {
        txid: typeof v.txid === 'string' ? v.txid : isCoinbase ? undefined : '',
        vout: Number(v.vout ?? 0),
        is_coinbase: isCoinbase,
        sequence: Number(v.sequence ?? 0xffffffff),
        ...(v.prevout
          ? {
              prevout: {
                scriptpubkey: String(v.prevout.scriptPubKey?.hex ?? ''),
                scriptpubkey_address: coreAddress(v.prevout.scriptPubKey),
                value: btcToSats(v.prevout.value as number),
              },
            }
          : {}),
      };
    }),
    vout: vout.map((raw) => {
      const v = (raw ?? {}) as { value?: unknown; scriptPubKey?: { address?: unknown; addresses?: unknown } };
      return {
        scriptpubkey_address: coreAddress(v.scriptPubKey),
        value: btcToSats(v.value as number),
      };
    }),
    size: Number(c.size ?? 0),
    weight: Number(c.weight ?? 0),
    status: { confirmed: true },
  };
}

/** RPC scantxoutset → UTXOs Esplora d'une adresse. */
export function scantxoutsetToUtxos(res: unknown): AddressUtxo[] {
  const unspents = (res as { unspents?: unknown[] })?.unspents;
  if (!Array.isArray(unspents)) return [];
  return unspents
    .map((raw): AddressUtxo | null => {
      const u = (raw ?? {}) as { txid?: unknown; vout?: unknown; amount?: unknown; height?: unknown };
      const txid = typeof u.txid === 'string' && /^[0-9a-f]{64}$/i.test(u.txid) ? u.txid : null;
      if (!txid) return null;
      const height = Number(u.height);
      return {
        txid,
        vout: Number(u.vout ?? 0),
        value: btcToSats(u.amount as number),
        status: { confirmed: true, ...(Number.isFinite(height) && height > 0 ? { block_height: height } : {}) },
      };
    })
    .filter((u): u is AddressUtxo => u !== null);
}

/** RPC scantxoutset → synthèse d'adresse (solde = total non dépensé). */
export function scantxoutsetToAddressInfo(res: unknown, address: string): AddressInfo {
  const unspents = scantxoutsetToUtxos(res);
  const funded = unspents.reduce((sum, u) => sum + u.value, 0);
  return {
    address,
    chain_stats: { funded_txo_sum: funded, spent_txo_sum: 0, tx_count: unspents.length },
    mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
  };
}

/** /rest/mempool/info.json → statistiques mempool. */
export function mempoolInfoToStats(info: unknown): MempoolStats {
  const m = (info ?? {}) as { size?: unknown; bytes?: unknown; total_fee?: unknown };
  return {
    count: Number(m.size ?? 0),
    vsize: Number(m.bytes ?? 0),
    total_fee: btcToSats(m.total_fee as number),
    fee_histogram: [],
  };
}

/** /rest/mempool/contents.json → transactions récentes (sans valeur totale — non fournie par Core). */
export function mempoolContentsToRecent(contents: unknown): RecentTx[] {
  if (!contents || typeof contents !== 'object' || Array.isArray(contents)) return [];
  return Object.entries(contents as Record<string, unknown>)
    .map(([txid, raw]) => {
      const e = (raw ?? {}) as { fee?: unknown; fees?: { base?: unknown }; vsize?: unknown; size?: unknown };
      const feeBtc = e.fees?.base ?? e.fee;
      return {
        txid,
        fee: btcToSats(feeBtc as number),
        vsize: Number(e.vsize ?? e.size ?? 0),
        value: 0,
      };
    })
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 50);
}

/** /rest/block/{hash}.json (Core) → résumé Esplora pour les listes de blocs. */
export function coreBlockToSummary(core: unknown): BlockSummary | null {
  const b = (core ?? {}) as { hash?: unknown; height?: unknown; time?: unknown; tx?: unknown[]; size?: unknown };
  const hash = typeof b.hash === 'string' && /^[0-9a-f]{64}$/i.test(b.hash) ? b.hash : null;
  const height = Number(b.height);
  if (!hash || !Number.isFinite(height)) return null;
  return {
    id: hash,
    height,
    timestamp: Number(b.time ?? 0),
    tx_count: Array.isArray(b.tx) ? b.tx.length : 0,
    size: Number(b.size ?? 0),
  };
}

/** Plan d'exécution d'un chemin Esplora sur le nœud regtest. */
export type RegtestPlan =
  | { kind: 'rest'; upstream: string; accept: 'json' | 'bin' | 'hex' }
  | { kind: 'rpc'; method: 'scantxoutset'; address: string }
  | { kind: 'static'; body: unknown; type: 'json' }
  | { kind: 'empty'; type: 'json' }
  | { kind: 'unsupported' };

const TXID_RX = /^[0-9a-f]{64}$/i;
/** Caractères valides d'une adresse regtest (base58 testnet ou bech32 bcrt). */
const ADDR_RX = /^[a-zA-Z0-9]{6,62}$/;

/**
 * Décide comment satisfaire un chemin Esplora sur un nœud Core regtest.
 * Les URLs REST sont construites ici — seuls des identifiants validés
 * (hash/hauteur/adresse déjà filtrés par la liste blanche du proxy) y entrent.
 */
export function planRegtestRequest(path: string): RegtestPlan {
  // 1) Frais : statique (pas de marché de frais sur une chaîne privée).
  if (path === 'v1/fees/recommended') return { kind: 'static', body: regtestFees(), type: 'json' };
  // 2) Historique d'adresse : indisponible sans -txindex → liste vide.
  if (/^address\/[a-zA-Z0-9]{6,62}\/txs$/i.test(path)) return { kind: 'empty', type: 'json' };

  // 3) Solde / UTXOs : scantxoutset (scan ponctuel du set — sans wallet, sans txindex).
  const utxoMatch = path.match(/^address\/([a-zA-Z0-9]{6,62})\/utxo$/i);
  if (utxoMatch && ADDR_RX.test(utxoMatch[1])) return { kind: 'rpc', method: 'scantxoutset', address: utxoMatch[1] };
  const addrMatch = path.match(/^address\/([a-zA-Z0-9]{6,62})$/i);
  if (addrMatch && ADDR_RX.test(addrMatch[1])) return { kind: 'rpc', method: 'scantxoutset', address: addrMatch[1] };

  // 4) Tip : chaininfo.
  if (path === 'blocks/tip/height') return { kind: 'rest', upstream: 'chaininfo.json', accept: 'json' };
  if (path === 'blocks/tip/hash') return { kind: 'rest', upstream: 'chaininfo.json', accept: 'json' };

  // 5) Transactions.
  const txHexMatch = path.match(/^tx\/([0-9a-f]{64})\/hex$/i);
  if (txHexMatch) return { kind: 'rest', upstream: `tx/${txHexMatch[1].toLowerCase()}.hex`, accept: 'hex' };
  const txMatch = path.match(/^tx\/([0-9a-f]{64})$/i);
  if (txMatch) return { kind: 'rest', upstream: `tx/${txMatch[1].toLowerCase()}.json`, accept: 'json' };

  // 6) Blocs.
  const rawMatch = path.match(/^block\/([0-9a-f]{64})\/raw$/i);
  if (rawMatch) return { kind: 'rest', upstream: `block/${rawMatch[1].toLowerCase()}.bin`, accept: 'bin' };
  const headerMatch = path.match(/^block\/([0-9a-f]{64})\/header$/i);
  if (headerMatch) return { kind: 'rest', upstream: `headers/1/${headerMatch[1].toLowerCase()}.json`, accept: 'json' };
  const blockMatch = path.match(/^block\/([0-9a-f]{64})$/i);
  if (blockMatch && TXID_RX.test(blockMatch[1])) return { kind: 'rest', upstream: `block/${blockMatch[1].toLowerCase()}.json`, accept: 'json' };
  const heightMatch = path.match(/^block-height\/(\d{1,7})$/);
  if (heightMatch) return { kind: 'rest', upstream: `blockhashbyheight/${heightMatch[1]}.json`, accept: 'json' };

  // 7) Mempool.
  if (path === 'mempool') return { kind: 'rest', upstream: 'mempool/info.json', accept: 'json' };
  if (path === 'mempool/recent') return { kind: 'rest', upstream: 'mempool/contents.json', accept: 'json' };

  // 8) v1/blocks (résumés des derniers blocs) — traité par le proxy (parcours des prev).
  if (path === 'v1/blocks' || /^v1\/blocks\/\d{1,2}$/.test(path)) return { kind: 'rest', upstream: 'chaininfo.json', accept: 'json' };

  return { kind: 'unsupported' };
}
