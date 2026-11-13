import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { hex } from '@scure/base';
import { scriptToAddressOn } from './bitcoin/tx';
import { parseFundingOutpoint, scidFromConfirmedStatus } from './bitcoin/scid';
import { api } from './mempool';
import { regtestHeaderValue, regtestMode } from './regtest';
import { regtestChain } from './regtest-chain';
import { tSync } from './i18n';

export type LnNetId = 'testnet4' | 'testnet3' | 'signet' | 'regtest';
export type NodeKey = 'A' | 'B';

export const LN_NETWORKS: LnNetId[] = ['testnet4', 'testnet3', 'signet', 'regtest'];

export interface LnChannelView {
  channelId: string;
  userChannelId: string;
  counterparty: string;
  valueSats: string;
  outboundMsat: string;
  inboundMsat: string;
  isOutbound: boolean;
  isReady: boolean;
  isUsable: boolean;
  isAnnounced: boolean;
  fundingTxo?: string;
  confirmations?: string;
  confirmationsRequired?: string;
}

export interface LnEventView {
  node: string;
  type: string;
  [field: string]: string | undefined;
}

export interface LnLogLine {
  node: string;
  line: string;
}

export interface LnPendingFunding {
  userChannelId: string;
  valueSats: string;
  outputScript: string;
  address: string | null;
}

export interface LnOfferView {
  description: string;
  amountMsat: string;
  issuer: string;
  absoluteExpiry?: string;
  signingPubkey: string;
}

export interface LnLabStatus {
  phase: 'off' | 'booting' | 'ready' | 'stopping';
  network: LnNetId | null;
  error: string | null;
  nodeA: string | null;
  nodeB: string | null;
  connected: boolean;
  best: { height: number; hash: string } | null;
  channelsA: LnChannelView[];
  channelsB: LnChannelView[];
  events: LnEventView[];
  logs: LnLogLine[];
  broadcasts: { ok: boolean; detail: string; at: number }[];
  pendingFunding: LnPendingFunding | null;
}

const SEEDS_KEY = (net: LnNetId) => `lnlab-seeds-${net}`;
const KV_KEY = (net: LnNetId, node: NodeKey) => `lnlab-kv-${net}-${node}`;

interface KvMap {
  [compositeKey: string]: Uint8Array;
}

interface Seeds {
  a: number[];
  b: number[];
}

const initialStatus: LnLabStatus = {
  phase: 'off',
  network: null,
  error: null,
  nodeA: null,
  nodeB: null,
  connected: false,
  best: null,
  channelsA: [],
  channelsB: [],
  events: [],
  logs: [],
  broadcasts: [],
  pendingFunding: null,
};

const MAX_EVENTS = 60;
const MAX_LOGS = 200;

export function classifyBroadcast(ok: boolean, detail: string): { ok: boolean; detail: string } {
  if (!ok && /déjà connue|already known/i.test(detail)) return { ok: true, detail: '' };
  return { ok, detail };
}

const LN_CHAIN_BRIDGE_TX_RX = /^[0-9a-fA-F]{120,}$/;

export const LN_CHAIN_BRIDGE_PATH_RX =
  /^(?:blocks\/tip\/(?:height|hash)|block-height\/\d{1,7}|block\/[0-9a-f]{64}\/raw|v1\/fees\/recommended)$/i;

export function shouldBridgeChain(network: LnNetId, mode: string): boolean {
  return network === 'regtest' && mode === 'embedded';
}

class LnLabController {
  private status: LnLabStatus = {
    ...initialStatus,
    channelsA: [],
    channelsB: [],
    events: [],
    logs: [],
    broadcasts: [],
  };
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private network: LnNetId | null = null;
  private kvQueue: Promise<void> = Promise.resolve();
  private kvEpoch = 0;

  getStatus = (): LnLabStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(part: Partial<LnLabStatus>) {
    this.status = { ...this.status, ...part };
    this.listeners.forEach((l) => l());
  }

  private pushLog(node: string, line: string) {
    const logs = [{ node, line }, ...this.status.logs].slice(0, MAX_LOGS);
    this.patch({ logs });
  }

  private pushEvents(events: LnEventView[]) {
    if (events.length === 0) return;
    const merged = [...events, ...this.status.events].slice(0, MAX_EVENTS);
    const pending = events.find((e) => e.type === 'funding_generation_ready');
    let pendingFunding = this.status.pendingFunding;
    if (pending) {
      const scriptBytes = hex.decode(pending.outputScript ?? '');
      const net = this.network;
      pendingFunding = {
        userChannelId: pending.userChannelId ?? '',
        valueSats: pending.valueSats ?? '0',
        outputScript: pending.outputScript ?? '',
        address: net ? (scriptToAddressOn(scriptBytes, net) ?? null) : null,
      };
    }
    if (events.some((e) => e.type === 'channel_ready' || e.type === 'channel_closed')) {
      pendingFunding = null;
    }
    this.patch({ events: merged, pendingFunding });
  }

