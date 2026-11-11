/**
 * Store Zustand dédié à l'état d'une mission BitQuest en cours.
 *
 * Persistance : `sessionStorage` via le middleware `persist`. Scope =
 * onglet courant. Survit au refresh et à la navigation interne mais
 * disparaît à la fermeture de l'onglet. Matche la sémantique "mission
 * éphémère" voulue à l'origine, tout en réparant la perte d'état au
 * reload qui cassait l'expérience quand `useBitquestMission` nettoie
 * l'URL via `router.replace(pathname)` après le parse initial.
 *
 * SSR-safe : `createJSONStorage` retourne `undefined` en SSR (pas de
 * `window`), le middleware tombe alors sur un noop. Les composants
 * clients re-hydratent au mount.
 *
 * Les champs `lastTxid`, `lastBolt11`, `lastBlockHash`, `lastScid`,
 * `lastAddress` sont alimentés par les modules concernés (tx-builder,
 * lightning, mineur, portefeuille) après chaque action réussie, et le
 * banner les utilise pour construire l'URL de retour vers BitQuest.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BitquestMission } from './bitquest-bridge';

export interface BitquestMissionState {
  mission: BitquestMission | null;
  lastTxid: string | null;
  lastBolt11: string | null;
  lastBlockHash: string | null;
  lastScid: string | null;
  lastAddress: string | null;
  setMission: (mission: BitquestMission | null) => void;
  clearMission: () => void;
  setLastTxid: (txid: string) => void;
  setLastBolt11: (bolt11: string) => void;
  setLastBlockHash: (hash: string) => void;
  setLastScid: (scid: string) => void;
  setLastAddress: (address: string) => void;
}

const INITIAL_STATE = {
  mission: null,
  lastTxid: null,
  lastBolt11: null,
  lastBlockHash: null,
  lastScid: null,
  lastAddress: null,
} as const;

export const BITQUEST_MISSION_STORAGE_KEY = 'bitlab.bitquest-mission.v1';

export const useBitquestMissionStore = create<BitquestMissionState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setMission: (mission) => set({ mission }),
      clearMission: () => set({ ...INITIAL_STATE }),
      setLastTxid: (lastTxid) => set({ lastTxid }),
      setLastBolt11: (lastBolt11) => set({ lastBolt11 }),
      setLastBlockHash: (lastBlockHash) => set({ lastBlockHash }),
      setLastScid: (lastScid) => set({ lastScid }),
      setLastAddress: (lastAddress) => set({ lastAddress }),
    }),
    {
      name: BITQUEST_MISSION_STORAGE_KEY,
      // sessionStorage : scope onglet, survit refresh, pas de persistence inter-sessions.
      // `createJSONStorage` retourne undefined si sessionStorage n'existe pas (SSR, tests node).
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
          ? window.sessionStorage
          : noopStorage,
      ),
      // Ne persiste que les données, pas les setters (sélection explicite).
      partialize: (state) => ({
        mission: state.mission,
        lastTxid: state.lastTxid,
        lastBolt11: state.lastBolt11,
        lastBlockHash: state.lastBlockHash,
        lastScid: state.lastScid,
        lastAddress: state.lastAddress,
      }),
      version: 1,
    },
  ),
);

/**
 * Sélecteur utile : récupère la valeur courante attendue par la mission
 * active (ex. lastTxid si kind=TX). Retourne null si aucune mission
 * active ou aucune valeur enregistrée.
 */
export function selectCurrentProofValue(state: BitquestMissionState): string | null {
  const m = state.mission;
  if (!m) return null;
  switch (m.kind) {
    case 'TX':
      return state.lastTxid;
    case 'BLOCK':
      return state.lastBlockHash;
    case 'INVOICE':
      return state.lastBolt11;
    case 'CHANNEL':
      return state.lastScid;
    case 'ADDRESS':
      return state.lastAddress;
  }
}

/**
 * Storage noop utilisé quand aucun `sessionStorage` n'est disponible
 * (SSR, environnement node sans jsdom). Satisfait l'interface `Storage`
 * complète attendue par `createJSONStorage`.
 */
const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
