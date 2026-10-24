'use client';

/**
 * BitLab - spanning announcement banner (top of the content area, above the
 * sticky header). Dismissible: dismissal is persisted in localStorage keyed
 * by the announcement version, so a new announcement re-shows for everyone.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

/** Bump to re-show the banner after the announcement content changes. */
export const ANNOUNCE_VERSION = 'v5-dev-1';
const DISMISS_KEY = 'bitlab-announce-dismissed';

const announceStore = {
  listeners: new Set<() => void>(),
  get(): boolean {
    try {
      return localStorage.getItem(DISMISS_KEY) === ANNOUNCE_VERSION;
    } catch {
      return false;
    }
  },
  dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, ANNOUNCE_VERSION);
    } catch {
      /* storage unavailable */
    }
    announceStore.listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    announceStore.listeners.add(l);
    return () => {
      announceStore.listeners.delete(l);
    };
  },
};

export function AnnouncementBanner() {
  const { t } = useT();
  const dismissed = useSyncExternalStore(announceStore.subscribe, announceStore.get, () => false);
  const dismiss = useCallback(() => announceStore.dismiss(), []);

  if (dismissed) return null;
  return (
    <div role="region" aria-label={t('Annonce')} className="banner-in border-b border-amber-500/25 bg-amber-500/[0.08]">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-2 sm:px-6">
        <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-snug text-amber-800 dark:text-amber-200/90">
          <span className="sm:hidden">{t('BitLab est toujours en développement — des bugs sont possibles.')}</span>
          <span className="hidden sm:inline">{t('BitLab est toujours en développement actif — des bugs sont possibles et le labo évolue régulièrement. Merci de votre patience !')}</span>
        </p>
        <button
          onClick={dismiss}
          aria-label={t('Fermer l’annonce')}
          title={t('Fermer l’annonce')}
          className="shrink-0 rounded-[4px] p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
