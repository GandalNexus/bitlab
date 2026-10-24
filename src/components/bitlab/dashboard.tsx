'use client';

/**
 * BitLab — Dashboard central (5. UI/UX du cahier des charges).
 * Vue d'ensemble de l'état du réseau : frais actuels, dernier bloc,
 * état du lab et parcours pédagogique Générer → Construire → Signer → Diffuser.
 */
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Blocks,
  Coins,
  Flame,
  Gauge,
  Hammer,
  KeyRound,
  PenTool,
  Send,
  Wallet as WalletIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard, timeAgo } from './bits';
import { ActivityLog } from './activity-log';
import { useLabStore } from '@/lib/store';
import { api } from '@/lib/mempool';
import { NETWORKS } from '@/lib/networks';
import { fmtInt } from '@/lib/bitcoin/utils';
import { useT } from '@/lib/i18n';

const WORKFLOW = [
  { label: 'Générer', desc: 'Créez des clés et adresses Legacy, SegWit ou Taproot depuis le module Portefeuille.', icon: KeyRound, tab: 'portefeuille' },
  { label: 'Construire', desc: 'Sélectionnez vos UTXO, définissez sorties et frais en sat/vB dans le Constructeur.', icon: Hammer, tab: 'transactions' },
  { label: 'Signer', desc: 'Signature locale ECDSA/Schnorr — la clé privée ne quitte jamais le navigateur.', icon: PenTool, tab: 'transactions' },
  { label: 'Diffuser', desc: 'Publiez la transaction signée sur le Testnet et suivez-la dans l’explorateur.', icon: Send, tab: 'explorateur' },
] as const;

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const fees = useQuery({ queryKey: ['fees', net], queryFn: api.fees, refetchInterval: 30_000, retry: 1 });
  const blocks = useQuery({ queryKey: ['blocks', net], queryFn: api.recentBlocks, refetchInterval: 60_000, retry: 1 });
  const mempool = useQuery({ queryKey: ['mempool', net], queryFn: api.mempool, refetchInterval: 15_000, retry: 1 });
  const wallets = useLabStore((s) => s.wallets);

  const tip = blocks.data?.[0];

  return (
    <div className="space-y-8">
      {/* Hero centré — collé au header (-mt-6 annule le py-6 de <main>) */}
      <section className="lab-glow -mx-4 -mt-6 border-b border-border/60 px-4 pb-10 pt-8 text-center sm:-mx-6 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="lab-display text-3xl leading-tight sm:text-[40px] sm:leading-[48px]">
            {t('Créez. Signez. Diffusez.')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {t('Créez des clés, envoyez des transactions, minez des blocs — pas à pas, Bitcoin n’aura plus de secret pour vous. Commencez par')}{' '}
            <button onClick={() => onNavigate('portefeuille')} className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary">
              {t('créer un portefeuille,')}
            </button>{' '}
            {t('puis')}{' '}
            <button onClick={() => onNavigate('transactions')} className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary">
              {t('signez votre première transaction')}
            </button>{' '}
            {t('ou')}{' '}
            <button onClick={() => onNavigate('lightning')} className="text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary">
              {t('démarrez un nœud Lightning')}
            </button>{' '}
            {t('sur {net}.', { net: cfg.label })}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Button onClick={() => onNavigate('portefeuille')} className="gap-1.5">
              <WalletIcon className="h-4 w-4" /> {wallets.length === 0 ? t('Créer mon premier portefeuille') : t('Gérer mes portefeuilles')}
            </Button>
            <Button variant="outline" onClick={() => onNavigate('transactions')} className="gap-1.5">
              {t('Construire une transaction')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* État du réseau */}
      <section aria-label={t('État du réseau {net}', { net: cfg.label })}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t('Dernier bloc')}
            value={tip ? `#${fmtInt(tip.height)}` : '—'}
            sub={tip ? t('{n} tx · miné {ago}', { n: tip.tx_count, ago: timeAgo(tip.timestamp * 1000) }) : cfg.label}
            icon={<Blocks className="h-4 w-4" />}
            loading={blocks.isLoading}
          />
          <StatCard
            title={t('Frais — prioritaire')}
            value={fees.data ? <span>{fees.data.fastestFee}<span className="ml-1 text-xs text-muted-foreground">sat/vB</span></span> : '—'}
            sub={fees.data ? t('éco : {eco} · lent : {slow}', { eco: fees.data.economyFee, slow: fees.data.minimumFee }) : t('estimation temps réel')}
            icon={<Flame className="h-4 w-4" />}
            loading={fees.isLoading}
          />
          <StatCard
            title="Mempool"
            value={mempool.data ? fmtInt(mempool.data.count) : '—'}
            sub={mempool.data ? t('transactions en attente de confirmation') : t('file d’attente du réseau')}
            icon={<Gauge className="h-4 w-4" />}
            loading={mempool.isLoading}
          />
          <StatCard
            title={t('Votre labo')}
            value={wallets.length}
            sub={t('portefeuille(s) — clés locales')}
            icon={<Coins className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Workflow pédagogique — cartes fonctionnalités façon Stellar Lab */}
      <section aria-label={t('Workflow pédagogique')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW.map((w, i) => {
            const Icon = w.icon;
            return (
              <button
                key={w.label}
                onClick={() => onNavigate(w.tab)}
                className="group rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {t(w.label)}
                  <span className="font-mono text-[10px] font-normal text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t(w.desc)}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Journal d'activité — logs lisibles par module */}
      <section aria-label={t('Journal d’activité')}>
        <ActivityLog />
      </section>
    </div>
  );
}
