'use client';


import { useCallback, useSyncExternalStore } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

export const ANNOUNCE_VERSION = 'v5-miner-1';
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

export function AnnouncementBanner({ onPrimary }: { onPrimary?: () => void }) {
  const { t } = useT();
  const dismissed = useSyncExternalStore(announceStore.subscribe, announceStore.get, () => false);
  const dismiss = useCallback(() => announceStore.dismiss(), []);

  if (dismissed) return null;
  return (
    <div className="border-b border-amber-500/25 bg-amber-500/[0.08]">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-2 sm:px-6">
        <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-snug text-amber-800 dark:text-amber-200/90">
          <span className="sm:hidden">{t('Nouveau : le Mineur applique le PoW réel (Testnet4 + Regtest) dans votre navigateur.')}</span>
          <span className="hidden sm:inline">{t('Nouveau dans le labo : le module Mineur applique le PoW réel — SHA-256d sur Testnet4 (fenêtres BIP 94) et Regtest, récompenses vers votre portefeuille.')}</span>
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