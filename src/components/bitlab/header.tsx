'use client';

import { useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Blocks,
  Menu,
  ChevronDown,
  Check,
  ShieldAlert,
  User,
  ExternalLink,
  Loader2,
  LogOut,
  LogIn,
  Sparkles,
} from 'lucide-react';
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
import { useBitquestUserStore } from '@/lib/bitquest-user-store';
import { getBitquestUrl } from '@/lib/bitquest-user';
import { useLandingUrl } from '@/lib/use-landing-url';

export function LabHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const net = useLabStore((s) => s.network);
  const setNetwork = useLabStore((s) => s.setNetwork);
  const qc = useQueryClient();
  const { t } = useT();
  const cfg = NETWORKS[net];
  const landingUrl = useLandingUrl();
  const tip = useQuery({
    queryKey: ['tip', net],
    queryFn: api.tipHeight,
    refetchInterval: 30_000,
    retry: 1,
  });

  const pick = (id: NetId) => {
    if (id === net) return;
    setNetwork(id);
    void qc.invalidateQueries();
  };

  return (
    <header className="border-border bg-background/90 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onOpenMobileNav}
          aria-label={t('Ouvrir la navigation')}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-primary/40 flex h-9 w-9 items-center justify-center rounded-[6px] transition-colors focus-visible:ring-2 focus-visible:outline-none lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <BrandMark responsive />

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'border-border bg-card hover:bg-accent/60 flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:ring-primary/40 outline-none focus-visible:ring-2',
              )}
              title={t('Changer de réseau Bitcoin')}
              aria-label={t('Sélecteur de réseau Bitcoin')}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotCls)} />
              <span className="hidden sm:inline">{cfg.label}</span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wider uppercase">
                {t('Réseau Bitcoin')}
              </DropdownMenuLabel>
              {NET_ORDER.map((id) => {
                const c = NETWORKS[id];
                const active = id === net;
                return (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => pick(id)}
                    className={cn(
                      'cursor-pointer gap-2.5 rounded-[4px]',
                      active && 'bg-primary/10',
                    )}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dotCls)} />
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {c.label}
                        {c.realFunds ? (
                          <ShieldAlert
                            className="h-3.5 w-3.5 text-amber-500"
                            aria-label={t('Fonds réels')}
                          />
                        ) : null}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {c.realFunds ? t('Fonds réels — prudence') : t('Sans risque financier')}
                      </span>
                    </span>
                    {active ? <Check className="text-primary h-4 w-4 shrink-0" /> : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <div className="text-muted-foreground px-2 py-1.5 text-[10px] leading-relaxed">
                {t(
                  'Données via les nœuds publics mempool.space — l’explorateur et les liens suivent le réseau choisi.',
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            className="border-border bg-card hidden items-center gap-2 rounded-[6px] border px-2.5 py-1.5 md:flex"
            title={t('Hauteur du dernier bloc {net}', { net: cfg.label })}
          >
            <Blocks className="text-primary h-3.5 w-3.5" />
            <span className="font-mono text-xs tabular-nums">
              {tip.isError
                ? '—'
                : tip.isLoading
                  ? '…'
                  : t('bloc {n}', { n: fmtInt(tip.data ?? 0) })}
            </span>
            {!tip.isError && !tip.isLoading ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            ) : null}
          </div>

          <GandalNexusUserBadge />

          {/* Retour à la landing publique GandalNexus (hub). Pour les
              utilisateurs arrivés depuis gandalnexus.com qui veulent
              revenir au hub, séparé du login BitQuest ci-dessus. */}
          <a
            href={landingUrl}
            rel="noopener"
            title={t('Retour à GandalNexus')}
            aria-label={t('Retour à GandalNexus')}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-primary/40 inline-flex h-9 items-center gap-1.5 rounded-[6px] px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Sparkles className="text-primary h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Nexus</span>
          </a>

          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Construit l'URL SSO top-level BitQuest → BitLab.
 * BitQuest lit son cookie HttpOnly (SameSite=Lax), émet un launch_token,
 * et redirige vers BitLab avec `?launch_token=XXX`. Le hook
 * `useBitquestMission` consomme ensuite ce token côté client.
 *
 * ⚠️ Pattern SSR-safe via `useSyncExternalStore` : évite le mismatch
 * d'hydration en servant une valeur stable "/" côté serveur ET au
 * premier render client, puis bascule vers l'origine complète. On
 * n'utilise pas `useState + useEffect` (anti-pattern React moderne,
 * lint `react-hooks/set-state-in-effect`).
 */
const EMPTY_SUBSCRIBE = () => () => {};

function getClientReturnTo(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function useSsoUrl(bitquestUrl: string): string {
  const returnTo = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    getClientReturnTo,
    () => '/', // SSR snapshot — match le premier render client (avant hydration)
  );
  const params = new URLSearchParams({ returnTo });
  return `${bitquestUrl}/api/auth/bitlab-sso?${params.toString()}`;
}

/**
 * Badge d'identité GandalNexus (LOT 3 + LOT 6 + LOT 9).
 *
 * Trois états visuels (toujours visibles, y compris en mobile) :
 *   - connecté → dropdown @pseudo avec actions « Ouvrir BitQuest »
 *     et « Déconnexion locale » (clear du store BitLab uniquement ;
 *     la session BitQuest reste intacte).
 *   - identification en cours → chip avec Loader2.
 *   - non connecté → bouton « Se connecter » qui déclenche un SSO
 *     top-level vers BitQuest (cookie Lax envoyé, redirect avec
 *     launch_token consommé au retour).
 *
 * En < sm, le label texte est tronqué à l'icône pour économiser l'espace.
 */
function GandalNexusUserBadge() {
  const { t } = useT();
  const user = useBitquestUserStore((s) => s.user);
  const launchStatus = useBitquestUserStore((s) => s.launchStatus);
  const clearUser = useBitquestUserStore((s) => s.clearUser);
  const bitquestUrl = getBitquestUrl();
  const ssoUrl = useSsoUrl(bitquestUrl);

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:ring-primary/40 outline-none focus-visible:ring-2',
          )}
          title={t('Identité GandalNexus')}
          aria-label={t('Menu utilisateur GandalNexus')}
        >
          <User className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden max-w-[10ch] truncate sm:inline">@{user.pseudo}</span>
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-muted-foreground text-[11px] tracking-wider uppercase">
            @{user.pseudo} · {user.role}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href={`${bitquestUrl}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t('Ouvrir BitQuest')}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => clearUser()}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('Déconnexion locale')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const returnTo = `${window.location.origin}${window.location.pathname}`;
              const target = `${bitquestUrl}/api/auth/bitlab-logout?returnTo=${encodeURIComponent(returnTo)}`;
              window.location.assign(target);
            }}
            className="text-destructive focus:text-destructive flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('Déconnexion globale')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (launchStatus === 'pending') {
    return (
      <span
        className="border-border bg-card text-muted-foreground flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-sm font-medium"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span className="hidden sm:inline">{t('identification…')}</span>
      </span>
    );
  }

  // Navigation top-level (pas target=_blank) : cookie bq_session SameSite=Lax
  // envoyé, BitQuest nous redirige automatiquement avec un launch_token.
  return (
    <a
      href={ssoUrl}
      title={t('Se connecter avec BitQuest')}
      className={cn(
        'border-border bg-card hover:bg-accent/60 flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:ring-primary/40 outline-none focus-visible:ring-2',
      )}
    >
      <LogIn className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{t('Se connecter')}</span>
    </a>
  );
}
