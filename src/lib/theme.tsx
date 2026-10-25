'use client';

/**
 * BitLab — Mode jour / mode nuit.
 * Le thème est persisté en localStorage (bitlab-theme) et appliqué via la
 * classe `dark` sur <html>. Un script inline dans layout.tsx retire la classe
 * avant le premier paint si l'utilisateur a choisi le mode jour (zéro flash).
 * Par défaut : mode nuit (identité visuelle BitLab historique).
 */
import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

export type Theme = 'dark' | 'light';

export const THEME_KEY = 'bitlab-theme';

/** Favicon assorti au thème — l'anneau de l'orbite suit la luminosité. */
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
    } catch {
      /* stockage indisponible */
    }
    applyThemeClass(theme);
    set({ theme });
  },
}));

/** Synchronise l'état React avec le thème réellement appliqué (après montage). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
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

/** Script anti-flash : à injecter au tout début du <body>. */
export const THEME_BOOT_SCRIPT =
  "(function(){try{if(localStorage.getItem('bitlab-theme')==='light'){document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}}catch(e){}})();";
