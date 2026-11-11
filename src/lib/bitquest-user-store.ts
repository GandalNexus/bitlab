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
  /**
   * Session token émis par BitQuest à la consommation du launch_token.
   * JWT HS256 aud=bitlab-session, TTL 2h. Utilisé en Authorization:
   * Bearer pour les appels CORS user-scoped (read-only).
   * `sessionExpiresAt` en ms epoch (nullable si pas encore de session).
   */
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  setUser: (user: BitquestUser | null) => void;
  setLaunchStatus: (status: BitquestUserState["launchStatus"], error?: string | null) => void;
  setSession: (token: string, expiresAt: number) => void;
  clearUser: () => void;
}

export const BITQUEST_USER_STORAGE_KEY = "bitlab.bitquest-user.v1";

const INITIAL = {
  user: null as BitquestUser | null,
  launchStatus: "idle" as const,
  launchError: null as string | null,
  sessionToken: null as string | null,
  sessionExpiresAt: null as number | null,
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
      setSession: (sessionToken, sessionExpiresAt) =>
        set({ sessionToken, sessionExpiresAt }),
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
        sessionToken: state.sessionToken,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
      version: 1,
    },
  ),
);
