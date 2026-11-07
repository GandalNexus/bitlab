'use client';

import { Moon, Sun } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useThemeStore, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function LangToggle() {
  const { lang, setLang, t } = useT();
  return (
    <div
      className="border-border bg-card flex items-center rounded-[6px] border p-0.5"
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
            'rounded-[4px] px-1.5 py-1 text-[11px] font-semibold tracking-wide uppercase transition-colors',
            lang === l
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

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
      className="border-border bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground flex h-9 w-9 items-center justify-center rounded-[6px] border transition-colors"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
