'use client';

/**
 * Carte "Mission GandalNexus en cours" (LOT 3).
 *
 * Mise en avant sur le dashboard BitLab : quand une mission BitQuest
 * est active, l'apprenant doit voir immédiatement de quoi il s'agit,
 * où il en est, et comment la terminer. Évite le flou "pourquoi je suis
 * là, déjà ?" après un refresh ou un retour sur l'onglet.
 *
 * Affichage :
 *   - Badge d'intégration ("via GandalNexus") + nom de la quête
 *   - Objectif (kind BitLab) + réseau + temps écoulé depuis le lancement
 *   - Preuve capturée (si une valeur est déjà prête dans le store)
 *   - CTA direct vers le module qui va produire la preuve (via onNavigate)
 *   - État SSO (utilisateur identifié ou pas)
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, FlaskConical, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RETURN_FIELD_BY_KIND, type BitquestKind } from '@/lib/bitquest-bridge';
import { selectCurrentProofValue, useBitquestMissionStore } from '@/lib/bitquest-mission-store';
import { useBitquestUserStore } from '@/lib/bitquest-user-store';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Mapping kind → onglet BitLab à ouvrir pour produire la preuve. */
const KIND_TO_TAB: Record<BitquestKind, string> = {
  TX: 'transactions',
  BLOCK: 'mineur',
  INVOICE: 'lightning',
  CHANNEL: 'lightning',
  ADDRESS: 'portefeuille',
};

/** Hint pédagogique par kind — reprend celui de la bannière pour cohérence. */
const HINT_BY_KIND: Record<BitquestKind, string> = {
  TX: 'Construis et diffuse une transaction Bitcoin. Le txid sera capturé automatiquement.',
  BLOCK: 'Mine un bloc sur le réseau sélectionné. Le hash sera capturé automatiquement.',
  INVOICE: 'Génère une facture Lightning BOLT11 depuis ton nœud. Elle sera capturée.',
  CHANNEL: 'Ouvre un canal Lightning avec un pair. Le short channel ID sera capturé.',
  ADDRESS: 'Dérive une nouvelle adresse depuis ton portefeuille. Elle sera capturée.',
};

function formatElapsed(fromIso: number | null): string {
  if (fromIso === null) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - fromIso) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} h` : `${hours} h ${rem}`;
}

export function GandalNexusMissionCard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t } = useT();
  const mission = useBitquestMissionStore((s) => s.mission);
  const proofValue = useBitquestMissionStore(selectCurrentProofValue);
  const user = useBitquestUserStore((s) => s.user);
  const launchStatus = useBitquestUserStore((s) => s.launchStatus);

  // Temps écoulé mis à jour toutes les 30s (pas la peine de tourner à 1 Hz).
  const [launchedAtMs] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState('0s');
  useEffect(() => {
    if (!mission) return;
    const update = () => setElapsed(formatElapsed(launchedAtMs));
    update();
    const iv = window.setInterval(update, 30_000);
    return () => window.clearInterval(iv);
  }, [mission, launchedAtMs]);

  if (!mission) return null;

  const captured = proofValue !== null && proofValue.length > 0;
  const targetTab = KIND_TO_TAB[mission.kind];

  return (
    <section aria-label={t('Mission GandalNexus en cours')}>
      <Card className="border-primary/30 from-primary/5 via-card to-card overflow-hidden rounded-xl bg-gradient-to-br">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  <FlaskConical className="h-3 w-3" aria-hidden />
                  {t('via GandalNexus')}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase">
                  {mission.kind}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase">
                  {mission.network}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
                  <Clock className="h-3 w-3" aria-hidden />
                  {elapsed}
                </span>
                {user && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
                    <User className="h-3 w-3" aria-hidden />@{user.pseudo}
                  </span>
                )}
                {!user && launchStatus === 'pending' && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {t('identification…')}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                {mission.title ?? <span className="font-mono text-base">{mission.questCode}</span>}
              </h2>
              {mission.instructions && (
                <p className="text-foreground/80 max-w-2xl text-sm leading-relaxed">
                  {mission.instructions}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant={captured ? 'secondary' : 'default'}
              onClick={() => onNavigate(targetTab)}
              className="shrink-0 gap-1.5"
            >
              {captured ? t('Vérifier la preuve') : t('Produire la preuve')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border-primary/15 bg-background/60 flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t('Prochaine étape')}
              </p>
              <p className="text-sm">{t(HINT_BY_KIND[mission.kind])}</p>
            </div>
            <div
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                captured
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              {captured ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {t('{field} capturé — prêt pour le retour.', {
                    field: RETURN_FIELD_BY_KIND[mission.kind],
                  })}
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {t('{field} en attente', { field: RETURN_FIELD_BY_KIND[mission.kind] })}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
