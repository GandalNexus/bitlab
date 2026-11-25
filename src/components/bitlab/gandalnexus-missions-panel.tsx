'use client';

/**
 * Panneau "Mes missions GandalNexus" — espace dédié dans BitLab au suivi
 * des tentatives de l'apprenant (actives + historique récent).
 *
 * Nécessite un sessionToken valide (émis au verify-launch-token). Si
 * l'utilisateur n'est pas identifié, le panneau invite à se connecter via
 * BitQuest. Fetch cross-origin via /api/bitlab/me/attempts.
 *
 * Refresh toutes les 60s en background (couvre les transitions
 * server-side COMPLETED/FAILED sans forcer l'user à refresh).
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  Target,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBitquestUserStore } from '@/lib/bitquest-user-store';
import { fetchMyAttempts, getBitquestUrl, type GandalNexusAttempt } from '@/lib/bitquest-user';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { appendThemeToUrl, useThemeStore } from '@/lib/theme';

const STATE_META: Record<string, { label: string; icon: typeof Play; classes: string }> = {
  CREATED: {
    label: 'Lancée',
    icon: Play,
    classes: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  IN_PROGRESS: {
    label: 'En cours',
    icon: Play,
    classes: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  PROOF_PENDING: {
    label: 'Preuve en attente',
    icon: Clock,
    classes: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  VERIFYING: {
    label: 'Vérification',
    icon: Clock,
    classes: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  COMPLETED: {
    label: 'Terminée',
    icon: CheckCircle2,
    classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  FAILED: {
    label: 'Échouée',
    icon: XCircle,
    classes: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
  EXPIRED: {
    label: 'Expirée',
    icon: AlertCircle,
    classes: 'border-muted-foreground/30 text-muted-foreground',
  },
  ABANDONED: {
    label: 'Abandonnée',
    icon: AlertCircle,
    classes: 'border-muted-foreground/30 text-muted-foreground',
  },
};

function AttemptStateBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? STATE_META.ABANDONED;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        meta.classes,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function GandalNexusMissionsPanel() {
  const { t } = useT();
  const sessionToken = useBitquestUserStore((s) => s.sessionToken);
  const sessionExpiresAt = useBitquestUserStore((s) => s.sessionExpiresAt);
  const user = useBitquestUserStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const bitquestUrl = appendThemeToUrl(getBitquestUrl(), theme);

  // Considère le token expiré 30s avant son exp réel (clock skew tolérant).
  // `now` dans un state local pour que ESLint react-hooks/purity accepte
  // (Date.now() direct serait flagué comme impur dans le render).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
  }, []);
  const sessionAlive =
    sessionToken !== null && sessionExpiresAt !== null && sessionExpiresAt > now + 30_000;

  const attempts = useQuery({
    queryKey: ['gandalnexus-attempts', sessionToken?.slice(-16) ?? 'none'],
    queryFn: () =>
      sessionToken
        ? fetchMyAttempts({ sessionToken, state: 'all', limit: 20 })
        : Promise.resolve([]),
    enabled: sessionAlive,
    refetchInterval: 60_000,
    staleTime: 15_000,
    retry: 1,
  });

  // Pas de session → inviter à se connecter.
  if (!sessionAlive) {
    return (
      <section aria-label={t('Mes missions GandalNexus')}>
        <Card className="border-border/80 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="text-primary h-4 w-4" aria-hidden />
              {t('Mes missions GandalNexus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t(
                'Connecte-toi à BitQuest pour retrouver tes missions, ton historique et tes récompenses.',
              )}
            </p>
            <Button asChild variant="outline" className="gap-1.5">
              <a href={bitquestUrl} target="_blank" rel="noopener noreferrer">
                {t('Ouvrir BitQuest')}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const list: GandalNexusAttempt[] = attempts.data ?? [];
  const active = list.filter((a) =>
    ['CREATED', 'IN_PROGRESS', 'PROOF_PENDING', 'VERIFYING'].includes(a.state),
  );
  const recent = list
    .filter((a) => !['CREATED', 'IN_PROGRESS', 'PROOF_PENDING', 'VERIFYING'].includes(a.state))
    .slice(0, 5);

  return (
    <section aria-label={t('Mes missions GandalNexus')}>
      <Card className="border-border/80 rounded-xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="text-primary h-4 w-4" aria-hidden />
              {t('Mes missions GandalNexus')}
              {user && (
                <span className="text-muted-foreground text-xs font-normal">· @{user.pseudo}</span>
              )}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('Historique de tes tentatives et accès rapide à BitQuest pour reprendre.')}
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground shrink-0 gap-1"
          >
            <a href={bitquestUrl} target="_blank" rel="noopener noreferrer">
              {t('BitQuest')}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {attempts.isLoading && (
            <p className="text-muted-foreground text-sm">{t('Chargement…')}</p>
          )}
          {attempts.isError && (
            <p className="text-destructive text-sm">
              {t('Impossible de charger les missions — réessaie plus tard.')}
            </p>
          )}
          {!attempts.isLoading && !attempts.isError && list.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {t('Aucune mission lancée pour le moment. Démarre une quête depuis BitQuest.')}
            </p>
          )}

          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                {t('En cours')}
              </p>
              <ul className="space-y-2">
                {active.map((a) => (
                  <li
                    key={a.id}
                    className="border-border/80 bg-muted/20 flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.questTitle}</span>
                        <AttemptStateBadge state={a.state} />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {a.kind} · {a.network} · {t('lancée')} {relativeTime(a.launchedAt)}
                      </p>
                    </div>
                    {a.returnTo && (
                      <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
                        <a href={a.returnTo} target="_blank" rel="noopener noreferrer">
                          {t('Reprendre')}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recent.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                {t('Récentes')}
              </p>
              <ul className="space-y-1.5">
                {recent.map((a) => (
                  <li
                    key={a.id}
                    className="border-border/70 flex flex-col gap-0.5 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.questTitle}</span>
                        <AttemptStateBadge state={a.state} />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {a.kind} · {a.network} ·{' '}
                        {relativeTime(a.completedAt ?? a.failedAt ?? a.launchedAt)}
                        {a.result &&
                          typeof (a.result as { xpEarned?: number }).xpEarned === 'number' && (
                            <>
                              {' · '}+{(a.result as { xpEarned: number }).xpEarned} XP
                            </>
                          )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
