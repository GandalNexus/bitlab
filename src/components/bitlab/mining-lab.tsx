'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Hourglass, Info, Pickaxe, Square, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Copyable } from './bits';
import { useLabStore } from '@/lib/store';
import { useBitquestMissionStore } from '@/lib/bitquest-mission-store';
import { miner, type MinerStatus } from '@/lib/mining/miner';
import { COINBASE_MATURITY } from '@/lib/mining/core';
import { DEFAULT_NET, NETWORKS, type NetId } from '@/lib/networks';
import { api } from '@/lib/mempool';
import { regtestChain } from '@/lib/regtest-chain';
import { regtestMode } from '@/lib/regtest';
import { fmtInt } from '@/lib/bitcoin/utils';
import type { LabWallet } from '@/lib/bitcoin/keys';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PHASE_STYLE: Record<MinerStatus['phase'], string> = {
  off: 'border-border bg-muted/40 text-muted-foreground',
  watching: 'border-sky-600/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  mining: 'border-amber-600/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  submitting: 'border-violet-600/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-600 dark:text-red-400',
};

const MINING_BLOCKED: Partial<Record<NetId, string>> = {
  mainnet:
    'Le minage est désactivé sur le Mainnet : votre navigateur ne peut pas rivaliser avec le réseau réel, et tout bloc ici aurait une valeur monétaire.',
  signet:
    'Signet ne peut pas être miné : chaque bloc doit être signé par les signataires du réseau (BIP 325). Utilisez les faucets du module Portefeuille.',
  testnet3:
    'Ce réseau ne peut pas être miné depuis le navigateur (faucets du module Portefeuille, ou nœud signataire requis). Utilisez Testnet4 ou Regtest pour le minage réel.',
};

function fmtHashrate(hs: number): string {
  if (hs >= 1_000_000) return `${(hs / 1_000_000).toFixed(2)} MH/s`;
  if (hs >= 1_000) return `${(hs / 1_000).toFixed(1)} kH/s`;
  return `${Math.round(hs)} H/s`;
}

