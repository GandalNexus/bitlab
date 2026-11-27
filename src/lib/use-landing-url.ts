'use client';

import { useEffect, useState } from 'react';
import { getBitquestUrl } from './bitquest-user';

const FALLBACK = 'https://gandalnexus.com';
const CACHE_KEY = 'bl-landing-url-v1';
const TTL_MS = 10 * 60 * 1000;

interface CachedEntry {
  url: string;
  at: number;
}

/**
 * Hook client qui résout l'URL de la landing publique (bouton « Nexus »
 * en header BitLab). Admin-configurable via `LandingConfig.landingUrl`
 * côté BitQuest.
 *
 * Résolution :
 *   1. `sessionStorage` cache (< 10 min)
 *   2. fetch depuis `${getBitquestUrl()}/api/public/landing-config`
 *      (CORS ouvert *, aucun cookie envoyé)
 *   3. fallback `FALLBACK` constant
 *
 * Même pattern que le hook équivalent côté BitQuest — même TTL, même
 * clé de stockage à un préfixe près, même fallback sûr.
 */
export function useLandingUrl(): string {
  const [url, setUrl] = useState<string>(FALLBACK);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as CachedEntry;
        if (
          cached &&
          typeof cached.url === 'string' &&
          typeof cached.at === 'number' &&
          Date.now() - cached.at < TTL_MS
        ) {
          if (cached.url !== url) setUrl(cached.url);
          return;
        }
      }
    } catch {
      // storage inaccessible (private mode) → fetch quand même
    }

    const bitquest = getBitquestUrl();
    const endpoint = `${bitquest}/api/public/landing-config`;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 4000);
    fetch(endpoint, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: { landingUrl?: unknown } | null) => {
        if (!cfg) return;
        const next = typeof cfg.landingUrl === 'string' ? cfg.landingUrl : null;
        if (!next || !isHttpUrl(next)) return;
        setUrl(next);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ url: next, at: Date.now() } satisfies CachedEntry),
          );
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Silence : garder le fallback
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      ac.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return url;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
