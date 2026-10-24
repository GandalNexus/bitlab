/**
 * BitLab — Testnet4 miner controller in-browser.
 *
 * Watches tip via Esplora proxy (/api/bitcoin), waits for BIP 94
 * minimum-difficulty windows (tip aged >20 min), assembles template
 * (coinbase → active wallet address), distributes nonce ranges to Web Workers
 * (public/miner/worker.js), and broadcasts found blocks via /api/mine/submit
 * (minimal P2P handshake on server Node).
 *
 * Memory discipline: at most MAX_THREADS short-lived workers (terminate on stop),
 * no unbounded history, single watch timer. No private keys leave browser — coinbase
 * references only public address supplied by user.
 */
import { hex } from '@scure/base';
import { addressToScript } from '../bitcoin/tx';
import { currentNet, type NetId } from '../networks';
import { regtestHeaders } from '../regtest';
import { useLabStore } from '../store';
import {
  COINBASE_MATURITY,
  MIN_DIFF_BITS,
  WINDOW_SECS,
  assembleBlock,
  assembleHeader76,
  blockHash,
  blockSubsidy,
  buildCoinbase,
  compactBitsToTarget,
  headerMeetsTarget,
  headerU32,
  windowStatus,
  type WindowStatus,
} from './core';

export type MinerPhase = 'off' | 'watching' | 'mining' | 'submitting' | 'error';

export interface MinedBlock {
  hash: string;
  height: number;
  at: number;
  confirmations: number;
}

export interface MinerStatus {
  phase: MinerPhase;
  engine: 'wasm' | 'js' | null;
  address: string | null;
  threads: number;
  hashes: number;
  hashrate: number; // H/s (moyenne glissante)
  window: WindowStatus | null;
  nextHeight: number | null;
  tipAgeSec: number | null;
  blocks: MinedBlock[];
  lastError: string | null;
  startedAt: number | null;
}

const MAX_THREADS = 8;
const TIP_POLL_TESTNET4_MS = 20_000;
/** Regtest : le tip avance à chaque bloc miné — sondage rapide pour enchaîner. */
const TIP_POLL_REGTEST_MS = 2_000;
const CONF_POLL_MS = 120_000;
const MAX_BLOCKS_TRACKED = 6;
const TIP_FUTURE_TOLERANCE_SEC = 7200;

const initialStatus: MinerStatus = {
  phase: 'off',
  engine: null,
  address: null,
  threads: 0,
  hashes: 0,
  hashrate: 0,
  window: null,
  nextHeight: null,
  tipAgeSec: null,
  blocks: [],
  lastError: null,
  startedAt: null,
};

interface TipInfo {
  hash: string;
  height: number;
  time: number;
  bits: number;
}

interface WorkerSession {
  worker: Worker;
  jobId: number;
}

class MinerController {
  private status: MinerStatus = { ...initialStatus, blocks: [] };
  private listeners = new Set<() => void>();
  private tipTimer: ReturnType<typeof setInterval> | null = null;
  private confTimer: ReturnType<typeof setInterval> | null = null;
  private sessions: WorkerSession[] = [];
  private jobIdSeq = 0;
  /** Réseau miné — verrouillé au démarrage, revalidé à chaque sondage. */
  private net: NetId = 'testnet4';
  private template: { header76Hex: string; txHex: string; tipHash: string; height: number; target: Uint8Array; subsidySats: number } | null = null;
  private hashrateWindow: { at: number; hashes: number } = { at: 0, hashes: 0 };

  getStatus = (): MinerStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(part: Partial<MinerStatus>) {
    this.status = { ...this.status, ...part };
    this.listeners.forEach((l) => l());
  }

  private fail(message: string) {
    this.stopWorkers();
    this.patch({ phase: 'error', lastError: message });
    useLabStore.getState().addLog({
      kind: 'error',
      module: 'mineur',
      label: 'mineur en erreur',
      detail: { erreur: message.slice(0, 200) },
    });
  }

  /* ──────────────────────── Cycle de vie ──────────────────────── */

