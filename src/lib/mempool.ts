/**
 * BitLab — Client API blockchain (Connectivité, cf. 3.2 du cahier des charges)
 * Appels vers les nœuds publics Esplora / mempool.space du réseau actif (mainnet,
 * testnet3, testnet4, signet) via un proxy Edge côté serveur (/api/bitcoin) —
 * agrégation de données publiques uniquement.
 * AUCUNE donnée sensible (clé privée, mnémonique) ne transite par ce client.
 */
import { useLabStore } from './store';
import { currentNet, NETWORKS } from './networks';
import { regtestHeaders } from './regtest';
import { tSync } from './i18n';

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BlockSummary {
  id: string;
  height: number;
  timestamp: number;
  tx_count: number;
  size: number;
  difficulty?: number;
  extras?: { poolName?: string };
}

export interface MempoolStats {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: [number, number][];
}

export interface RecentTx {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface AddressInfo {
  address: string;
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

export interface AddressUtxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
  /** Présent sur le moteur regtest embarqué : sortie de coinbase (maturité 100 blocs). */
  isCoinbase?: boolean;
}

export interface TxInfo {
  txid: string;
  version: number;
  locktime: number;
  vin: unknown[];
  vout: { scriptpubkey_address?: string; value: number }[];
  size: number;
  weight: number;
  fee?: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

/** Détail d'un bloc (forme Esplora /block/{hash}) — inclut la liste des txids
 * (moteur regtest embarqué ; sur les réseaux publics, l'UI renvoie vers
 * mempool.space au lieu de déplier le bloc localement). */
export interface BlockDetail {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root?: string;
  previousblockhash?: string | null;
  txids: string[];
}

/** Base de l'explorateur public du réseau actif (liens sortants de l'UI). */
export function explorerBase(): string {
  return NETWORKS[currentNet()].explorer;
}

/** Journalise chaque appel réseau (module « réseau » du journal d'activité). */
function log(kind: 'http' | 'error', label: string, detail: Record<string, unknown>) {
  useLabStore.getState().addLog({
    kind,
    module: 'réseau',
    label,
    detail,
  });
}

/** GET générique via le proxy Edge Next.js (sanitisation du chemin côté serveur). */
export async function mpGet<T>(path: string): Promise<T> {
  const net = currentNet();
  const t0 = performance.now();
  try {
    // Regtest : la config du nœud local (hôte + identifiants RPC) voyage par
    // en-tête — jamais dans l'URL, elle n'apparaît dans aucun log d'accès.
    const headers = net === 'regtest' ? regtestHeaders() : {};
    const res = await fetch(`/api/bitcoin?path=${encodeURIComponent(path)}&network=${net}`, {
      cache: 'no-store',
      headers,
    });
    const duration = Math.round(performance.now() - t0);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log('error', `GET [${net}] /${path}`, { status: res.status, duration, erreur: text.slice(0, 200) });
      throw new Error(`API ${NETWORKS[net].label} ${res.status} : ${text.slice(0, 140) || res.statusText}`);
    }
    const data = (await res.json()) as T;
    log('http', `GET [${net}] /${path}`, { status: res.status, duration, type: Array.isArray(data) ? `tableau[${data.length}]` : typeof data });
    return data;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    log('error', `GET [${net}] /${path}`, { erreur: 'réseau indisponible' });
    throw new Error(tSync('Nœud {net} indisponible. Vérifiez la connexion puis réessayez.', { net: NETWORKS[net].label }));
  }
}

/** GET texte brut (hex de transaction, hash d'en-tête…) — aucune analyse JSON :
 * les points de terminaison /hex répondent en text/plain, pas en JSON. */
export async function mpGetText(path: string): Promise<string> {
  const net = currentNet();
  const t0 = performance.now();
  try {
    const headers = net === 'regtest' ? regtestHeaders() : {};
    const res = await fetch(`/api/bitcoin?path=${encodeURIComponent(path)}&network=${net}`, {
      cache: 'no-store',
      headers,
    });
    const duration = Math.round(performance.now() - t0);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      log('error', `GET [${net}] /${path}`, { status: res.status, duration, erreur: errText.slice(0, 200) });
      throw new Error(`API ${NETWORKS[net].label} ${res.status} : ${errText.slice(0, 140) || res.statusText}`);
    }
    const data = (await res.text()).trim();
    log('http', `GET [${net}] /${path}`, { status: res.status, duration, taille: data.length });
    return data;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    log('error', `GET [${net}] /${path}`, { erreur: 'réseau indisponible' });
    throw new Error(tSync('Nœud {net} indisponible. Vérifiez la connexion puis réessayez.', { net: NETWORKS[net].label }));
  }
}

