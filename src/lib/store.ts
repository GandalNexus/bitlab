/**
 * BitLab — État global du laboratoire (Zustand).
 * Persistance : IndexedDB locale uniquement (cf. 3.1 du cahier des charges).
 * ⚠ Protocole de sécurité : les clés privées restent confinées au navigateur ;
 * elles ne sont jamais stockées dans localStorage ni transmises au serveur.
 * Le module Lightning s'appuie désormais sur deux vrais nœuds LDK exécutés
 * dans le navigateur (Web Worker + WebAssembly, cf. rust/lnlab) — plus aucun
 * état simulé ici, et plus aucun processus côté serveur.
 */
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { LabWallet } from './bitcoin/keys';
import { uid } from './bitcoin/utils';
import { DEFAULT_NET, registerNetGetter, type NetId } from './networks';

// Enregistrement tardif : le store fournit le réseau actif à networks.ts
// sans créer de dépendance circulaire à l'évaluation des modules.
registerNetGetter(() => useLabStore.getState().network);

/* ────────────────────────────────  Types  ──────────────────────────────── */

export interface DevLog {
  id: string;
  ts: number;
  kind: 'http' | 'op' | 'error';
  /** Module d'origine de l'entrée (réseau, portefeuille, transactions…). */
  module: string;
  label: string;
  detail: Record<string, unknown>;
}

export interface LabState {
  wallets: LabWallet[];
  activeWalletId: string | null;
  logs: DevLog[];
  /** Réseau Bitcoin actif (mainnet, testnet3, testnet4, signet). */
  network: NetId;
  /** Mineur testnet4 : démarrage automatique à la génération d'une clé. */
  mineOnKeyGen: boolean;
  hydrated: boolean;
  addLog: (l: { kind: DevLog['kind']; module: string; label: string; detail: Record<string, unknown> }) => void;
  clearLogs: () => void;
  setNetwork: (n: NetId) => void;
  setMineOnKeyGen: (v: boolean) => void;
  addWallet: (w: LabWallet) => void;
  removeWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  hydrate: () => Promise<void>;
}

/* ─────────────────────  Persistance IndexedDB (locale)  ───────────────────── */

const IDB_KEY = 'bitlab-lab-state-v1';

interface PersistedLab {
  wallets: LabWallet[];
  activeWalletId: string | null;
  /** Obsolète (ancien état simulé Lightning) — ignoré à l'hydratation. */
  lightning?: unknown;
  network?: NetId;
  mineOnKeyGen?: boolean;
}

function snap(s: Pick<LabState, 'wallets' | 'activeWalletId' | 'network' | 'mineOnKeyGen'>): PersistedLab {
  return { wallets: s.wallets, activeWalletId: s.activeWalletId, network: s.network, mineOnKeyGen: s.mineOnKeyGen };
}

async function persist(s: PersistedLab): Promise<void> {
  try {
    await idbSet(IDB_KEY, s);
  } catch {
    /* stockage indisponible — le lab reste utilisable en mémoire */
  }
}

/* ────────────────────────────────  Store  ──────────────────────────────── */

export const useLabStore = create<LabState>((set, get) => ({
  wallets: [],
  activeWalletId: null,
  logs: [],
  network: DEFAULT_NET,
  mineOnKeyGen: false,
  hydrated: false,

  addLog: ({ kind, module, label, detail }) =>
    set((s) => ({
      logs: [{ id: uid('log'), ts: Date.now(), kind, module, label, detail }, ...s.logs].slice(0, 250),
    })),

  clearLogs: () => set({ logs: [] }),

  setNetwork: (network) => {
    set((s) => {
      void persist(snap(s));
      return { network };
    });
    get().addLog({ kind: 'op', module: 'portefeuille', label: 'réseau changé', detail: { réseau: network } });
  },

  setMineOnKeyGen: (mineOnKeyGen) =>
    set((s) => {
      void persist(snap(s));
      return { mineOnKeyGen };
    }),

  addWallet: (w) => {
    set((s) => {
      const wallets = [w, ...s.wallets];
      const activeWalletId = s.activeWalletId ?? w.id;
      void persist(snap({ ...s, wallets, activeWalletId }));
      return { wallets, activeWalletId };
    });
    get().addLog({ kind: 'op', module: 'portefeuille', label: 'portefeuille ajouté', detail: { adresse: w.address, type: w.type, source: w.source, réseau: w.network } });
  },

  removeWallet: (id) => {
    const removed = get().wallets.find((w) => w.id === id);
    set((s) => {
      const wallets = s.wallets.filter((w) => w.id !== id);
      const activeWalletId = s.activeWalletId === id ? (wallets[0]?.id ?? null) : s.activeWalletId;
      void persist(snap({ ...s, wallets, activeWalletId }));
      return { wallets, activeWalletId };
    });
    if (removed) {
      get().addLog({
        kind: 'op',
        module: 'portefeuille',
        label: 'portefeuille supprimé',
        detail: { adresse: removed.address, type: removed.type, réseau: removed.network },
      });
    }
  },

  setActiveWallet: (id) =>
    set((s) => {
      void persist(snap(s));
      return { activeWalletId: id };
    }),

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const data = await idbGet<PersistedLab>(IDB_KEY);
      set({
        wallets: data?.wallets ?? [],
        activeWalletId: data?.activeWalletId ?? null,
        network: data?.network ?? DEFAULT_NET,
        mineOnKeyGen: data?.mineOnKeyGen ?? false,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));

/** Sélecteur pratique : portefeuille actif, filtré par réseau actif.
 * Un portefeuille dérivé pour un autre réseau n'est jamais retourné —
 * cela garantit qu'aucune opération croisée (testnet ↔ mainnet) n'est possible. */
export function useActiveWallet(): LabWallet | null {
  return useLabStore((s) => {
    const w = s.wallets.find((x) => x.id === s.activeWalletId) ?? null;
    if (!w) return null;
    return (w.network ?? DEFAULT_NET) === s.network ? w : null;
  });
}
