'use client';

import { useEffect } from 'react';
import { useBitquestUserStore } from './bitquest-user-store';
import { getBitquestUrl } from './bitquest-user';
import { useLabStore } from './store';

/**
 * Hook d'amorçage SSO silent — vérifie passivement si l'utilisateur a
 * déjà une session BitQuest au chargement de BitLab, pour lui éviter
 * de cliquer sur « Se connecter ».
 *
 * Flow :
 *   1. Au mount, si pas de user en mémoire ET pas de tentative récente
 *      ET pas de param SSO déjà présent dans l'URL → top-level navigate
 *      vers `${BQ}/api/auth/bitlab-sso?returnTo=<current>&silent=1`.
 *   2. BitQuest lit son cookie `bq_session` (SameSite=Lax → envoyé lors
 *      d'une navigation top-level).
 *      - Authentifié : redirect vers BitLab avec `?launch_token=XXX`.
 *        `useBitquestMission` l'échange contre un profil.
 *      - Pas authentifié : redirect vers BitLab avec `?sso_silent=none`,
 *        qu'on efface aussitôt et qu'on mémorise pour ne pas boucler.
 *   3. Flag `bq_silent_tried` en localStorage avec TTL 10 min pour
 *      éviter de rebondir à chaque reload. L'utilisateur peut toujours
 *      forcer via le bouton « Se connecter ».
 *
 * Trade-off : il y a un flash de redirection à la première visite.
 * On priorise la justesse (cookie SameSite=Lax exige top-level nav)
 * sur l'esthétique. Alternatives (iframe + postMessage) sont possibles
 * mais ajoutent une surface d'attaque XFO/CSP non justifiée pour l'instant.
 */

const SILENT_TRIED_KEY = 'bq_silent_sso_tried_at';
const SILENT_TRIED_TTL_MS = 10 * 60 * 1000; // 10 minutes

function alreadyTriedRecently(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SILENT_TRIED_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < SILENT_TRIED_TTL_MS;
  } catch {
    return true; // storage bloqué → on considère qu'on a tenté, zéro boucle
  }
}

function markTried(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SILENT_TRIED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * À appeler en haut de l'arbre client BitLab (ex. `app/page.tsx`).
 * Laisse `useBitquestMission` gérer le launch_token au retour.
 */
export function useSilentSso(): void {
  const existingUser = useBitquestUserStore((s) => s.user);
  const launchStatus = useBitquestUserStore((s) => s.launchStatus);
  const addLog = useLabStore((s) => s.addLog);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    // Si l'URL contient déjà un launch_token ou un sso_silent=none, on
    // laisse `useBitquestMission` gérer. On nettoie juste `sso_silent`
    // pour ne pas le laisser traîner dans l'historique.
    if (url.searchParams.has('sso_silent')) {
      markTried();
      url.searchParams.delete('sso_silent');
      const cleaned = url.pathname + (url.search || '') + url.hash;
      window.history.replaceState(null, '', cleaned);
      addLog({
        kind: 'op',
        module: 'bitquest',
        label: 'SSO silent : aucune session BitQuest détectée',
        detail: {},
      });
      return;
    }
    // Launch token déjà présent : on considère le SSO réussi au niveau
    // navigation (on a reçu un token de BQ). Marque la tentative pour
    // empêcher une re-demande dans le même onglet — même si l'échange
    // client échoue (ex. rate-limit 429 sur verify-launch-token), on
    // n'accumule pas de nouveaux tokens côté BQ.
    if (url.searchParams.has('launch_token')) {
      markTried();
      return;
    }

    // Si l'utilisateur est déjà authentifié ou si l'exchange est en cours
    // OU a déjà échoué, on ne redéclenche pas le SSO. `'error'` est
    // inclus pour éviter une boucle quand le client bourre BQ avec des
    // launch_token après un verify-launch-token refusé.
    if (
      existingUser ||
      launchStatus === 'pending' ||
      launchStatus === 'success' ||
      launchStatus === 'error'
    ) {
      return;
    }

    if (alreadyTriedRecently()) return;

    const returnTo = window.location.href;
    const ssoUrl = new URL('/api/auth/bitlab-sso', getBitquestUrl());
    ssoUrl.searchParams.set('returnTo', returnTo);
    ssoUrl.searchParams.set('silent', '1');

    markTried();
    addLog({
      kind: 'op',
      module: 'bitquest',
      label: 'SSO silent : vérification session BitQuest…',
      detail: { bq: getBitquestUrl() },
    });
    window.location.replace(ssoUrl.toString());
  }, [existingUser, launchStatus, addLog]);
}

/**
 * Réinitialise le marqueur silent SSO — à appeler au logout explicite
 * (le user veut se reconnecter via le bouton après avoir été logout
 * côté BitQuest sans qu'on puisse le détecter autrement).
 */
export function resetSilentSsoTried(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SILENT_TRIED_KEY);
  } catch {
    // ignore
  }
}
