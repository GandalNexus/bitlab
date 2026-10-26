/**
 * BitLab — Lightning lab controller (browser-side LDK via WebAssembly).
 *
 * Replaces the former Python sidecar: the two LDK nodes run inside a Web
 * Worker (`/lnlab/worker.js`) backed by the `lnlab` WASM module compiled from
 * `rust/lnlab`. The main thread owns persistence (IndexedDB, zero-knowledge:
 * seeds and node state never leave the browser) and bridges funding events to
 * the user's wallets.
 */

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { hex } from '@scure/base';
import { scriptToAddressOn } from './bitcoin/tx';
import { regtestHeaderValue, regtestMode } from './regtest';
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

/** Champs décodés d'une offer BOLT12 (lno1…), renvoyés par le WASM. */
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

class LnLabController {
  private status: LnLabStatus = { ...initialStatus, channelsA: [], channelsB: [], events: [], logs: [], broadcasts: [] };
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private network: LnNetId | null = null;

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
        // Adresse encodée pour le RÉSEAU du labo (bcrt1… sur regtest) —
        // l'encodage testnet générique produisait une tb1… que le
        // constructeur de transaction refuse sur la chaîne locale.
        address: net ? (scriptToAddressOn(scriptBytes, net) ?? null) : null,
      };
    }
    if (events.some((e) => e.type === 'channel_ready' || e.type === 'channel_closed')) {
      pendingFunding = null;
    }
    this.patch({ events: merged, pendingFunding });
  }

  /* ─────────────────── Cycle de vie ─────────────────── */

  async activate(network: LnNetId): Promise<void> {
    if (this.status.phase === 'booting' || this.status.phase === 'ready') return;
    this.network = network;
    this.patch({ phase: 'booting', network, error: null, logs: [], events: [], broadcasts: [], pendingFunding: null });
    try {
      const seeds = await this.loadOrCreateSeeds(network);
      const kvA = await this.loadKvMap(network, 'A');
      const kvB = await this.loadKvMap(network, 'B');
      const restore = Object.keys(kvA).length > 0 || Object.keys(kvB).length > 0;

      const worker = new Worker('/lnlab/worker.js', { type: 'module' });
      this.worker = worker;
      // Watchdog : un worker sans réponse (script non chargé, WASM bloqué) ne
      // doit pas laisser le labo coincé en « démarrage… » pour toujours. Toute
      // entrée du worker prouve qu'il vit et réarme le compteur.
      let watchdog: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        watchdog = null;
        if (this.worker === worker) {
          this.patch({
            phase: 'off',
            error: `worker: ${tSync('aucune réponse du module — vérifiez votre connexion puis réactivez le laboratoire')}`,
          });
          worker.terminate();
          this.worker = null;
        }
      }, 60000);
      const clearWatchdog = () => {
        if (watchdog) {
          clearTimeout(watchdog);
          watchdog = null;
        }
      };
      worker.onmessage = (event) => {
        clearWatchdog();
        this.onWorkerMessage(event.data);
      };
      worker.onerror = (event) => {
        // Les échecs de chargement du script arrivent sans message : afficher
        // « worker: undefined » n'apprend rien — décrire la panne à la place.
        this.patch({
          phase: 'off',
          error: `worker: ${event.message || tSync('script du worker non chargé — rechargez la page et réessayez')}`,
        });
      };
      worker.onmessageerror = () => {
        this.patch({ phase: 'off', error: `worker: ${tSync('message illisible du module')}` });
      };
      worker.postMessage({
        type: 'boot',
        network,
        mode: restore ? 'restore' : 'fresh',
        seeds: { a: new Uint8Array(seeds.a), b: new Uint8Array(seeds.b) },
        kv: { a: this.kvToArray(kvA), b: this.kvToArray(kvB) },
        // Regtest : en mode externe uniquement, la config du nœud local
        // (hôte + identifiants RPC) voyage pré-encodée — le worker n'a pas
        // accès à localStorage. Mode embarqué : chaîne du serveur BitLab.
        regtestHeader: network === 'regtest' && regtestMode() === 'external' ? regtestHeaderValue() : '',
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
    this.patch({ phase: 'stopping' });
    const timeout = setTimeout(() => worker.terminate(), 3000);
    const onStopped = (event: MessageEvent) => {
      if (event.data?.type !== 'stopped') return;
      clearTimeout(timeout);
      worker.removeEventListener('message', onStopped);
      worker.terminate();
      this.finishStop();
    };
    worker.addEventListener('message', onStopped);
    worker.postMessage({ type: 'stop' });
  }

  /** Stops the lab AND wipes all local Lightning state (seeds, nodes, channels). */
  async reset(network: LnNetId): Promise<void> {
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

  private finishStop() {
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
      return [composite.slice(0, sep), composite.slice(sep + 1, composite.indexOf('|', sep + 1)), composite.slice(composite.indexOf('|', sep + 1) + 1), value] as [string, string, string, Uint8Array];
    });
  }

  /* ─────────────────── Messages du worker ─────────────────── */

  private onWorkerMessage(msg: {
    type: string;
    [field: string]: unknown;
  }) {
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
          channelsA: (msg.channelsA as unknown[]) as LnChannelView[],
          channelsB: (msg.channelsB as unknown[]) as LnChannelView[],
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
        if (!this.network) break;
        const entries = (msg.entries ?? []) as [string, string, string, string, Uint8Array | null][];
        this.flushKv(this.network, entries).catch((err) => this.pushLog('sys', `kv: ${(err as Error).message}`));
        break;
      }
      case 'broadcast': {
        const broadcasts = [{ ok: Boolean(msg.ok), detail: String(msg.detail ?? ''), at: Date.now() }, ...this.status.broadcasts].slice(0, 20);
        this.patch({ broadcasts });
        break;
      }
      case 'error':
        this.pushLog('sys', String(msg.message ?? 'erreur inconnue'));
        break;
      case 'stopped':
        this.finishStop();
        break;
      default:
        break;
    }
  }

  private async flushKv(network: LnNetId, entries: [string, string, string, string, Uint8Array | null][]) {
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

  /* ─────────────────── Actions ─────────────────── */

  private send(payload: Record<string, unknown>) {
    if (!this.worker || this.status.phase !== 'ready') return;
    this.worker.postMessage(payload);
  }

  /** Demande l'ouverture d'un canal A → B. Résout une fois LDK a accepté la
   * négociation ; rejette avec le vrai message d'erreur sinon — plus jamais
   * d'échec silencieux au clic. */
  openChannel(valueSats: number, pushMsat: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const userChannelId = Date.now();
      const worker = this.worker;
      if (!worker) return reject(new Error('laboratoire inactif'));
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (data?.type === 'channelRequested' && Number(data.userChannelId) === userChannelId) {
          worker.removeEventListener('message', onMessage);
          resolve();
        } else if (data?.type === 'error' && (data.message as string)?.startsWith('canal:')) {
          worker.removeEventListener('message', onMessage);
          reject(new Error(String(data.message).replace(/^canal:\s*/, '')));
        }
      };
      worker.addEventListener('message', onMessage);
      this.send({ type: 'openChannel', valueSats, pushMsat, userChannelId });
      setTimeout(() => {
        worker.removeEventListener('message', onMessage);
        reject(new Error('délai de la demande d’ouverture dépassé'));
      }, 15000);
    });
  }

  submitFundingTx(hexTx: string, userChannelId: string): void {
    this.send({ type: 'fundingTx', hex: hexTx, userChannelId });
    this.patch({ pendingFunding: null });
  }

  createInvoice(node: NodeKey, amountMsat: number | null, description: string, expirySecs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = `inv-${Date.now()}`;
      const worker = this.worker;
      if (!worker) return reject(new Error('laboratoire inactif'));
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (data?.type === 'invoice' && data.id === id) {
          worker.removeEventListener('message', onMessage);
          resolve(data.bolt11 as string);
        } else if (data?.type === 'error' && (data.message as string)?.startsWith('facture:')) {
          worker.removeEventListener('message', onMessage);
          reject(new Error(String(data.message).replace(/^facture:\s*/, '')));
        }
      };
      worker.addEventListener('message', onMessage);
      this.send({ type: 'createInvoice', id, node: node === 'A' ? 0 : 1, amountMsat, description, expirySecs });
      setTimeout(() => {
        worker.removeEventListener('message', onMessage);
        reject(new Error('délai de création de facture dépassé'));
      }, 15000);
    });
  }

  payInvoice(node: NodeKey, invoice: string, amountMsat: number | null): void {
    this.send({ type: 'payInvoice', node: node === 'A' ? 0 : 1, invoice, amountMsat });
  }

  /** Crée une offer BOLT12 (lno1…) signée par le nœud choisi. */
  createOffer(node: NodeKey, amountMsat: number | null, description: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = `offer-${Date.now()}`;
      const worker = this.worker;
      if (!worker) return reject(new Error('laboratoire inactif'));
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (data?.type === 'offer' && data.id === id) {
          worker.removeEventListener('message', onMessage);
          resolve(data.offer as string);
        } else if (data?.type === 'error' && (data.message as string)?.startsWith('offer:')) {
          worker.removeEventListener('message', onMessage);
          reject(new Error(String(data.message).replace(/^offer:\s*/, '')));
        }
      };
      worker.addEventListener('message', onMessage);
      this.send({ type: 'createOffer', id, node: node === 'A' ? 0 : 1, amountMsat, description });
      setTimeout(() => {
        worker.removeEventListener('message', onMessage);
        reject(new Error('délai de création d’offer dépassé'));
      }, 15000);
    });
  }

  /** Paie une offer BOLT12 : demande de facture via onion messages puis HTLC. */
  payOffer(node: NodeKey, offer: string, amountMsat: number | null, payerNote: string | null): void {
    this.send({ type: 'payOffer', node: node === 'A' ? 0 : 1, offer, amountMsat, payerNote });
  }

  /** Décode une offer BOLT12 sans toucher à l'état des nœuds. */
  decodeOffer(offer: string): Promise<LnOfferView> {
    return new Promise((resolve, reject) => {
      const id = `decode-${Date.now()}`;
      const worker = this.worker;
      if (!worker) return reject(new Error('laboratoire inactif'));
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (data?.type === 'offerInfo' && data.id === id) {
          worker.removeEventListener('message', onMessage);
          resolve(data.info as LnOfferView);
        } else if (data?.type === 'error' && (data.message as string)?.startsWith('offer:')) {
          worker.removeEventListener('message', onMessage);
          reject(new Error(String(data.message).replace(/^offer:\s*/, '')));
        }
      };
      worker.addEventListener('message', onMessage);
      this.send({ type: 'decodeOffer', id, offer });
      setTimeout(() => {
        worker.removeEventListener('message', onMessage);
        reject(new Error('délai de décodage dépassé'));
      }, 15000);
    });
  }

  closeChannel(node: NodeKey, channelId: string): void {
    this.send({ type: 'closeChannel', node: node === 'A' ? 0 : 1, channelId });
  }
}

/** Singleton partagé par toutes les vues du labo Lightning. */
export const lnLab = new LnLabController();

export function msatToSats(msat: string | number | null | undefined): number {
  const value = typeof msat === 'string' ? Number(msat) : msat;
  if (!Number.isFinite(value)) return 0;
  return Math.floor((value ?? 0) / 1000);
}

/** Libellé i18n-ready d'un événement de labo. */
export function eventKindKey(type: string): string {
  return `labo.event.${type}`;
}