/** GET forcé sur un réseau précis (ex. statistiques Lightning mondiales = mainnet). */
export async function mpGetOn<T>(net: string, path: string): Promise<T> {
  const res = await fetch(`/api/bitcoin?path=${encodeURIComponent(path)}&network=${net}`, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${net} ${res.status} : ${text.slice(0, 140) || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Diffusion d'une transaction brute signée (POST hex → txid) sur le réseau actif. */
export async function mpBroadcast(rawHex: string): Promise<string> {
  const net = currentNet();
  const t0 = performance.now();
  log('http', `POST [${net}] /tx (diffusion)`, { tailleOctets: rawHex.length / 2 });
  const res = await fetch(`/api/bitcoin?path=tx&network=${net}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...(net === 'regtest' ? regtestHeaders() : {}) },
    body: rawHex.trim(),
  });
  const duration = Math.round(performance.now() - t0);
  const text = await res.text();
  if (!res.ok) {
    log('error', `POST [${net}] /tx (diffusion)`, { status: res.status, duration, erreur: text.slice(0, 300) });
    throw new Error(tSync('Diffusion refusée par le nœud {net} : {err}', { net: NETWORKS[net].label, err: text.slice(0, 200) }));
  }
  const txid = text.trim();
  log('http', `POST [${net}] /tx (diffusion)`, { status: res.status, duration, txid });
  return txid;
}

export interface LightningStats {
  latest: {
    id: number;
    added: number;
    node_count: number;
    channel_count: number;
    total_capacity: number;
    tor_nodes: number;
    unannounced_nodes: number;
    avg_capacity: number;
    avg_fee_rate: number;
    avg_base_fee_mtokens: number;
    medians?: { [k: string]: number };
  };
}

/** API structurée du laboratoire (réseau actif). */
export const api = {
  fees: () => mpGet<RecommendedFees>('v1/fees/recommended'),
  tipHeight: () => mpGet<number>('blocks/tip/height'),
  // v1/blocks (sans argument) renvoie les 10 derniers blocs, du plus récent au plus ancien.
  recentBlocks: () => mpGet<BlockSummary[]>('v1/blocks'),
  mempool: () => mpGet<MempoolStats>('mempool'),
  mempoolRecent: () => mpGet<RecentTx[]>('mempool/recent'),
  address: (address: string) => mpGet<AddressInfo>(`address/${address}`),
  utxos: (address: string) => mpGet<AddressUtxo[]>(`address/${address}/utxo`),
  tx: (txid: string) => mpGet<TxInfo>(`tx/${txid}`),
  // Hex brut d'une transaction (text/plain) — anatomie locale sur regtest.
  txHex: (txid: string) => mpGetText(`tx/${txid}/hex`),
  // Détail d'un bloc avec sa liste de txids (moteur regtest embarqué).
  block: (hash: string) => mpGet<BlockDetail>(`block/${hash}`),
  // Statistiques Lightning mondiales (mempool.space explore le mainnet).
  lightningStats: () => mpGetOn<LightningStats>('mainnet', 'v1/lightning/statistics/latest'),
};
