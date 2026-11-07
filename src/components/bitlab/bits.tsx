'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { tSync } from '@/lib/i18n';

<<<<<<< HEAD
export function PageIntro({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
=======
/** En-tête de page façon Stellar Lab : titre 20px/600 + description grise. */
export function PageIntro({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
>>>>>>> 92c54ba (style: prettier-format repo)
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[22px]">{title}</h1>
        {desc ? (
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">{desc}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

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
      {label ? (
        <div className="text-muted-foreground mb-1.5 text-[13px] font-medium">{label}</div>
      ) : null}
      <div className="border-border bg-input/30 flex items-stretch overflow-hidden rounded-[6px] border">
        <div className="flex-1 overflow-hidden px-3 py-2.5">
          <div className={cn('truncate text-xs', mono && 'font-mono')} title={display ?? value}>
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
            'border-border text-muted-foreground hover:bg-accent hover:text-foreground flex w-10 shrink-0 items-center justify-center border-l transition-colors',
            copied && 'text-emerald-500',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

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
          <div className="text-muted-foreground text-[13px] font-medium">{title}</div>
          {icon ? (
            <div className="border-border bg-card text-primary flex h-7 w-7 items-center justify-center rounded-[6px] border">
              {icon}
            </div>
          ) : null}
        </div>
        <div className="mt-2.5 font-mono text-2xl font-semibold tabular-nums">
          {loading ? <Skeleton className="h-7 w-24" /> : value}
        </div>
        {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export function JsonBlock({ data, maxH = 'max-h-72' }: { data: unknown; maxH?: string }) {
  return (
    <pre
      className={cn(
        'border-border scrollbar-thin overflow-auto rounded-[6px] border bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-200/90',
        maxH,
      )}
    >
      {JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)}
    </pre>
  );
}

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
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        colors[type] ?? colors.unknown,
      )}
    >
      {type}
    </span>
  );
}

export function SecurityNote({ children }: { children?: ReactNode }) {
  return (
    <div className="border-primary/25 bg-primary/5 text-muted-foreground flex items-start gap-2 rounded-[6px] border px-3 py-2.5 text-xs leading-relaxed">
      <KeyRound className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        {children ?? (
          <>
            <span className="text-foreground font-medium">Sandbox Zero-Knowledge :</span> les clés
            privées sont générées et utilisées exclusivement dans votre navigateur (stockage
            IndexedDB local). Aucune clé ne quitte jamais cet appareil.
          </>
        )}
      </div>
    </div>
  );
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return tSync('il y a {n} s', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return tSync('il y a {n} min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tSync('il y a {n} h', { n: h });
  return tSync('il y a {n} j', { n: Math.floor(h / 24) });
}
