'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { parseBitquestMission, kindToTab, type BitlabTab } from './bitquest-bridge';
import { useBitquestMissionStore } from './bitquest-mission-store';
import { useLabStore } from './store';

/**
 * Hook d'amorçage d'une mission BitQuest à partir des query params
 * de l'URL courante.
 *
 * Au mount :
 *   1. parseBitquestMission(searchParams)
 *   2. Si valide : stocke dans Zustand, bascule le network + appelle
 *      onTab(kindToTab(kind)) pour re-router vers le bon module
 *   3. Nettoie l'URL via router.replace(pathname) — les params ne
 *      doivent pas rester visibles (évite rejeu à chaque back/forward)
 *
 * Le composant appelant (src/app/page.tsx) passe `onTab` pour piloter
 * son state `tab` local. Pas de prop-drilling plus bas.
 */
export function useBitquestMission(onTab: (tab: BitlabTab) => void): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setMission = useBitquestMissionStore((s) => s.setMission);
  const currentMission = useBitquestMissionStore((s) => s.mission);
  const setNetwork = useLabStore((s) => s.setNetwork);
  const addLog = useLabStore((s) => s.addLog);

  // Parse unique au mount pour éviter de rejouer en boucle quand le
  // store change — useMemo sur searchParams suffit car il est stable
  // tant que l'URL ne change pas.
  const parsed = useMemo(
    () => (searchParams ? parseBitquestMission(searchParams) : null),
    [searchParams],
  );

  useEffect(() => {
    if (!parsed) return;
    // Évite de rejouer si la mission est déjà installée
    if (
      currentMission &&
      currentMission.questCode === parsed.questCode &&
      currentMission.kind === parsed.kind
    ) {
      return;
    }
    setMission(parsed);
    setNetwork(parsed.network);
    onTab(kindToTab(parsed.kind));
    addLog({
      kind: 'op',
      module: 'bitquest',
      label: 'mission reçue de BitQuest',
      detail: {
        quête: parsed.questCode,
        kind: parsed.kind,
        réseau: parsed.network,
        signée: parsed.sig !== null,
      },
    });
    // Nettoie l'URL (les params restent dans le store Zustand, ils ne
    // doivent plus apparaître dans l'historique de navigation).
    router.replace(pathname);
  }, [parsed, currentMission, setMission, setNetwork, onTab, addLog, router, pathname]);
}
