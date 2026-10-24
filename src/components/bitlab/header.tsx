'use client';

/**
 * Stellar-Lab-style top bar: brand on the left,
 * network selector + live status + language (FR/EN) + theme (dark/light) on the right.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Blocks, Menu, ChevronDown, Check, ShieldAlert } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandMark } from '@/components/bitlab/sidebar';
import { LangToggle, ThemeToggle } from '@/components/bitlab/controls';
import { api } from '@/lib/mempool';
import { useLabStore } from '@/lib/store';
import { NETWORKS, NET_ORDER, type NetId } from '@/lib/networks';
import { useT } from '@/lib/i18n';
import { fmtInt } from '@/lib/bitcoin/utils';
import { cn } from '@/lib/utils';

export function LabHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const net = useLabStore((s) => s.network);
  const setNetwork = useLabStore((s) => s.setNetwork);
  const qc = useQueryClient();
  const { t } = useT();
  const cfg = NETWORKS[net];
  const tip = useQuery({ queryKey: ['tip', net], queryFn: api.tipHeight, refetchInterval: 30_000, retry: 1 });

  const pick = (id: NetId) => {
    if (id === net) return;
    setNetwork(id);
    // Every query includes the network in its key — invalidate to force refresh.
    void qc.invalidateQueries();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onOpenMobileNav}
          aria-label={t('Ouvrir la navigation')}
          className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand shown only where the sidebar is a drawer (below lg) — the
            desktop sidebar already carries the brand block. */}
        <div className="lg:hidden">
          <BrandMark />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Network selector — functional take on Stellar Lab's "● Testnet" */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex items-center gap-2 rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent/60',
                'outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              )}
              title={t('Changer de réseau Bitcoin')}
              aria-label={t('Sélecteur de réseau Bitcoin')}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotCls)} />
              <span className="hidden sm:inline">{cfg.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t('Réseau Bitcoin')}
              </DropdownMenuLabel>
              {NET_ORDER.map((id) => {
                const c = NETWORKS[id];
                const active = id === net;
                return (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => pick(id)}
                    className={cn('cursor-pointer gap-2.5 rounded-[4px]', active && 'bg-primary/10')}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dotCls)} />
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {c.label}
                        {c.realFunds ? <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-label={t('Fonds réels')} /> : null}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {c.realFunds ? t('Fonds réels — prudence') : t('Sans risque financier')}
                      </span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                {t('Données via les nœuds publics mempool.space — l’explorateur et les liens suivent le réseau choisi.')}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hauteur du dernier bloc */}
          <div
            className="hidden items-center gap-2 rounded-[6px] border border-border bg-card px-2.5 py-1.5 md:flex"
            title={t('Hauteur du dernier bloc {net}', { net: cfg.label })}
          >
            <Blocks className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs tabular-nums">
              {tip.isError ? '—' : tip.isLoading ? '…' : t('bloc {n}', { n: fmtInt(tip.data ?? 0) })}
            </span>
            {!tip.isError && !tip.isLoading ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
          </div>

          {/* Language + theme */}
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