  /** Démarre la surveillance + minage vers `address` (testnet4 BIP 94 ou regtest local). */
  start(address: string, threads = 4, net: NetId = 'testnet4'): void {
    if (this.status.phase !== 'off' && this.status.phase !== 'error') return;
    const count = Math.max(1, Math.min(MAX_THREADS, threads));
    this.net = net;
    this.patch({
      phase: 'watching',
      address,
      threads: count,
      lastError: null,
      startedAt: Date.now(),
      hashes: 0,
      hashrate: 0,
      engine: null,
    });
    useLabStore.getState().addLog({
      kind: 'op',
      module: 'mineur',
      label: 'mineur démarré',
      detail: { réseau: net, adresse: address, threads: count },
    });
    const pollMs = net === 'regtest' ? TIP_POLL_REGTEST_MS : TIP_POLL_TESTNET4_MS;
    this.tipTimer = setInterval(() => void this.pollTip(), pollMs);
    void this.pollTip();
  }

  stop(): void {
    const wasActive = this.status.phase !== 'off' && this.status.phase !== 'error';
    const hashes = this.status.hashes;
    this.stopWorkers();
    if (this.tipTimer) clearInterval(this.tipTimer);
    if (this.confTimer) clearInterval(this.confTimer);
    this.tipTimer = null;
    this.confTimer = null;
    this.template = null;
    this.patch({ phase: 'off', engine: null, hashrate: 0, window: null });
    if (wasActive) {
      useLabStore.getState().addLog({
        kind: 'op',
        module: 'mineur',
        label: 'mineur arrêté',
        detail: { hachages: hashes },
      });
    }
  }

  /** Recalcule une vue i18n-friendly du suivi des confirmations. */
  private startConfirmationWatch() {
    if (this.confTimer) return;
    this.confTimer = setInterval(() => void this.refreshConfirmations(), CONF_POLL_MS);
  }

  private async refreshConfirmations() {
    const tipHeight = await this.fetchTipHeight();
    if (tipHeight === null) return;
    const updated = this.status.blocks.map((b) => ({
      ...b,
      confirmations: Math.max(0, tipHeight - b.height + 1),
    }));
    // Un bloc complètement mûr disparaît de la liste (l'affichage passe au
    // portefeuille, qui voit la balance réelle via l'explorateur).
    const kept = updated.filter((b) => b.confirmations < COINBASE_MATURITY);
    this.patch({ blocks: kept });
    if (kept.length === 0 && this.confTimer) {
      clearInterval(this.confTimer);
      this.confTimer = null;
    }
  }

  /* ──────────────────────── Chaîne & fenêtres ──────────────────────── */

  private async proxy(path: string): Promise<string | null> {
    const res = await fetch(`/api/bitcoin?network=${this.net}&path=${encodeURIComponent(path)}`, {
      headers: this.net === 'regtest' ? regtestHeaders() : {},
    });
    if (!res.ok) return null;
    return res.text();
  }

  private async fetchTipHeight(): Promise<number | null> {
    const body = await this.proxy('blocks/tip/height');
    if (body === null) return null;
    const height = Number(body.trim());
    return Number.isFinite(height) ? height : null;
  }

  private async fetchTip(): Promise<TipInfo | null> {
    try {
      const height = await this.fetchTipHeight();
      if (height === null) return null;
      const hash = (await this.proxy('blocks/tip/hash'))?.trim();
      if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
      const header = (await this.proxy(`block/${hash}/header`))?.trim();
      if (!header || header.length !== 160) return null;
      const time = headerU32(header, 68);
      const bits = headerU32(header, 72);
      return { hash, height, time, bits };
    } catch {
      return null; // réseau indisponible — prochaine sonde
    }
  }

