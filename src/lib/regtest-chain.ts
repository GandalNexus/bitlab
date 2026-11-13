'use client';

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { SerializedChain } from './regtest-engine/chain';

const IDB_KEY = 'bitlab-regtest-chain-v1';
const WORKER_TIMEOUT_MS = 30_000;

type WorkerMsg =
  | { type: 'ready' }
  | { type: 'reply'; id: string; ok: boolean; body: unknown }
  | { type: 'error'; id: string; message: string }
  | { type: 'persist'; data: SerializedChain };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

class RegtestChainController {
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private readyPromise: Promise<void> | null = null;

  private async ensureWorker(): Promise<void> {
    if (this.worker && this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>(async (resolve, reject) => {
      const w = new Worker('/regtest/worker.js', { type: 'module' });
      this.worker = w;

      w.onmessage = (ev: MessageEvent<WorkerMsg>) => {
        const msg = ev.data;
        if (msg.type === 'ready') {
          resolve();
          return;
        }
        if (msg.type === 'persist') {
          void idbSet(IDB_KEY, msg.data);
          return;
        }
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.type === 'error') p.reject(new Error(msg.message));
        else if (msg.ok) p.resolve(msg.body);
        else
          p.reject(
            new Error(
              typeof msg.body === 'object' && msg.body && 'erreur' in msg.body
                ? String((msg.body as { erreur: unknown }).erreur)
                : JSON.stringify(msg.body),
            ),
          );
      };

      w.onerror = (e) => {
        reject(new Error(`regtest worker failed: ${e.message}`));
        this.worker = null;
        this.readyPromise = null;
      };

      // Load persisted chain state.
      let saved: SerializedChain | null = null;
      try {
        saved = (await idbGet<SerializedChain>(IDB_KEY)) ?? null;
      } catch {
        saved = null;
      }
      w.postMessage({ type: 'load', kv: saved });
    });

    return this.readyPromise;
  }

  private send<T>(msg: Record<string, unknown>): Promise<T> {
    const id = `r${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      this.ensureWorker()
        .then(() => {
          const worker = this.worker;
          if (!worker) {
            reject(new Error('regtest worker unavailable'));
            return;
          }
          const timer = setTimeout(() => {
            this.pending.delete(id);
            reject(new Error('regtest worker timeout'));
          }, WORKER_TIMEOUT_MS);
          this.pending.set(id, {
            resolve: (v: unknown) => {
              clearTimeout(timer);
              resolve(v as T);
            },
            reject: (e: Error) => {
              clearTimeout(timer);
              reject(e);
            },
          });
          worker.postMessage({ ...msg, id });
        })
        .catch(reject);
    });
  }

  query<T>(path: string): Promise<T> {
    return this.send<T>({ type: 'query', path });
  }

  broadcast(hex: string): Promise<{ txid: string; feeSats: number; vsize: number }> {
    return this.send({ type: 'tx', hex });
  }

  faucet(
    address: string,
    sats: number,
  ): Promise<{
    txid: string;
    feeSats: number;
    blockHash: string;
    blockHeight: number;
    poolSats: number;
  }> {
    return this.send({ type: 'faucet', address, sats });
  }

  mine(
    blocks: number,
    address?: string,
  ): Promise<{
    mined: { hash: string; height: number; txCount: number }[];
    tip: { height: number; hash: string };
    poolSats: number;
  }> {
    return this.send({ type: 'mine', blocks, address });
  }

  submit(blockHex: string): Promise<{ height: number; hash: string }> {
    return this.send({ type: 'submit', blockHex });
  }

  info(): Promise<{
    engine: string;
    height: number;
    tipHash: string;
    tipTime: number;
    subsidyNextSats: number;
    halvingInBlocks: number;
    mempoolCount: number;
    faucet: { address: string; matureSats: number; immatureSats: number };
    genesisHash: string;
  }> {
    return this.send({ type: 'info' });
  }

  async reset(): Promise<unknown> {
    try {
      await idbDel(IDB_KEY);
    } catch {
      /* ignore */
    }
    return this.send({ type: 'reset' });
  }
}

export const regtestChain = new RegtestChainController();
