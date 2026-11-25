'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleDot,
  Coins,
  Droplets,
  Hammer,
  Info,
  ListOrdered,
  Wallet as WalletIcon,
} from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useLabStore } from '@/lib/store';
import { api } from '@/lib/mempool';
import { regtestChain } from '@/lib/regtest-chain';
import { regtestMode } from '@/lib/regtest';
import { fmtInt } from '@/lib/bitcoin/utils';
import { satsToBtc } from '@/lib/bitcoin/utils';
import type { AnyWallet } from '@/lib/bitcoin/wallet-lock';
import { useT } from '@/lib/i18n';

const FAUCET_AMOUNTS = [100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000];

export function FaucetModule({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);

  if (net !== 'regtest') {
    return (
      <div className="space-y-4">
        <PageHeader />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="text-primary h-4 w-4" /> {t('Pas de faucet intégré sur ce réseau')}
            </CardTitle>
            <CardDescription>
              {t(
                'Le faucet intégré sert la chaîne regtest embarquée dans BitLab. Sur testnet4, les sats viennent d’un faucet public externe.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs leading-relaxed">
            <p>
              {t(
                'Basculez sur Regtest dans le sélecteur de réseau pour disposer de sats de test instantanés, ou alimentez vos adresses testnet depuis un service externe.',
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <RegtestFaucet onNavigate={onNavigate} />;
}

function PageHeader() {
  const { t } = useT();
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        <Droplets className="text-primary mr-2 inline h-6 w-6" aria-hidden />
        {t('Faucet')}
      </h1>
      <p className="text-muted-foreground text-sm">
        {t('Distribuez des sats de test sur chacun de vos portefeuilles, en trois clics.')}
      </p>
    </div>
  );
}

function RegtestFaucet({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const wallets = useLabStore((s) => s.wallets);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(FAUCET_AMOUNTS[0]));
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [busyMine, setBusyMine] = useState(false);

  const mine = useQuery({
    queryKey: ['regtest-info'],
    queryFn: async () => {
      if (regtestMode() === 'embedded') return regtestChain.info();
      const res = await fetch('/api/regtest/info', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as { ok: boolean; height: number };
    },
    refetchInterval: 10_000,
  });

  const regtestWallets = wallets.filter((w) => (w.network ?? 'regtest') === net);

  const invalidateWallet = (address: string) => {
    void queryClient.invalidateQueries({ queryKey: ['address', net, address] });
    void queryClient.invalidateQueries({ queryKey: ['regtest-info'] });
  };

  const runFaucet = async (wallet: AnyWallet) => {
    setBusyAddress(wallet.address);
    try {
      let blockHeight: number | undefined;
      if (regtestMode() === 'embedded') {
        const result = await regtestChain.faucet(wallet.address, Number(amount));
        blockHeight = result.blockHeight;
      } else {
        const res = await fetch('/api/regtest/faucet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: wallet.address, sats: Number(amount) }),
        });
        const body = (await res.json()) as { ok?: boolean; detail?: string; blockHeight?: number };
        if (!res.ok || !body.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
        blockHeight = body.blockHeight;
      }
      toast({
        title: t('Sats reçus sur {label}', { label: wallet.label }),
        description: t(
          '{sats} sats confirmés au bloc #{h} — le solde du portefeuille est dépensable immédiatement.',
          { sats: fmtInt(Number(amount)), h: blockHeight ?? '?' },
        ),
      });
      invalidateWallet(wallet.address);
    } catch (err) {
      toast({
        title: t('Échec du faucet'),
        description: (err as Error).message.slice(0, 160),
        variant: 'destructive',
      });
    } finally {
      setBusyAddress(null);
    }
  };

  const runMine = async () => {
    setBusyMine(true);
    try {
      let tip: { height: number } | undefined;
      if (regtestMode() === 'embedded') {
        const result = await regtestChain.mine(10, regtestWallets[0]?.address);
        tip = result.tip;
      } else {
        const res = await fetch('/api/regtest/mine', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ blocks: 10, address: regtestWallets[0]?.address }),
        });
        const body = (await res.json()) as { ok?: boolean; tip?: { height: number } };
        if (!res.ok || !body.ok) throw new Error(`HTTP ${res.status}`);
        tip = body.tip;
      }
      toast({
        title: t('10 blocs minés'),
        description: t('Nouvelle hauteur : {h}.', { h: tip?.height ?? '?' }),
      });
      void queryClient.invalidateQueries({ queryKey: ['regtest-info'] });
      for (const w of regtestWallets) invalidateWallet(w.address);
    } catch (err) {
      toast({
        title: t('Échec du minage'),
        description: (err as Error).message.slice(0, 160),
        variant: 'destructive',
      });
    } finally {
      setBusyMine(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListOrdered className="text-primary h-4 w-4" /> {t('Comment ça marche ?')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs sm:grid-cols-3">
          {[
            t('1 — Choisissez le montant de sats de test à recevoir.'),
            t('2 — Cliquez « Recevoir » sur le portefeuille visé.'),
            t('3 — Les sats arrivent confirmés : rien d’autre à faire.'),
          ].map((step, i) => (
            <div key={i} className="border-border bg-muted/30 rounded-md border p-2.5 leading-snug">
              {step}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Coins className="text-primary h-4 w-4" /> {t('Montant par distribution')}
          </CardTitle>
          <CardDescription>
            {t(
              'Le moteur signe une vraie transaction depuis son pool préminé puis mine 1 bloc : le solde est immédiatement dépensable.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 space-y-1">
            <Label className="text-xs">{t('Montant')}</Label>
            <Select value={amount} onValueChange={setAmount}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAUCET_AMOUNTS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-sm">
                    {satsToBtc(s)} BTC
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busyMine}
            onClick={() => void runMine()}
          >
            <Hammer className="h-3.5 w-3.5" /> {t('Miner 10 blocs')}
          </Button>
          <p className="text-muted-foreground w-full text-[11px] leading-snug sm:w-auto sm:flex-1">
            {t(
              '« Miner 10 blocs » fait aussi avancer la chaîne : utile pour confirmer un canal Lightning.',
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <WalletIcon className="text-primary h-4 w-4" />{' '}
            {t('Vos portefeuilles ({n})', { n: regtestWallets.length })}
          </CardTitle>
          <CardDescription>
            {t('Chaque portefeuille reçoit ses propres sats sur sa propre adresse.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {regtestWallets.length === 0 ? (
            <div className="border-border flex flex-col items-start gap-3 rounded-md border border-dashed p-4">
              <p className="text-muted-foreground text-sm">
                {t(
                  'Aucun portefeuille pour le moment. Créez-en un dans le module Portefeuille, puis revenez ici pour le remplir.',
                )}
              </p>
              {onNavigate ? (
                <Button size="sm" variant="outline" onClick={() => onNavigate('portefeuille')}>
                  {t('Créer un portefeuille')}
                </Button>
              ) : null}
            </div>
          ) : (
            regtestWallets.map((w) => (
              <WalletFaucetRow
                key={w.id}
                wallet={w}
                amount={Number(amount)}
                busy={busyAddress === w.address || busyMine}
                onReceive={() => void runFaucet(w)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <CircleDot className="h-3 w-3" />
        {t('Hauteur de la chaîne : {h}', { h: mine.data?.height ?? '…' })}
      </p>
    </div>
  );
}

function WalletFaucetRow({
  wallet,
  amount,
  busy,
  onReceive,
}: {
  wallet: AnyWallet;
  amount: number;
  busy: boolean;
  onReceive: () => void;
}) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const balance = useQuery({
    queryKey: ['address', net, wallet.address],
    queryFn: async () => {
      if (net === 'regtest') {
        const utxos = await api.utxos(wallet.address);
        const funded = utxos.reduce((s, u) => s + u.value, 0);
        return { chain_stats: { funded_txo_sum: funded, spent_txo_sum: 0 } };
      }
      return api.address(wallet.address);
    },
    refetchInterval: 45_000,
    enabled: Boolean(wallet.address),
  });
  const funded =
    (balance.data?.chain_stats.funded_txo_sum ?? 0) -
    (balance.data?.chain_stats.spent_txo_sum ?? 0);

  return (
    <div className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium">{wallet.label}</span>
          <Badge variant="outline" className="text-[10px]">
            {wallet.type.toUpperCase()}
          </Badge>
          {funded > 0 ? (
            <span className="text-muted-foreground font-mono text-xs">{fmtInt(funded)} sats</span>
          ) : (
            <span className="text-muted-foreground/70 text-xs">{t('vide')}</span>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
          {wallet.address}
        </p>
      </div>
      <Button size="sm" className="shrink-0 gap-1.5" disabled={busy} onClick={onReceive}>
        <Droplets className="h-3.5 w-3.5" />
        {t('Recevoir {sats} sats', { sats: fmtInt(amount) })}
      </Button>
    </div>
  );
}