  private async pollTip(): Promise<void> {
    if (this.status.phase === 'off' || this.status.phase === 'error') return;
    // Changement de réseau pendant le minage : le gabarit suivrait le mauvais
    // tip — arrêt immédiat (relançable depuis l'UI sur le nouveau réseau).
    if (this.net !== currentNet()) {
      this.stop();
      return;
    }
    const tip = await this.fetchTip();
    if (!tip) return;

    const nowMs = Date.now();
    const tipAge = Math.floor(nowMs / 1000) - tip.time;
    // Les tips testnet4 peuvent être datés dans le futur (bots BIP 94) :
    // on borne l'affichage et on refuse les horloges locales aberrantes.
    if (tipAge < -TIP_FUTURE_TOLERANCE_SEC) return; // horloge locale suspecte
    const nextHeight = tip.height + 1;
    const win: WindowStatus =
      this.net === 'regtest'
        ? { open: true, reason: 'gap-ok', secondsUntilOpen: 0 } // difficulté 1 en continu, pas de fenêtre BIP 94
        : windowStatus(tip.time, nowMs, nextHeight);
    this.patch({ window: win, nextHeight, tipAgeSec: tipAge });

    // Un nouveau tip pendant le minage → notre gabarit devient périmé.
    if (this.status.phase === 'mining' && this.template && this.template.tipHash !== tip.hash) {
      this.stopWorkers();
      this.template = null;
      this.patch({ phase: 'watching' });
      return;
    }

    if (win.open && this.status.phase === 'watching') {
      await this.beginMining(tip, nextHeight);
    }
  }

  /* ──────────────────────── Minage ──────────────────────── */

  private async beginMining(tip: TipInfo, nextHeight: number): Promise<void> {
    const address = this.status.address;
    if (!address) return this.fail('adresse de paiement manquante');
    const isLocal = this.net === 'regtest';
    // Regtest : les nBits du tip (difficulté 1) sont repris tels quels — un
    // réajustement récent pourrait différer du powLimit théorique.
    const bits = isLocal ? tip.bits : MIN_DIFF_BITS;
    try {
      // Tag lisible + 9 octets d'aléa dans le scriptSig (BIP 34 exige la
      // hauteur en tête ; l'aléa garantit l'unicité inter-blocs du script).
      const tagText = new TextEncoder().encode('/BitLab/');
      const fullTag = new Uint8Array(tagText.length + 9);
      fullTag.set(tagText, 0);
      crypto.getRandomValues(fullTag.subarray(tagText.length));

      // Subvention exacte du bloc selon le réseau et la hauteur (halving
      // 150 blocs en regtest, 210 000 en testnet4) — une coinbase
      // supérieure à subvention + frais serait rejetée par la validation.
      const subsidySats = blockSubsidy(nextHeight, this.net);
      if (subsidySats <= 0) return this.fail(`subvention nulle à la hauteur ${nextHeight} — plus rien à miner`);
      const { txHex, txid } = buildCoinbase({
        height: nextHeight,
        scriptPubKey: addressToScript(address),
        valueSats: subsidySats,
        tag: fullTag,
      });
      const header76Hex = assembleHeader76({
        tipHashHex: tip.hash,
        txidHex: txid,
        tipTimeSec: tip.time,
        nowMs: Date.now(),
        bits,
        timeGapSec: isLocal ? 0 : WINDOW_SECS,
      });
      this.template = {
        header76Hex,
        txHex,
        tipHash: tip.hash,
        height: nextHeight,
        target: compactBitsToTarget(bits),
        subsidySats,
      };
    } catch (err) {
      return this.fail(`gabarit : ${(err as Error).message}`);
    }
    this.hashrateWindow = { at: Date.now(), hashes: 0 };
    this.patch({ phase: 'mining', hashes: 0, hashrate: 0 });
    this.spawnWorkers();
  }

  private spawnWorkers() {
    if (!this.template) return;
    const threads = this.status.threads;
    const span = Math.floor(0x1_0000_0000 / threads);
    this.sessions = [];
    for (let i = 0; i < threads; i++) {
      const worker = new Worker('/miner/worker.js', { type: 'module' });
      const session: WorkerSession = { worker, jobId: ++this.jobIdSeq };
      worker.onmessage = (event) => this.onWorkerMessage(session, event.data);
      worker.onerror = (event) => this.fail(`worker : ${event.message}`);
      worker.postMessage({
        cmd: 'boot',
      });
      worker.postMessage({
        cmd: 'job',
        job: session.jobId,
        header76Hex: this.template.header76Hex,
        targetHex: hex.encode(this.template.target),
        startNonce: (i * span) >>> 0,
        endNonce: ((i + 1) * span) >>> 0,
      });
      this.sessions.push(session);
    }
  }

