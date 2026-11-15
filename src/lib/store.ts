import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { LabWallet } from './bitcoin/keys';
import {
  isLocked,
  lockWallet as lockWalletFn,
  unlockWallet as unlockWalletFn,
  type AnyWallet,
  type LockedWallet,
} from './bitcoin/wallet-lock';
import { uid } from './bitcoin/utils';
import { DEFAULT_NET, registerNetGetter, type NetId } from './networks';

registerNetGetter(() => useLabStore.getState().network);

export interface DevLog {
  id: string;
  ts: number;
  kind: 'http' | 'op' | 'error';
  module: string;
  label: string;
  detail: Record<string, unknown>;
}

export interface LabState {
  /**
   * Union : wallet plaintext (LabWallet) ou verrouillé (LockedWallet).
   * Persisté tel quel dans IndexedDB. Les consumers doivent utiliser
   * `isLocked()` pour savoir s'il faut prompter la passphrase.
   */
  wallets: AnyWallet[];
  activeWalletId: string | null;
  logs: DevLog[];
  network: NetId;
  mineOnKeyGen: boolean;
  hydrated: boolean;
  /**
   * Session cache in-memory des wallets unlockés. Jamais persisté.
   * Clé = walletId, valeur = plaintext + expiresAt (epoch ms).
   * TTL par défaut 30 min, étendu à chaque unlock successful.
   */
  unlockedSessions: Record<string, { wallet: LabWallet; expiresAt: number }>;
  addLog: (l: {
    kind: DevLog['kind'];
    module: string;
    label: string;
    detail: Record<string, unknown>;
  }) => void;
  clearLogs: () => void;
  setNetwork: (n: NetId) => void;
  setMineOnKeyGen: (v: boolean) => void;
  addWallet: (w: LabWallet) => void;
  removeWallet: (id: string) => void;
  setActiveWallet: (id: string) => void;
  lockWallet: (id: string, passphrase: string) => Promise<void>;
  unlockWallet: (id: string, passphrase: string) => Promise<LabWallet>;
  clearUnlockedSession: (id: string) => void;
  hydrate: () => Promise<void>;
}

const IDB_KEY = 'bitlab-lab-state-v1';

interface PersistedLab {
  wallets: AnyWallet[];
  activeWalletId: string | null;
  lightning?: unknown;
  network?: NetId;
  mineOnKeyGen?: boolean;
}

/** TTL session unlock : 30 minutes. */
const UNLOCK_TTL_MS = 30 * 60 * 1000;

function snap(
  s: Pick<LabState, 'wallets' | 'activeWalletId' | 'network' | 'mineOnKeyGen'>,
): PersistedLab {
  return {
    wallets: s.wallets,
    activeWalletId: s.activeWalletId,
    network: s.network,
    mineOnKeyGen: s.mineOnKeyGen,
  };
}

async function persist(s: PersistedLab): Promise<void> {
  try {
    await idbSet(IDB_KEY, s);
  } catch {}
}

export const useLabStore = create<LabState>((set, get) => ({
  wallets: [],
  activeWalletId: null,
  logs: [],
  network: DEFAULT_NET,
  mineOnKeyGen: false,
  hydrated: false,
  unlockedSessions: {},

  addLog: ({ kind, module, label, detail }) =>
    set((s) => ({
      logs: [{ id: uid('log'), ts: Date.now(), kind, module, label, detail }, ...s.logs].slice(
        0,
        250,
      ),
    })),

  clearLogs: () => set({ logs: [] }),

  setNetwork: (network) => {
    set((s) => {
      void persist(snap(s));
      return { network };
    });
    get().addLog({
      kind: 'op',
      module: 'portefeuille',
      label: 'réseau changé',
      detail: { réseau: network },
    });
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
    get().addLog({
      kind: 'op',
      module: 'portefeuille',
      label: 'portefeuille ajouté',
      detail: { adresse: w.address, type: w.type, source: w.source, réseau: w.network },
    });
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

  lockWallet: async (id, passphrase) => {
    const found = get().wallets.find((w) => w.id === id);
    if (!found) throw new Error('Wallet introuvable.');
    if (isLocked(found)) throw new Error('Wallet déjà verrouillé.');
    const locked = await lockWalletFn(found, passphrase);
    set((s) => {
      const wallets = s.wallets.map((w) => (w.id === id ? locked : w));
      // Oublie la session unlock éventuelle
      const sessions = { ...s.unlockedSessions };
      delete sessions[id];
      void persist(snap({ ...s, wallets }));
      return { wallets, unlockedSessions: sessions };
    });
    get().addLog({
      kind: 'op',
      module: 'portefeuille',
      label: 'portefeuille verrouillé',
      detail: { adresse: locked.address, type: locked.type },
    });
  },

  unlockWallet: async (id, passphrase) => {
    const found = get().wallets.find((w) => w.id === id);
    if (!found) throw new Error('Wallet introuvable.');
    if (!isLocked(found)) {
      // Déjà en clair, retour direct
      return found;
    }
    const plaintext = await unlockWalletFn(found as LockedWallet, passphrase);
    set((s) => ({
      unlockedSessions: {
        ...s.unlockedSessions,
        [id]: { wallet: plaintext, expiresAt: Date.now() + UNLOCK_TTL_MS },
      },
    }));
    get().addLog({
      kind: 'op',
      module: 'portefeuille',
      label: 'portefeuille déverrouillé (30 min)',
      detail: { adresse: plaintext.address, type: plaintext.type },
    });
    return plaintext;
  },

  clearUnlockedSession: (id) =>
    set((s) => {
      if (!(id in s.unlockedSessions)) return s;
      const sessions = { ...s.unlockedSessions };
      delete sessions[id];
      return { unlockedSessions: sessions };
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

/**
 * Wallet actif, jamais locked côté caller :
 *   - Si plaintext, retourne LabWallet directement.
 *   - Si locked + session unlock valide (non expirée), retourne la
 *     plaintext cachée.
 *   - Si locked + pas de session → retourne null (le caller doit
 *     prompter l'unlock).
 */
export function useActiveWallet(): LabWallet | null {
  return useLabStore((s) => {
    const w = s.wallets.find((x) => x.id === s.activeWalletId) ?? null;
    if (!w) return null;
    const matchesNetwork = (w.network ?? DEFAULT_NET) === s.network;
    if (!matchesNetwork) return null;
    if (!isLocked(w)) return w;
    // Locked : vérifie la session
    const session = s.unlockedSessions[w.id];
    if (session && session.expiresAt > Date.now()) return session.wallet;
    return null;
  });
}

/**
 * Infos minimales du wallet actif pour affichage même quand locked.
 * Retourne { address, publicKeyHex, label, type, locked, hasUnlockedSession }.
 */
export function useActiveWalletMeta(): {
  id: string;
  address: string;
  publicKeyHex: string;
  label: string;
  type: AnyWallet['type'];
  locked: boolean;
  hasUnlockedSession: boolean;
} | null {
  return useLabStore((s) => {
    const w = s.wallets.find((x) => x.id === s.activeWalletId) ?? null;
    if (!w) return null;
    const matchesNetwork = (w.network ?? DEFAULT_NET) === s.network;
    if (!matchesNetwork) return null;
    const locked = isLocked(w);
    const session = locked ? s.unlockedSessions[w.id] : null;
    return {
      id: w.id,
      address: w.address,
      publicKeyHex: w.publicKeyHex,
      label: w.label,
      type: w.type,
      locked,
      hasUnlockedSession:
        session !== null && session !== undefined && session.expiresAt > Date.now(),
    };
  });
}
