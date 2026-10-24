'use client';

/**
 * BitLab — Traduction automatique FR → EN.
 * Approche « clé = phrase française » : t() renvoie la phrase telle quelle en FR,
 * et sa traduction anglaise (dictionnaire i18n-dict) en EN. Une clé absente du
 * dictionnaire retombe gracieusement sur le français — aucune régression possible.
 * Le choix de langue est persisté en localStorage (bitlab-lang) et appliqué à
 * <html lang> pour l'accessibilité. tSync() permet l'usage hors composants.
 */
import { useCallback, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { EN } from './i18n-dict';

export type Lang = 'fr' | 'en';
export type Vars = Record<string, string | number>;

export const LANG_KEY = 'bitlab-lang';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'fr',
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* stockage indisponible */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    set({ lang });
  },
}));

/** Interpolation {variable} dans une phrase. */
function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Traduction pure (utilisable partout). */
export function translate(lang: Lang, fr: string, vars?: Vars): string {
  if (lang === 'fr') return interpolate(fr, vars);
  const en = EN[fr];
  return interpolate(typeof en === 'string' ? en : fr, vars);
}

/** t() réactif pour les composants. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = useCallback((fr: string, vars?: Vars) => translate(lang, fr, vars), [lang]);
  return { t, lang, setLang };
}

/** Version synchrone hors React (libs, erreurs) — lit l'état courant du store. */
export function tSync(fr: string, vars?: Vars): string {
  return translate(useLangStore.getState().lang, fr, vars);
}

/** Code de locale pour les formats nombre/date. */
export function tLocale(): string {
  return useLangStore.getState().lang === 'en' ? 'en-US' : 'fr-FR';
}

/** Provider : synchronise la langue persistée après montage (sans mismatch SSR). */
export function LangProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_KEY);
    } catch {
      stored = null;
    }
    if (stored === 'en' || stored === 'fr') {
      useLangStore.setState({ lang: stored });
      document.documentElement.lang = stored;
    }
  }, []);
  return <>{children}</>;
}
