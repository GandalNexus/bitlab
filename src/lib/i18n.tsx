'use client';

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
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    set({ lang });
  },
}));

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang: Lang, fr: string, vars?: Vars): string {
  if (lang === 'fr') return interpolate(fr, vars);
  const en = EN[fr];
  return interpolate(typeof en === 'string' ? en : fr, vars);
}

export function useT() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = useCallback((fr: string, vars?: Vars) => translate(lang, fr, vars), [lang]);
  return { t, lang, setLang };
}

export function tSync(fr: string, vars?: Vars): string {
  return translate(useLangStore.getState().lang, fr, vars);
}

export function tLocale(): string {
  return useLangStore.getState().lang === 'en' ? 'en-US' : 'fr-FR';
}

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
