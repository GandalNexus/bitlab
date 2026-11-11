'use client';

import { useState } from 'react';
import { ExternalLink, FlaskConical, Loader2, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import {
  buildReturnUrl,
  isValidReturnValue,
  RETURN_FIELD_BY_KIND,
  type BitquestKind,
} from '@/lib/bitquest-bridge';
import {
  selectCurrentProofValue,
  useBitquestMissionStore,
} from '@/lib/bitquest-mission-store';
import { cn } from '@/lib/utils';

/**
 * Délai d'affichage du loader avant redirection vers BitQuest.
 * Court mais suffisant pour que l'apprenant voie "Preuve envoyée…"
 * et comprenne la transition. 400ms est le seuil de perception
 * immédiate/non-immédiate standard UX.
 */
const SUBMIT_FEEDBACK_MS = 400;

/**
 * Bannière affichée en haut de l'app quand une mission BitQuest est
 * active. Elle rappelle le contexte (quête, type de preuve, réseau),
 * et propose un bouton « Terminer et renvoyer la preuve » qui redirige
 * l'apprenant vers BitQuest avec la valeur capturée par le module
 * pertinent (lastTxid pour TX, lastBolt11 pour INVOICE, …).
 *
 * Le bouton est désactivé tant que la preuve n'est pas disponible
 * dans le store ; un hint explicatif est affiché à la place.
 *
 * Phase submitting (I3) : au clic "Terminer", on passe dans un état
 * visuel "retour vers BitQuest" (spinner + message) pendant ~400ms
 * avant la redirection effective. Évite l'effet "flash" où l'URL
 * change sans feedback utilisateur.
 */
export function BitquestMissionBanner() {
  const { t } = useT();
  const mission = useBitquestMissionStore((s) => s.mission);
  const proofValue = useBitquestMissionStore(selectCurrentProofValue);
  const clearMission = useBitquestMissionStore((s) => s.clearMission);
  const [submitting, setSubmitting] = useState(false);

  if (!mission) return null;

  const ready =
    proofValue !== null && proofValue.length > 0 && isValidReturnValue(mission.kind, proofValue);

  const onFinish = () => {
    if (!ready || !proofValue || submitting) return;
    const url = buildReturnUrl(mission, proofValue);
    setSubmitting(true);
    // Court délai pour laisser l'utilisateur voir le feedback
    // "Preuve envoyée, retour vers BitQuest…" avant la navigation.
    // setTimeout est préférable à requestIdleCallback ici : on veut
    // un délai déterministe, pas opportuniste.
    window.setTimeout(() => {
      window.location.href = url;
    }, SUBMIT_FEEDBACK_MS);
  };

  const hintKey = HINT_KEY_BY_KIND[mission.kind];

  return (
    <div
      role="region"
      aria-label={t('Mission BitQuest active')}
      className="border-primary/30 bg-primary/5 border-b"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <span className="font-semibold">
              {mission.title ? (
                <>
                  {t('Mission :')} {mission.title}
                </>
              ) : (
                <>
                  {t('Mission BitQuest :')} <code className="font-mono">{mission.questCode}</code>
                </>
              )}
            </span>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {mission.kind}
            </span>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {mission.network}
            </span>
          </div>
          {mission.instructions && (
            <p className="text-foreground/80 text-xs leading-relaxed sm:max-w-2xl">
              {mission.instructions}
            </p>
          )}
          <p
            className={cn(
              'text-xs',
              submitting ? 'text-primary font-medium' : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {submitting
              ? t('Preuve envoyée, retour vers BitQuest…')
              : ready
                ? t('Preuve prête ({field}). Clique pour revenir à BitQuest.', {
                    field: RETURN_FIELD_BY_KIND[mission.kind],
                  })
                : t(hintKey)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onFinish}
            disabled={!ready || submitting}
            aria-busy={submitting}
            className={cn(
              'inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition',
              ready && !submitting
                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                : submitting
                  ? 'border-primary/50 bg-primary/10 text-primary cursor-wait'
                  : 'border-border text-muted-foreground cursor-not-allowed opacity-60',
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('Retour en cours…')}
              </>
            ) : (
              <>
                {t('Terminer et renvoyer la preuve')}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={clearMission}
            disabled={submitting}
            aria-label={t('Abandonner la mission BitQuest')}
            title={t('Abandonner la mission BitQuest')}
            className="text-muted-foreground hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

const HINT_KEY_BY_KIND: Record<BitquestKind, string> = {
  TX: 'Diffuse une transaction testnet : le txid sera capturé automatiquement.',
  BLOCK: 'Mine un bloc sur ce réseau : le hash sera capturé automatiquement.',
  INVOICE: 'Génère une facture BOLT11 dans Lightning : elle sera capturée automatiquement.',
  CHANNEL: 'Ouvre un canal Lightning : le short channel ID sera capturé automatiquement.',
  ADDRESS: 'Dérive une adresse depuis ton portefeuille : elle sera capturée automatiquement.',
};
