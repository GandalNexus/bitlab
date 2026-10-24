'use client';

/**
 * BitLab — Contrôles globaux de l'en-tête : bascule de langue (FR ⇄ EN)
 * et bascule jour/nuit. Partagés entre le laboratoire et la page /guide.
 */
import { Moon, Sun } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useThemeStore, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Bouton pilule FR | EN — bascule de langue instantanée. */
export function LangToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div
      className="flex items-center rounded-[6px] border border-border bg-card p-0.5"
      role="group"
      aria-label={t('Traduire l’interface (FR → EN)')}
      title={t('Traduire l’interface (FR → EN)')}
    >
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            'rounded-[4px] px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors',
            lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Bouton soleil/lune — mode jour ↔ mode nuit. */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { t } = useT();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={t('Basculer entre mode jour et mode nuit')}
      title={t('Basculer entre mode jour et mode nuit')}
      className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
