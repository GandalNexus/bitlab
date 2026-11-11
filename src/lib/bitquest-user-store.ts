/**
 * Store zustand du profil utilisateur BitQuest reçu via launch token.
 *
 * Même pattern que `bitquest-mission-store.ts` : persist sessionStorage,
 * SSR-safe (noopStorage fallback). Scope onglet, survit au refresh.
 *
 * Le profil est consommé par la bannière mission (pour afficher
 * `@pseudo`) et peut l'être par n'importe quel autre composant qui veut
 * personnaliser l'expérience pour l'apprenant identifié.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BitquestUser } from "./bitquest-user";

export interface BitquestUserState {
  user: BitquestUser | null;
  /**
   * Statut de l'échange launch token : indique si on a essayé de le
   * consommer (pour éviter de retenter en boucle au refresh).
   */
  launchStatus: "idle" | "pending" | "success" | "error";
  launchError: string | null;
  setUser: (user: BitquestUser | null) => void;
  setLaunchStatus: (status: BitquestUserState["launchStatus"], error?: string | null) => void;
  clearUser: () => void;
}

export const BITQUEST_USER_STORAGE_KEY = "bitlab.bitquest-user.v1";

const INITIAL = {
  user: null as BitquestUser | null,
  launchStatus: "idle" as const,
  launchError: null as string | null,
};

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

export const useBitquestUserStore = create<BitquestUserState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setUser: (user) => set({ user }),
      setLaunchStatus: (launchStatus, error = null) =>
        set({ launchStatus, launchError: error }),
      clearUser: () => set({ ...INITIAL }),
    }),
    {
      name: BITQUEST_USER_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
          ? window.sessionStorage
          : noopStorage,
      ),
      partialize: (state) => ({
        user: state.user,
        launchStatus: state.launchStatus,
        launchError: state.launchError,
      }),
      version: 1,
    },
  ),
);