  async activate(network: LnNetId): Promise<void> {
    if (this.status.phase === 'booting' || this.status.phase === 'ready') return;
    this.network = network;
    this.patch({
      phase: 'booting',
      network,
      error: null,
      logs: [],
      events: [],
      broadcasts: [],
      pendingFunding: null,
    });
    try {
      const seeds = await this.loadOrCreateSeeds(network);
      const kvA = await this.loadKvMap(network, 'A');
      const kvB = await this.loadKvMap(network, 'B');
      const restore = Object.keys(kvA).length > 0 || Object.keys(kvB).length > 0;

      if (this.worker) {
        this.kvEpoch += 1;
        const stale = this.worker;
        this.worker = null;
        stale.terminate();
      }

      const worker = new Worker('/lnlab/worker.js', { type: 'module' });
      this.worker = worker;
      const deadline = setTimeout(() => {
        if (this.worker === worker && this.status.phase === 'booting') {
          this.patch({
            phase: 'off',
            error: `worker: ${tSync('aucune réponse du module — vérifiez votre connexion puis réactivez le laboratoire')}`,
          });
          worker.terminate();
          if (this.worker === worker) this.worker = null;
        }
      }, 60000);
      worker.onmessage = (event) => {
        this.onWorkerMessage(event.data, worker);
      };
      worker.onerror = (event) => {
        clearTimeout(deadline);
        this.patch({
          phase: 'off',
          error: `worker: ${event.message || tSync('script du worker non chargé — rechargez la page et réessayez')}`,
        });
      };
      worker.onmessageerror = () => {
        clearTimeout(deadline);
        this.patch({ phase: 'off', error: `worker: ${tSync('message illisible du module')}` });
      };
      worker.postMessage({
        type: 'boot',
        network,
        mode: restore ? 'restore' : 'fresh',
        seeds: { a: new Uint8Array(seeds.a), b: new Uint8Array(seeds.b) },
        kv: { a: this.kvToArray(kvA), b: this.kvToArray(kvB) },
        regtestHeader:
          network === 'regtest' && regtestMode() === 'external' ? regtestHeaderValue() : '',
        chainBridge: shouldBridgeChain(network, regtestMode()),
      });
    } catch (err) {
      this.patch({ phase: 'off', error: `activation: ${(err as Error).message}` });
    }
  }

  deactivate(): void {
    const worker = this.worker;
    if (!worker) {
      this.patch({ phase: 'off' });
      return;
    }
    this.kvEpoch += 1;
    this.patch({ phase: 'stopping' });
    const timeout = setTimeout(() => {
      worker.terminate();
      this.finishStop(worker);
    }, 3000);
    const onStopped = (event: MessageEvent) => {
      if (event.data?.type !== 'stopped') return;
      clearTimeout(timeout);
      worker.removeEventListener('message', onStopped);
      worker.terminate();
      this.finishStop(worker);
    };
    worker.addEventListener('message', onStopped);
    worker.postMessage({ type: 'stop' });
  }

  async reset(network: LnNetId): Promise<void> {
    this.kvEpoch += 1;
    this.deactivate();
    await idbDel(SEEDS_KEY(network));
    await idbDel(KV_KEY(network, 'A'));
    await idbDel(KV_KEY(network, 'B'));
    this.patch({
      phase: 'off',
      nodeA: null,
      nodeB: null,
      channelsA: [],
      channelsB: [],
      events: [],
      best: null,
      connected: false,
      pendingFunding: null,
    });
  }

  private finishStop(worker: Worker | null) {
    if (worker && this.worker !== worker) return;
    this.worker = null;
    this.patch({ phase: 'off', connected: false });
  }

  private async loadOrCreateSeeds(network: LnNetId): Promise<Seeds> {
    const existing = (await idbGet(SEEDS_KEY(network))) as Seeds | undefined;
    if (existing && Array.isArray(existing.a) && existing.a.length === 32) return existing;
    const draw = () => Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const seeds: Seeds = { a: draw(), b: draw() };
    await idbSet(SEEDS_KEY(network), seeds);
    return seeds;
  }

