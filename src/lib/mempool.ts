import { useLabStore } from './store';
import { currentNet, NETWORKS } from './networks';
import { regtestHeaders, regtestMode } from './regtest';
import { regtestChain } from './regtest-chain';
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

export function explorerBase(): string {
  return NETWORKS[currentNet()].explorer;
}

function log(kind: 'http' | 'error', label: string, detail: Record<string, unknown>) {
  useLabStore.getState().addLog({
    kind,
    module: 'réseau',
    label,
    detail,
  });
}

export async function mpGet<T>(path: string): Promise<T> {
  const net = currentNet();
  // On regtest-embedded, route directly to the browser chain worker.
  if (net === 'regtest' && regtestMode() === 'embedded') {
    const t0 = performance.now();
    try {
      const data = await regtestChain.query<T>(path);
      log('http', `GET [regtest/worker] /${path}`, {
        duration: Math.round(performance.now() - t0),
        type: Array.isArray(data) ? `tableau[${(data as unknown[]).length}]` : typeof data,
      });
      return data;
    } catch (e) {
      log('error', `GET [regtest/worker] /${path}`, { erreur: String(e) });
      throw e;
    }
  }
  const t0 = performance.now();
  try {
    const headers = net === 'regtest' ? regtestHeaders() : {};
    const res = await fetch(`/api/bitcoin?path=${encodeURIComponent(path)}&network=${net}`, {
      cache: 'no-store',
      headers,
    });
    const duration = Math.round(performance.now() - t0);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log('error', `GET [${net}] /${path}`, {
        status: res.status,
        duration,
        erreur: text.slice(0, 200),
      });
      throw new Error(
        `API ${NETWORKS[net].label} ${res.status} : ${text.slice(0, 140) || res.statusText}`,
      );
    }
    const data = (await res.json()) as T;
    log('http', `GET [${net}] /${path}`, {
      status: res.status,
      duration,
      type: Array.isArray(data) ? `tableau[${(data as unknown[]).length}]` : typeof data,
    });
    return data;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    log('error', `GET [${net}] /${path}`, { erreur: 'réseau indisponible' });
    throw new Error(
      tSync('Nœud {net} indisponible. Vérifiez la connexion puis réessayez.', {
        net: NETWORKS[net].label,
      }),
    );
  }
}

export async function mpGetText(path: string): Promise<string> {
  const net = currentNet();
  // On regtest-embedded, the worker query returns plain text already.
  if (net === 'regtest' && regtestMode() === 'embedded') {
    const data = await regtestChain.query<unknown>(path);
    return String(data);
  }
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
      log('error', `GET [${net}] /${path}`, {
        status: res.status,
        duration,
        erreur: errText.slice(0, 200),
      });
      throw new Error(
        `API ${NETWORKS[net].label} ${res.status} : ${errText.slice(0, 140) || res.statusText}`,
      );
    }
    const data = (await res.text()).trim();
    log('http', `GET [${net}] /${path}`, { status: res.status, duration, taille: data.length });
    return data;
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    log('error', `GET [${net}] /${path}`, { erreur: 'réseau indisponible' });
    throw new Error(
      tSync('Nœud {net} indisponible. Vérifiez la connexion puis réessayez.', {
        net: NETWORKS[net].label,
      }),
    );
  }
}

export async function mpGetOn<T>(net: string, path: string): Promise<T> {
  const res = await fetch(`/api/bitcoin?path=${encodeURIComponent(path)}&network=${net}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${net} ${res.status} : ${text.slice(0, 140) || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function mpBroadcast(rawHex: string): Promise<string> {
  const net = currentNet();
  // On regtest-embedded, broadcast directly through the browser chain worker.
  if (net === 'regtest' && regtestMode() === 'embedded') {
    const t0 = performance.now();
    log('http', `POST [regtest/worker] /tx (diffusion)`, { tailleOctets: rawHex.length / 2 });
    try {
      const result = await regtestChain.broadcast(rawHex.trim());
      log('http', `POST [regtest/worker] /tx (diffusion)`, {
        duration: Math.round(performance.now() - t0),
        txid: result.txid,
      });
      return result.txid;
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      log('error', `POST [regtest/worker] /tx (diffusion)`, { erreur: msg.slice(0, 300) });
      throw new Error(
        tSync('Diffusion refusée par le nœud {net} : {err}', {
          net: NETWORKS[net].label,
          err: msg.slice(0, 200),
        }),
      );
    }
  }
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
    log('error', `POST [${net}] /tx (diffusion)`, {
      status: res.status,
      duration,
      erreur: text.slice(0, 300),
    });
    throw new Error(
      tSync('Diffusion refusée par le nœud {net} : {err}', {
        net: NETWORKS[net].label,
        err: text.slice(0, 200),
      }),
    );
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

export const api = {
  fees: () => mpGet<RecommendedFees>('v1/fees/recommended'),
  tipHeight: () => mpGet<number>('blocks/tip/height'),
  recentBlocks: () => mpGet<BlockSummary[]>('v1/blocks'),
  mempool: () => mpGet<MempoolStats>('mempool'),
  mempoolRecent: () => mpGet<RecentTx[]>('mempool/recent'),
  address: (address: string) => mpGet<AddressInfo>(`address/${address}`),
  utxos: (address: string) => mpGet<AddressUtxo[]>(`address/${address}/utxo`),
  tx: (txid: string) => mpGet<TxInfo>(`tx/${txid}`),
  txHex: (txid: string) => mpGetText(`tx/${txid}/hex`),
  block: (hash: string) => mpGet<BlockDetail>(`block/${hash}`),
  lightningStats: () => mpGetOn<LightningStats>('mainnet', 'v1/lightning/statistics/latest'),
};