export function MiningModule() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const setNetwork = useLabStore((s) => s.setNetwork);
  const mineOnKeyGen = useLabStore((s) => s.mineOnKeyGen);
  const setMineOnKeyGen = useLabStore((s) => s.setMineOnKeyGen);
  const wallets = useLabStore((s) => s.wallets);
  const activeWalletId = useLabStore((s) => s.activeWalletId);
  const setActiveWallet = useLabStore((s) => s.setActiveWallet);

  const [status, setStatus] = useState<MinerStatus>(miner.getStatus());
  const [threads, setThreads] = useState(4);
  const [payoutId, setPayoutId] = useState<string | null>(null);

  useEffect(() => miner.subscribe(() => setStatus(miner.getStatus())), []);

  // Expose au banner mission BitQuest (kind=BLOCK) le dernier hash miné.
  // No-op si aucune mission active.
  useEffect(() => {
    const latest = status.blocks[0];
    if (latest?.hash) {
      useBitquestMissionStore.getState().setLastBlockHash(latest.hash);
    }
  }, [status.blocks]);

  const cfg = NETWORKS[net];
  const mineable = cfg.mineable !== 'none';
  const busy =
    status.phase === 'mining' || status.phase === 'submitting' || status.phase === 'watching';

  const netWallets = useMemo(
    () => wallets.filter((w) => (w.network ?? DEFAULT_NET) === net),
    [wallets, net],
  );
  const payout = useMemo(
    () =>
      netWallets.find((w) => w.id === payoutId) ??
      netWallets.find((w) => w.id === activeWalletId) ??
      netWallets[0] ??
      null,
    [netWallets, payoutId, activeWalletId],
  );

  const minableNets = useMemo(
    () => (Object.keys(NETWORKS) as NetId[]).filter((n) => NETWORKS[n].mineable !== 'none'),
    [],
  );
  const blockedNets = useMemo(
    () => (Object.keys(NETWORKS) as NetId[]).filter((n) => NETWORKS[n].mineable === 'none'),
    [],
  );

  const pickNetwork = (next: NetId) => {
    if (next === net) return;
    if (busy) miner.stop();
    setActiveWalletIfPossible(next);
    setNetwork(next);
  };

  const setActiveWalletIfPossible = (target: NetId) => {
    const first = wallets.find((w) => (w.network ?? DEFAULT_NET) === target);
    if (first) setActiveWallet(first.id);
    setPayoutId(null);
  };

  const start = () => {
    if (!payout) return;
    miner.start(payout.address, threads, net);
  };

  const nextWindowLabel = useMemo(() => {
    if (!status.window || status.window.open) return null;
    if (status.window.reason === 'boundary-block') {
      return t('Premier bloc d’une période : difficulté réelle requise — pause du mineur.');
    }
    const s = status.window.secondsUntilOpen;
    if (s > 90) return t('Prochaine fenêtre minable dans ~{m} min', { m: Math.ceil(s / 60) });
    return t('Prochaine fenêtre minable dans ~{s} s', { s });
  }, [status.window, t]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Pickaxe className="text-primary h-4 w-4" />{' '}
            {t('Mineur — PoW réel dans votre navigateur')}
          </CardTitle>
          <CardDescription>
            {t(
              'Choisissez le réseau à miner, le portefeuille qui recevra les récompenses, puis démarrez : le hachage SHA-256d est réel, seule la difficulté est jouable.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-[13px] font-medium">{t('Réseau miné')}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {minableNets.map((n) => {
                const c = NETWORKS[n];
                const active = n === net;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pickNetwork(n)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-md border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40',
                      busy && !active && 'pointer-events-none opacity-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{c.label}</span>
                      {active ? (
                        <Badge variant="outline" className="text-[10px]">
                          {t('actif')}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
                      {c.mineable === 'bip94'
                        ? t(
                            'Testnet4 — fenêtres BIP 94 à difficulté minimale, diffusion P2P aux nœuds publics.',
                          )
                        : t('Regtest — difficulté 1 en continu sur la chaîne embarquée de BitLab.')}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {blockedNets.map((n) => (
                <span
                  key={n}
                  title={t(MINING_BLOCKED[n] ?? '')}
                  className="border-border bg-muted/30 text-muted-foreground flex cursor-help items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                >
                  <AlertTriangle className="h-3 w-3" /> {NETWORKS[n].label}
                </span>
              ))}
            </div>
          </div>

          {mineable ? (
            <>
              <div className="space-y-2">
                <div className="text-[13px] font-medium">{t('Récompense vers')}</div>
                {netWallets.length > 0 ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-64 flex-1 space-y-1">
                      <Select
                        value={payout?.id ?? ''}
                        onValueChange={(v) => {
                          setPayoutId(v);
                          setActiveWallet(v);
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-9 font-mono text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {netWallets.map((w) => (
                            <SelectItem key={w.id} value={w.id} className="font-mono text-xs">
                              {w.label} · {w.address.slice(0, 16)}…
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {payout ? (
                      <Copyable label={t('Adresse récompensée')} value={payout.address} />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t(
                        'Aucun portefeuille {net} : créez-en un dans le module Portefeuille — il recevra la récompense de chaque bloc trouvé.',
                        { net: cfg.label },
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn('gap-1.5', PHASE_STYLE[status.phase])}>
                  <Zap className="h-3 w-3" />
                  {status.phase === 'off' && t('Mineur arrêté')}
                  {status.phase === 'watching' && t('Surveillance de la chaîne')}
                  {status.phase === 'mining' && t('Fenêtre active — minage en cours')}
                  {status.phase === 'submitting' && t('Diffusion du bloc…')}
                  {status.phase === 'error' && t('Erreur')}
                </Badge>
                {status.phase === 'mining' ? (
                  <>
                    <Badge variant="outline">{fmtHashrate(status.hashrate)}</Badge>
                    <Badge variant="outline">{t('{n} threads', { n: status.threads })}</Badge>
                    <Badge variant="outline">{t('moteur {e}', { e: status.engine ?? '?' })}</Badge>
                  </>
                ) : null}
                {status.phase === 'watching' && status.tipAgeSec !== null ? (
                  <Badge variant="outline">
                    {status.tipAgeSec >= 0
                      ? t('âge du tip : {s} s', { s: status.tipAgeSec })
                      : t('tip daté {s} s dans le futur (bots BIP 94)', { s: -status.tipAgeSec })}
                  </Badge>
                ) : null}
              </div>
              {nextWindowLabel && status.phase === 'watching' ? (
                <p className="text-muted-foreground text-xs">{nextWindowLabel}</p>
              ) : null}
              {status.lastError ? (
                <p className="text-xs text-red-600 dark:text-red-400">{status.lastError}</p>
              ) : null}

              <div className="flex flex-wrap items-end gap-3">
                <Button size="sm" disabled={!payout || busy} onClick={start} className="gap-1.5">
                  <Pickaxe className="h-3.5 w-3.5" /> {t('Démarrer le mineur')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!busy}
                  onClick={() => miner.stop()}
                  className="gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" /> {t('Arrêter')}
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs">{t('Threads')}</Label>
                  <Select
                    value={String(threads)}
                    onValueChange={(v) => setThreads(Number(v))}
                    disabled={busy}
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 4, 6, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id="mine-on-keygen"
                    checked={mineOnKeyGen}
                    onCheckedChange={setMineOnKeyGen}
                    disabled={busy}
                  />
                  <Label htmlFor="mine-on-keygen" className="text-xs">
                    {t('Miner automatiquement dès la génération d’une clé')}
                  </Label>
                </div>
              </div>

              {status.blocks.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-muted-foreground text-[13px] font-medium">
                    {t('Blocs trouvés — récompense mûre après {n} confirmations :', {
                      n: COINBASE_MATURITY,
                    })}
                  </div>
                  {status.blocks.map((b) => {
                    const inner = (
                      <>
                        <span className="truncate font-mono">{b.hash}</span>
                        <span className="text-muted-foreground flex shrink-0 items-center gap-2">
                          {b.confirmations < COINBASE_MATURITY ? (
                            <span>
                              {t('{c}/{n} conf.', { c: b.confirmations, n: COINBASE_MATURITY })}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {t('mûr')}
                            </span>
                          )}
                          {cfg.explorer ? (
                            <ExternalLink className="group-hover:text-primary h-3 w-3" />
                          ) : null}
                        </span>
                      </>
                    );
                    const cls =
                      'group flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs transition-colors hover:border-primary/50';
                    return cfg.explorer ? (
                      <a
                        key={b.hash}
                        href={`${cfg.explorer}/block/${b.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cls}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={b.hash} className={cls}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {net === 'regtest' && netWallets.length > 0 ? (
                <MaturationPanel wallets={netWallets} />
              ) : null}

              <div className="border-border bg-muted/30 text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] leading-snug">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {t(
                    'Pédagogie : le mineur construit un bloc vide (coinbase seule) vers votre adresse et balaie les nonces en SHA-256d — exactement le travail des mineurs Bitcoin, en version jouable. Les threads sont bornés pour rester doux avec votre machine.',
                  )}
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">{t(MINING_BLOCKED[net] ?? '')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MaturationPanel({ wallets }: { wallets: LabWallet[] }) {
  const { t } = useT();
  const addLog = useLabStore((s) => s.addLog);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const key = wallets.map((w) => w.id).join(',');
  const matQuery = useQuery({
    queryKey: ['maturation', 'regtest', key],
    queryFn: async () => {
      const tip = await api.tipHeight();
      const rows = (
        await Promise.all(
          wallets.map(async (w) => {
            const utxos = await api.utxos(w.address);
            const entries = utxos
              .filter((u) => u.isCoinbase && u.status.confirmed && u.status.block_height != null)
              .map((u) => ({
                value: u.value,
                wait: COINBASE_MATURITY - (tip + 1 - (u.status.block_height as number)),
              }))
              .filter((e) => e.wait > 0);
            return {
              id: w.id,
              label: w.label,
              sats: entries.reduce((s, e) => s + e.value, 0),
              count: entries.length,
              wait: entries.reduce((m, e) => Math.max(m, e.wait), 0),
            };
          }),
        )
      ).filter((r) => r.count > 0);
      return { tip, rows };
    },
    enabled: wallets.length > 0,
    refetchInterval: 15_000,
    retry: 1,
  });

  const data = matQuery.data;
  if (matQuery.isLoading || matQuery.isError || !data || data.rows.length === 0) return null;
  const total = data.rows.reduce((s, r) => s + r.sats, 0);
  const k = Math.max(...data.rows.map((r) => r.wait));

  const matureNow = async () => {
    setBusy(true);
    try {
      let newTip: { height: number } | undefined;
      if (regtestMode() === 'embedded') {
        const result = await regtestChain.mine(k);
        newTip = result.tip;
      } else {
        const res = await fetch('/api/regtest/mine', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ blocks: k }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          detail?: string;
          tip?: { height: number };
        };
        if (!res.ok || !body.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
        newTip = body.tip;
      }
      addLog({
        kind: 'op',
        module: 'mineur',
        label: 'blocs minés (maturation)',
        detail: { blocs: k, 'nouveau tip': newTip?.height, destination: 'pool faucet' },
      });
      await qc.invalidateQueries({ queryKey: ['maturation'] });
      await qc.invalidateQueries({ queryKey: ['utxos'] });
      await qc.invalidateQueries({ queryKey: ['tip'] });
      await qc.invalidateQueries({ queryKey: ['blocks'] });
    } catch (err) {
      addLog({
        kind: 'error',
        module: 'mineur',
        label: 'maturation : minage refusé',
        detail: { erreur: (err as Error).message.slice(0, 200) },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-amber-600 dark:text-amber-400">
        <Hourglass className="h-3.5 w-3.5" /> {t('Maturation des récompenses')}
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        {t(
          'Une récompense de minage attend {n} blocs avant d’être dépensable (consensus Bitcoin). Les blocs minés ici alimentent le pool du faucet — vos récompenses déjà en chaîne mûrissent avec eux.',
          { n: COINBASE_MATURITY },
        )}
      </p>
      <div className="space-y-1">
        {data.rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-foreground/80 truncate font-mono">{r.label}</span>
            <span className="text-muted-foreground shrink-0 font-mono">
              {fmtInt(r.sats)} sats · {t('mûr dans {k} bloc(s)', { k: r.wait })}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">
          {t('{s} sats en maturation', { s: fmtInt(total) })}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void matureNow()}
          className="shrink gap-1.5 text-left whitespace-normal"
        >
          <Pickaxe className="h-3.5 w-3.5 shrink-0" />
          {busy ? t('minage des blocs…') : t('Miner {k} bloc(s) pour tout débloquer', { k })}
        </Button>
      </div>
    </div>
  );
}