  private async loadKvMap(network: LnNetId, node: NodeKey): Promise<KvMap> {
    const stored = (await idbGet(KV_KEY(network, node))) as KvMap | undefined;
    return stored ?? {};
  }

  private kvToArray(map: KvMap): Array<[string, string, string, Uint8Array]> {
    return Object.entries(map).map(([composite, value]) => {
      const sep = composite.indexOf('|');
      return [
        composite.slice(0, sep),
        composite.slice(sep + 1, composite.indexOf('|', sep + 1)),
        composite.slice(composite.indexOf('|', sep + 1) + 1),
        value,
      ] as [string, string, string, Uint8Array];
    });
  }

  private onWorkerMessage(msg: { type: string; [field: string]: unknown }, sender: Worker | null) {
    if (sender && sender !== this.worker && msg.type !== 'stopped') return;
    switch (msg.type) {
      case 'ready':
        this.patch({
          phase: 'ready',
          nodeA: msg.nodeA as string,
          nodeB: msg.nodeB as string,
          best: msg.best as { height: number; hash: string },
          error: null,
        });
        break;
      case 'status': {
        if (this.status.phase !== 'ready') break;
        this.patch({
          connected: Boolean(msg.connected),
          best: (msg.best as { height: number; hash: string }) ?? this.status.best,
          channelsA: msg.channelsA as unknown[] as LnChannelView[],
          channelsB: msg.channelsB as unknown[] as LnChannelView[],
        });
        break;
      }
      case 'events':
        this.pushEvents((msg.events ?? []) as LnEventView[]);
        break;
      case 'log':
        this.pushLog(msg.node as string, msg.line as string);
        break;
      case 'kv': {
        const network = this.network;
        if (!network) break;
        const epoch = this.kvEpoch;
        const entries = (msg.entries ?? []) as [
          string,
          string,
          string,
          string,
          Uint8Array | null,
        ][];
        this.kvQueue = this.kvQueue
          .then(() => {
            if (epoch === this.kvEpoch) return this.flushKv(network, entries);
          })
          .catch((err) => this.pushLog('sys', `kv: ${(err as Error).message}`));
        break;
      }
      case 'broadcast': {
        const c = classifyBroadcast(Boolean(msg.ok), String(msg.detail ?? ''));
        const broadcasts = [
          { ok: c.ok, detail: c.detail, at: Date.now() },
          ...this.status.broadcasts,
        ].slice(0, 20);
        this.patch({ broadcasts });
        break;
      }
      case 'fundingSubmitted':
        if (
          this.status.pendingFunding &&
          String(msg.userChannelId ?? '') === this.status.pendingFunding.userChannelId
        ) {
          this.patch({ pendingFunding: null });
        }
        break;
      case 'chainBridgeRequest':
        void this.serveChainBridge(
          msg as unknown as {
            id: string;
            path: string;
            tx?: string;
          },
        );
        break;
      case 'error': {
        const message = String(msg.message ?? 'erreur inconnue');
        if (sender === this.worker && this.status.phase === 'booting') {
          this.patch({ phase: 'off', error: message });
        }
        this.pushLog('sys', message);
        break;
      }
      case 'stopped':
        this.finishStop(sender);
        break;
      default:
        break;
    }
  }

  private async flushKv(
    network: LnNetId,
    entries: [string, string, string, string, Uint8Array | null][],
  ) {
    const perNode: Partial<Record<NodeKey, KvMap>> = {
      A: await this.loadKvMap(network, 'A'),
      B: await this.loadKvMap(network, 'B'),
    };
    for (const [node, primary, secondary, key, value] of entries) {
      const map = perNode[node as NodeKey];
      if (!map) continue;
      const composite = `${primary}|${secondary}|${key}`;
      if (value === null) delete map[composite];
      else map[composite] = value;
    }
    await idbSet(KV_KEY(network, 'A'), perNode.A);
    await idbSet(KV_KEY(network, 'B'), perNode.B);
  }

  private async serveChainBridge(req: { id: string; path: string; tx?: string }) {
    const id = String(req.id ?? '');
    const reply = (ok: boolean, body?: unknown, detail?: string) => {
      if (this.worker) {
        this.worker.postMessage({ type: 'chainBridgeReply', id, ok, body, detail });
      }
    };
    const path = String(req.path ?? '');
    try {
      if (path === 'tx') {
        const raw = String(req.tx ?? '').trim();
        if (!LN_CHAIN_BRIDGE_TX_RX.test(raw)) {
          reply(false, undefined, 'transaction brute invalide');
          return;
        }
        await regtestChain.broadcast(raw);
        reply(true, '');
        return;
      }
      if (!LN_CHAIN_BRIDGE_PATH_RX.test(path)) {
        reply(false, undefined, 'chemin interdit pour le pont Lightning');
        return;
      }
      const body = await regtestChain.query<unknown>(path);
      reply(true, body);
    } catch (err) {
      reply(false, undefined, (err as Error).message);
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.worker || this.status.phase !== 'ready') return;
    this.worker.postMessage(payload);
  }