  private stopWorkers() {
    for (const { worker } of this.sessions) {
      try {
        worker.terminate();
      } catch {
        /* déjà terminé */
      }
    }
    this.sessions = [];
    this.sessionHashes.clear();
  }

  /** Compteur de hachages cumulés par session worker (pour le hashrate). */
  private sessionHashes = new Map<number, number>();

  private onWorkerMessage(session: WorkerSession, msg: { type: string; [k: string]: unknown }) {
    switch (msg.type) {
      case 'ready':
        if (!this.status.engine) this.patch({ engine: msg.engine as 'wasm' | 'js' });
        break;
      case 'progress': {
        if (msg.job !== session.jobId) break;
        // Chaque worker rapporte son cumul depuis le début du job ; la
        // puissance totale est la somme des sessions actives.
        this.sessionHashes.set(session.jobId, Number(msg.hashes ?? 0));
        let total = 0;
        for (const h of this.sessionHashes.values()) total += h;
        const elapsed = Math.max(1, Number(msg.ms ?? 1)) / 1000;
        this.patch({ hashes: total, hashrate: Math.round(total / elapsed) });
        break;
      }
      case 'exhausted':
        // Plage de nonce épuisée sans succès : le gabarit est battu sur cette
        // fenêtre — on laisse le worker en veille, la prochaine sonde de tip
        // reconstruira un gabarit frais (nouveau tip ou temps écoulé).
        break;
      case 'found':
        void this.onBlockFound(session, Number(msg.nonce));
        break;
      case 'error':
        this.fail(String(msg.message ?? 'erreur worker'));
        break;
      default:
        break;
    }
  }

  private async onBlockFound(session: WorkerSession, nonce: number): Promise<void> {
    if (!this.template) return;
    // Double vérification côté hôte — aucun bloc douteux ne quitte le lab.
    const header = assembleBlock(this.template.header76Hex, nonce, '');
    if (!headerMeetsTarget(header.slice(0, 160), this.template.target)) {
      return; // faux positif (impossible en théorie) — on ignore
    }
    const hash = blockHash(header.slice(0, 160));
    const blockHex = assembleBlock(this.template.header76Hex, nonce, this.template.txHex);

    this.stopWorkers();
    this.patch({ phase: 'submitting' });

    let ok = false;
    let detail = '';
    try {
      const res = await fetch('/api/mine/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(this.net === 'regtest' ? regtestHeaders() : {}) },
        body: JSON.stringify({ net: this.net, block: blockHex }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string };
      ok = Boolean(body.ok);
      detail = String(body.detail ?? '');
    } catch (err) {
      detail = (err as Error).message;
    }

    if (!ok) {
      // Bloc refusé ou diffusion impossible : on reprend la surveillance —
      // la prochaine sonde reconstruira un gabarit à jour.
      const height = this.template?.height ?? null;
      this.template = null;
      this.patch({ phase: 'watching', lastError: `diffusion : ${detail}` });
      useLabStore.getState().addLog({
        kind: 'error',
        module: 'mineur',
        label: 'bloc refusé',
        detail: { hauteur: height, détail: detail.slice(0, 160) },
      });
      return;
    }

    const mined: MinedBlock = {
      hash,
      height: this.template.height,
      at: Date.now(),
      confirmations: 1,
    };
    const minedSubsidy = this.template.subsidySats;
    this.template = null;
    this.patch({
      phase: 'watching',
      blocks: [mined, ...this.status.blocks].slice(0, MAX_BLOCKS_TRACKED),
      lastError: null,
    });
    useLabStore.getState().addLog({
      kind: 'op',
      module: 'mineur',
      label: 'bloc accepté',
      detail: { hauteur: mined.height, hash, récompense: `${minedSubsidy} sats` },
    });
    this.startConfirmationWatch();
    // Regtest : chaque bloc prolonge la chaîne locale — on enchaîne aussitôt
    // (le sondage périodique reste la sécurité, ceci enlève juste l'attente).
    if (this.net === 'regtest') void this.pollTip();
  }
}

/** Singleton partagé par le portefeuille et le labo Lightning. */
export const miner = new MinerController();
