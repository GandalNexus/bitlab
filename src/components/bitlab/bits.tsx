'use client';

/**
 * BitLab — Composants partagés du laboratoire.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { tSync } from '@/lib/i18n';

/** En-tête de page façon Stellar Lab : titre 20px/600 + description grise. */
export function PageIntro({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
        {desc ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Champ copiable — style Stellar Lab : libellé au-dessus, action intégrée à droite du champ. */
export function Copyable({
  value,
  display,
  mono = true,
  className,
  label,
}: {
  value: string;
  display?: string;
  mono?: boolean;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className={cn('min-w-0', className)}>
      {label ? <div className="mb-1.5 text-[13px] font-medium text-muted-foreground">{label}</div> : null}
      <div className="flex items-stretch overflow-hidden rounded-[6px] border border-border bg-input/30">
        <div className="flex-1 overflow-hidden px-3 py-2.5">
          <div className={cn('text-xs truncate', mono && 'font-mono')} title={display ?? value}>
            {display ?? value}
          </div>
        </div>
        <button
          type="button"
          aria-label={tSync('Copier dans le presse-papiers')}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className={cn(
            'flex w-10 shrink-0 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            copied && 'text-emerald-500',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

/** Carte statistique du tableau de bord. */
export function StatCard({
  title,
  value,
  sub,
  icon,
  loading,
  accent,
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={cn('border-border/80', accent && 'border-primary/40')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-muted-foreground">{title}</div>
          {icon ? <div className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-border bg-card text-primary">{icon}</div> : null}
        </div>
        <div className="mt-2.5 text-2xl font-semibold font-mono tabular-nums">
          {loading ? <Skeleton className="h-7 w-24" /> : value}
        </div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Bloc JSON repliable façon console développeur. */
export function JsonBlock({ data, maxH = 'max-h-72' }: { data: unknown; maxH?: string }) {
  return (
      <pre
      className={cn(
        'overflow-auto rounded-[6px] border border-border bg-black/40 p-3 text-[11px] leading-relaxed font-mono text-emerald-200/90 scrollbar-thin',
        maxH,
      )}
    >
      {JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
    </pre>
  );
}

/** Étiquette de type de script/adresse. */
export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    legacy: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    segwit: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    taproot: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    p2sh: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    op_return: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    unknown: 'bg-muted text-muted-foreground border-border',
    wsh: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', colors[type] ?? colors.unknown)}>
      {type}
    </span>
  );
}

/** Bannière d'avertissement sécurité (clés locales). */
export function SecurityNote({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-[6px] border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div>
        {children ?? (
          <>
            <span className="font-medium text-foreground">Sandbox Zero-Knowledge :</span> les clés privées sont générées et
            utilisées exclusivement dans votre navigateur (stockage IndexedDB local). Aucune clé ne quitte jamais cet appareil.
          </>
        )}
      </div>
    </div>
  );
}

/** Formate un horodatage relatif dans la langue active. */
export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return tSync('il y a {n} s', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return tSync('il y a {n} min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tSync('il y a {n} h', { n: h });
  return tSync('il y a {n} j', { n: Math.floor(h / 24) });
}