  private request<T>(
    payload: Record<string, unknown>,
    matchReply: (data: { type: string; [field: string]: unknown }) => T | undefined,
    timeoutLabel: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = payload.id;
      const worker = this.worker;
      if (!worker || this.status.phase !== 'ready') {
        return reject(new Error(tSync('laboratoire inactif')));
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
      };
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type: string; requestId?: unknown; [field: string]: unknown };
        if (data?.type === 'error') {
          if (data.requestId !== undefined && data.requestId !== id) return;
          cleanup();
          reject(new Error(String(data.message)));
          return;
        }
        const reply = matchReply(data);
        if (reply !== undefined) {
          cleanup();
          resolve(reply);
        }
      };
      worker.addEventListener('message', onMessage);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(tSync(timeoutLabel)));
      }, 15000);
      this.send(payload);
    });
  }

  openChannel(valueSats: number, pushMsat: number): Promise<void> {
    const userChannelId = Date.now();
    return this.request<void>(
      { type: 'openChannel', valueSats, pushMsat, userChannelId },
      (data) =>
        (data.type === 'channelRequested' && Number(data.userChannelId) === userChannelId
          ? true
          : undefined) as void,
      'délai de la demande d’ouverture dépassé',
    );
  }

  submitFundingTx(hexTx: string, userChannelId: string): Promise<void> {
    return this.request<void>(
      { type: 'fundingTx', hex: hexTx, userChannelId, id: userChannelId },
      (data) =>
        (data.type === 'fundingSubmitted' && String(data.userChannelId) === String(userChannelId)
          ? true
          : undefined) as void,
      'délai de financement dépassé',
    );
  }

  createInvoice(
    node: NodeKey,
    amountMsat: number | null,
    description: string,
    expirySecs: number,
  ): Promise<string> {
    const id = `inv-${Date.now()}`;
    return this.request<string>(
      {
        type: 'createInvoice',
        id,
        node: node === 'A' ? 0 : 1,
        amountMsat,
        description,
        expirySecs,
      },
      (data) => (data.type === 'invoice' && data.id === id ? (data.bolt11 as string) : undefined),
      'délai de création de facture dépassé',
    );
  }

  payInvoice(node: NodeKey, invoice: string, amountMsat: number | null): void {
    this.send({ type: 'payInvoice', node: node === 'A' ? 0 : 1, invoice, amountMsat });
  }

  createOffer(node: NodeKey, amountMsat: number | null, description: string): Promise<string> {
    const id = `offer-${Date.now()}`;
    return this.request<string>(
      { type: 'createOffer', id, node: node === 'A' ? 0 : 1, amountMsat, description },
      (data) => (data.type === 'offer' && data.id === id ? (data.offer as string) : undefined),
      'délai de création d’offer dépassé',
    );
  }

  payOffer(
    node: NodeKey,
    offer: string,
    amountMsat: number | null,
    payerNote: string | null,
  ): void {
    this.send({ type: 'payOffer', node: node === 'A' ? 0 : 1, offer, amountMsat, payerNote });
  }

  decodeOffer(offer: string): Promise<LnOfferView> {
    const id = `decode-${Date.now()}`;
    return this.request<LnOfferView>(
      { type: 'decodeOffer', id, offer },
      (data) =>
        data.type === 'offerInfo' && data.id === id ? (data.info as LnOfferView) : undefined,
      'délai de décodage dépassé',
    );
  }

  closeChannel(node: NodeKey, channelId: string): void {
    this.send({ type: 'closeChannel', node: node === 'A' ? 0 : 1, channelId });
  }
}

export const lnLab = new LnLabController();

export async function resolveChannelScid(channel: LnChannelView): Promise<string | null> {
  const outpoint = parseFundingOutpoint(channel.fundingTxo ?? '');
  if (!outpoint) return null;
  try {
    const tx = await api.tx(outpoint.txid);
    return scidFromConfirmedStatus(tx.status, outpoint.vout);
  } catch {
    return null;
  }
}

export function msatToSats(msat: string | number | null | undefined): number {
  const value = typeof msat === 'string' ? Number(msat) : msat;
  if (!Number.isFinite(value)) return 0;
  return Math.floor((value ?? 0) / 1000);
}
