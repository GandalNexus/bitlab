'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { parseBitquestMission, kindToTab, type BitlabTab } from './bitquest-bridge';
import { useBitquestMissionStore } from './bitquest-mission-store';
import { useBitquestUserStore } from './bitquest-user-store';
import { verifyLaunchTokenAgainstBitquest } from './bitquest-user';
import { useLabStore } from './store';

/**
 * Format strict d'un launch_token présent dans l'URL (sans mission attachée).
 * Utilisé pour reconnaître un retour de SSO top-level
 * (`/api/auth/bitlab-sso` côté BitQuest).
 */
function pickLaunchTokenOnly(params: URLSearchParams): string | null {
  const raw = params.get('launch_token')?.trim() ?? '';
  if (raw.length < 32 || raw.length > 4096) return null;
  if (raw.split('.').length !== 3) return null;
  return raw;
}

/**
 * Hook d'amorçage d'une mission BitQuest à partir des query params
 * de l'URL courante.
 *
 * Au mount :
 *   1. parseBitquestMission(searchParams) → mission complète
 *   2. Si pas de mission mais `launch_token` présent → retour SSO
 *      top-level (bouton « Se connecter » du header). On échange juste
 *      le token et on peuple le store utilisateur.
 *   3. Dans les deux cas : nettoie l'URL via router.replace(pathname).
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
  const setUser = useBitquestUserStore((s) => s.setUser);
  const setLaunchStatus = useBitquestUserStore((s) => s.setLaunchStatus);
  const setSession = useBitquestUserStore((s) => s.setSession);
  const launchStatus = useBitquestUserStore((s) => s.launchStatus);
  const existingUser = useBitquestUserStore((s) => s.user);
  const setNetwork = useLabStore((s) => s.setNetwork);
  const addLog = useLabStore((s) => s.addLog);

  // Parse unique au mount pour éviter de rejouer en boucle quand le
  // store change — useMemo sur searchParams suffit car il est stable
  // tant que l'URL ne change pas.
  const parsed = useMemo(
    () => (searchParams ? parseBitquestMission(searchParams) : null),
    [searchParams],
  );
  const ssoOnlyToken = useMemo(
    () => (searchParams && !parsed ? pickLaunchTokenOnly(searchParams) : null),
    [searchParams, parsed],
  );
  // Retour de `/api/auth/bitlab-logout` (déconnexion globale GandalNexus).
  // La page BitQuest nous renvoie avec `?logged_out=1` — on nettoie le
  // store local puis on gomme le param de l'URL.
  const loggedOut = useMemo(
    () => searchParams?.get('logged_out') === '1',
    [searchParams],
  );
  const clearUser = useBitquestUserStore((s) => s.clearUser);

  // Side-effect : échange du launch_token contre le profil utilisateur.
  // Factorisé pour être appelé depuis les deux branches (mission complète
  // ou SSO seul).
  const exchangeLaunchToken = useCallback(
    (token: string) => {
      setLaunchStatus('pending');
      void verifyLaunchTokenAgainstBitquest(token)
        .then((res) => {
          setUser(res.user);
          setSession(res.session.token, new Date(res.session.expiresAt).getTime());
          setLaunchStatus('success');
          addLog({
            kind: 'op',
            module: 'bitquest',
            label: 'identité GandalNexus récupérée',
            detail: {
              pseudo: res.user.pseudo,
              role: res.user.role,
              session_ttl_s: res.session.ttlSeconds,
            },
          });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'échec inconnu';
          setLaunchStatus('error', msg);
          addLog({
            kind: 'error',
            module: 'bitquest',
            label: 'échec échange launch token',
            detail: { raison: msg },
          });
        });
    },
    [addLog, setLaunchStatus, setSession, setUser],
  );

  // Branche principale : mission complète reçue via deep-link signé.
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
        avec_attempt: parsed.attemptId !== null,
        avec_identité: parsed.launchToken !== null,
      },
    });

    // SSO léger (LOT 2) : si on a reçu un launch_token, on l'échange
    // contre le profil utilisateur côté BitQuest (verify-launch-token).
    // Zéro retry : single-use, TTL 60s, replay bloqué côté serveur.
    if (parsed.launchToken && launchStatus !== 'pending') {
      exchangeLaunchToken(parsed.launchToken);
    }

    // Nettoie l'URL (les params restent dans le store Zustand, ils ne
    // doivent plus apparaître dans l'historique de navigation).
    router.replace(pathname);
  }, [
    parsed,
    currentMission,
    setMission,
    setNetwork,
    onTab,
    addLog,
    router,
    pathname,
    exchangeLaunchToken,
    launchStatus,
  ]);

  // Branche logout : l'utilisateur revient de /api/auth/bitlab-logout
  // avec `?logged_out=1`. On vide le store local (déjà vidé côté
  // BitQuest : cookie session + user.token roté) et on nettoie l'URL.
  useEffect(() => {
    if (!loggedOut) return;
    clearUser();
    addLog({
      kind: 'op',
      module: 'bitquest',
      label: 'déconnexion globale GandalNexus',
      detail: {},
    });
    router.replace(pathname);
  }, [loggedOut, clearUser, addLog, router, pathname]);

  // Branche SSO seul : l'utilisateur revient du bouton « Se connecter »
  // du header (navigation top-level vers /api/auth/bitlab-sso). L'URL
  // contient uniquement `?launch_token=XXX`, sans questCode ni kind.
  useEffect(() => {
    if (!ssoOnlyToken) return;
    // Si on a déjà un user et une session active, on ignore le token.
    // Cela peut arriver si le store persiste et que l'utilisateur
    // refresh pendant la fenêtre TTL.
    if (existingUser && launchStatus === 'success') {
      router.replace(pathname);
      return;
    }
    if (launchStatus === 'pending') return;
    exchangeLaunchToken(ssoOnlyToken);
    router.replace(pathname);
  }, [
    ssoOnlyToken,
    existingUser,
    launchStatus,
    exchangeLaunchToken,
    router,
    pathname,
  ]);
}
