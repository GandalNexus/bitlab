'use client';

import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

export type Theme = 'dark' | 'light';

export const THEME_KEY = 'bitlab-theme';

/**
 * Lit `?theme=dark|light` dans l'URL courante — propagé par BitQuest lors
 * d'une navigation cross-origin.
 */
function readThemeFromQuery(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URLSearchParams(window.location.search).get('theme');
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

/** Retire `?theme=` de l'URL affichée après application. */
function stripThemeFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('theme')) return;
    url.searchParams.delete('theme');
    const qs = url.searchParams.toString();
    const newUrl = url.pathname + (qs ? `?${qs}` : '') + url.hash;
    window.history.replaceState(window.history.state, '', newUrl);
  } catch {
    // ignore
  }
}

/**
 * Ajoute `?theme=<current>` à une URL cross-origin. Utilisé sur chaque lien
 * sortant vers BitQuest pour conserver le mode sombre/clair côté cible.
 *
 * ⚠️ `new URL(absolute)` est appelé sans base pour produire une sortie
 * identique SSR/client (évite un mismatch d'hydratation : `new URL` normalise
 * `http://host:3000` en `http://host:3000/`, le fallback string ne le fait pas).
 */
export function appendThemeToUrl(url: string, theme: Theme): string {
  try {
    const u = new URL(url);
    u.searchParams.set('theme', theme);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}theme=${theme}`;
  }
}

function applyFavicon(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  link.href = theme === 'dark' ? '/icon-dark.svg' : '/icon-light.svg';
}

export function applyThemeClass(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  applyFavicon(theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    applyThemeClass(theme);
    set({ theme });
  },
}));

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 1. Priorité au hint URL (?theme=…) venu de BitQuest.
    const hint = readThemeFromQuery();
    if (hint) {
      try {
        localStorage.setItem(THEME_KEY, hint);
      } catch {}
      applyThemeClass(hint);
      useThemeStore.setState({ theme: hint });
      stripThemeFromUrl();
      return;
    }
    // 2. Sinon, préférence persistée.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      stored = null;
    }
    const theme: Theme = stored === 'light' ? 'light' : 'dark';
    applyThemeClass(theme);
    useThemeStore.setState({ theme });
  }, []);
  return <>{children}</>;
}

/**
 * Script anti-FOUC injecté en premier dans le <body> (cf. layout.tsx).
 *
 * Priorité :
 *   1. `?theme=` dans l'URL (prend le dessus pour cohérence cross-origin).
 *   2. localStorage `bitlab-theme`.
 *   3. default dark (HTML classé `dark` déjà).
 */
export const THEME_BOOT_SCRIPT =
  "(function(){try{var q=null;try{q=new URLSearchParams(window.location.search).get('theme');}catch(e){}var t=(q==='dark'||q==='light')?q:localStorage.getItem('bitlab-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}else if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();";
