'use client';

/**
 * BitLab - Activity log (readable view of the store logs).
 * A single card holds every entry (network calls, wallet operations,
 * transactions), filterable by module. Each line shows: time - kind
 * (http/op/error) - module - label - key=value details. Nothing sensitive
 * appears here: private keys stay in the browser and never reach this log.
 */
import { useMemo, useState } from 'react';
import { ArrowUpRight, CircleDot, Eraser, ScrollText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLabStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Module filters: logical id + displayed label. */
const MODULES: { id: string; label: string }[] = [
  { id: '*', label: 'Tout' },
  { id: 'réseau', label: 'Réseau' },
  { id: 'portefeuille', label: 'Portefeuille' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'mineur', label: 'Mineur' },
];

const KIND_STYLE: Record<string, { icon: typeof ArrowUpRight; cls: string }> = {
  http: { icon: ArrowUpRight, cls: 'text-sky-600 dark:text-sky-400' },
  op: { icon: CircleDot, cls: 'text-violet-600 dark:text-violet-400' },
  error: { icon: XCircle, cls: 'text-red-600 dark:text-red-400' },
};

function timeOf(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ActivityLog() {
  const { t } = useT();
  const logs = useLabStore((s) => s.logs);
  const clearLogs = useLabStore((s) => s.clearLogs);
  const [filter, setFilter] = useState('*');

  const shown = useMemo(
    () => (filter === '*' ? logs : logs.filter((l) => l.module === filter)),
    [logs, filter],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4 text-primary" /> {t('Journal d’activité')}
            </CardTitle>
            <CardDescription>
              {t('Opérations du laboratoire : réseau, portefeuilles, transactions, minage. Aucun secret n’y figure — les clés restent dans votre navigateur.')}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground"
            disabled={logs.length === 0}
            onClick={clearLogs}
          >
            <Eraser className="h-3.5 w-3.5" /> {t('Effacer')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setFilter(m.id)}
              aria-pressed={filter === m.id}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                filter === m.id
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {t(m.label)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t('Aucune entrée pour ce module pour le moment.')}</p>
        ) : (
          <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
            {shown.map((l) => {
              const kind = KIND_STYLE[l.kind] ?? KIND_STYLE.op;
              const Icon = kind.icon;
              const detail = Object.entries(l.detail).filter(([, v]) => v !== undefined && v !== '');
              return (
                <div
                  key={l.id}
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] leading-4 text-muted-foreground/80">
                    {timeOf(l.ts)}
                  </span>
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', kind.cls)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                        {l.module}
                      </Badge>
                      <span className="min-w-0 break-all text-xs font-medium">{l.label}</span>
                    </div>
                    {detail.length > 0 ? (
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                        {detail.slice(0, 12).map(([k, v]) => (
                          <span key={k} className="max-w-full min-w-0 truncate sm:max-w-80" title={`${k} = ${String(v)}`}>
                            {k}=<span className="text-foreground/70">{String(v)}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
