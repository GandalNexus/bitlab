/**
 * Store Zustand dédié à l'état d'une mission BitQuest en cours.
 *
 * Isolé du `useLabStore` principal pour éviter d'alourdir le state
 * persisté en IDB — la mission est éphémère (durée d'une visite), pas
 * besoin de la restaurer entre sessions. Si l'apprenant recharge la
 * page sans les query params, on repart propre.
 *
 * Les champs `lastTxid`, `lastBolt11`, `lastBlockHash` sont alimentés
 * par les modules concernés (tx-builder, lightning, mineur) après
 * chaque action réussie, et le banner les utilise pour construire
 * l'URL de retour vers BitQuest.
 */

import { create } from 'zustand';
import type { BitquestMission } from './bitquest-bridge';

interface BitquestMissionState {
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

export const useBitquestMissionStore = create<BitquestMissionState>((set) => ({
  mission: null,
  lastTxid: null,
  lastBolt11: null,
  lastBlockHash: null,
  lastScid: null,
  lastAddress: null,
  setMission: (mission) => set({ mission }),
  clearMission: () => set({ mission: null }),
  setLastTxid: (lastTxid) => set({ lastTxid }),
  setLastBolt11: (lastBolt11) => set({ lastBolt11 }),
  setLastBlockHash: (lastBlockHash) => set({ lastBlockHash }),
  setLastScid: (lastScid) => set({ lastScid }),
  setLastAddress: (lastAddress) => set({ lastAddress }),
}));

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
