'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import bolt11 from 'bolt11';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bolt,
  CheckCircle2,
  Infinity as InfinityIcon,
  Link2,
  Loader2,
  QrCode,
  RotateCcw,
  Server,
  ShieldCheck,
  Unplug,
  Wallet as WalletIcon,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copyable, PageIntro } from './bits';
import { QRCode } from './qrcode';
import { useLabStore } from '@/lib/store';
import { useBitquestMissionStore } from '@/lib/bitquest-mission-store';
import { NETWORKS, DEFAULT_NET } from '@/lib/networks';
import { api, mpBroadcast, type AddressUtxo } from '@/lib/mempool';
import { buildSignedTx, estimateVsize, DUST_LIMIT } from '@/lib/bitcoin/tx';
import { fmtInt } from '@/lib/bitcoin/utils';
import { regtestMode } from '@/lib/regtest';
import { regtestChain } from '@/lib/regtest-chain';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  lnLab,
  maxPayableSats,
  msatToSats,
  resolveChannelScid,
  LN_NETWORKS,
  type LnChannelView,
  type LnEventView,
  type LnLabStatus,
  type LnNetId,
  type LnOfferView,
  type LnPendingFunding,
  type NodeKey,
} from '@/lib/lightning';

function useLnStatus(): LnLabStatus {
  return useSyncExternalStore(lnLab.subscribe, lnLab.getStatus, lnLab.getStatus);
}

function outboundOf(channels: LnChannelView[]): number {
  return channels.reduce((sum, c) => sum + msatToSats(c.outboundMsat), 0);
}

function inboundOf(channels: LnChannelView[]): number {
  return channels.reduce((sum, c) => sum + msatToSats(c.inboundMsat), 0);
}

interface Bolt11Preview {
  amountSats: number | null;
  description: string;
  payee: string | null;
  expiresAt: number | null;
}

function decodeBolt11(raw: string): Bolt11Preview | null {
  try {
    const d = bolt11.decode(raw.trim());
    return {
      amountSats: typeof d.satoshis === 'number' && d.satoshis > 0 ? d.satoshis : null,
      description: d.tagsObject.description ?? '',
      payee: d.payeeNodeKey ?? null,
      expiresAt:
        typeof d.timestamp === 'number' && typeof d.tagsObject.expire_time === 'number'
          ? d.timestamp + d.tagsObject.expire_time
          : null,
    };
  } catch {
    return null;
  }
}

function useChannelScids(channels: LnChannelView[]): Record<string, string> {
  const [scids, setScids] = useState<Record<string, string>>({});
  const resolving = useRef(new Set<string>());

  useEffect(() => {
    const pending = channels.filter(
      (ch) =>
        (ch.isReady || ch.isUsable) &&
        ch.fundingTxo &&
        !(ch.channelId in scids) &&
        !resolving.current.has(ch.channelId),
    );
    if (pending.length === 0) return;
    pending.forEach((ch) => resolving.current.add(ch.channelId));
    let cancelled = false;
    void Promise.all(
      pending.map(async (ch) => [ch.channelId, await resolveChannelScid(ch)] as const),
    ).then((results) => {
      results.forEach(([id]) => resolving.current.delete(id));
      if (cancelled) return;
      const resolved = Object.fromEntries(
        results.filter((r): r is [string, string] => r[1] !== null),
      );
      if (Object.keys(resolved).length === 0) return;
      setScids((prev) => ({ ...prev, ...resolved }));
    });
    return () => {
      cancelled = true;
    };
  }, [channels, scids]);

  return scids;
}

function useBitquestChannelCapture(scids: Record<string, string>): void {
  const mission = useBitquestMissionStore((s) => s.mission);
  const setLastScid = useBitquestMissionStore((s) => s.setLastScid);
  const capturedFor = useRef<string | null>(null);

  useEffect(() => {
    const current = mission;
    if (!current || current.kind !== 'CHANNEL') {
      capturedFor.current = null;
      return;
    }
    if (capturedFor.current === current.questCode) return;
    const first = Object.values(scids)[0];
    if (!first) return;
    setLastScid(first);
    capturedFor.current = current.questCode;
  }, [mission, scids, setLastScid]);
}

function PhaseBadge({ phase }: { phase: LnLabStatus['phase'] }) {
  const { t } = useT();
  const meta: Record<LnLabStatus['phase'], { label: string; cls: string }> = {
    off: { label: 'désactivé', cls: 'border-border text-muted-foreground' },
    booting: { label: 'démarrage…', cls: 'border-amber-500/40 text-amber-400' },
    ready: { label: 'actif', cls: 'border-emerald-500/40 text-emerald-400' },
    stopping: { label: 'arrêt…', cls: 'border-sky-500/40 text-sky-400' },
  };
  const m = meta[phase];
  return (
    <Badge variant="outline" className={cn('gap-1 text-[9px]', m.cls)}>
      {phase === 'booting' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
      {t(m.label)}
    </Badge>
  );
}

function eventId(e: LnEventView, idx: number): string {
  return `${idx}-${e.type}-${(e.paymentHash ?? e.channelId ?? '').slice(0, 12)}`;
}

const EVENT_LABELS: Record<string, string> = {
  funding_generation_ready: 'financement du canal attendu',
  channel_pending: 'canal en attente de confirmations',
  channel_ready: 'canal prêt',
  channel_closed: 'canal fermé',
  payment_claimable: 'paiement entrant réclamable',
  payment_claimed: 'paiement reçu',
  payment_sent: 'paiement envoyé',
  payment_failed: 'paiement échoué',
  payment_path_failed: 'tentative de routage échouée',
  discard_funding: 'financement abandonné',
  spendable_outputs: 'sorties récupérables (fermeture)',
};

function EventLine({ e }: { e: LnEventView }) {
  const { t } = useT();
  const label = t(EVENT_LABELS[e.type] ?? e.type.replace(/_/g, ' '));
  const detail =
    e.type === 'payment_claimable' || e.type === 'payment_claimed'
      ? `${msatToSats(e.amountMsat)} sats`
      : e.type === 'funding_generation_ready'
        ? `${fmtInt(Number(e.valueSats ?? 0))} sats`
        : (e.channelId ?? e.paymentHash ?? '').slice(0, 16);
  const iconCls = e.type.startsWith('payment')
    ? 'text-amber-400'
    : e.type.startsWith('funding') || e.type === 'channel_ready'
      ? 'text-emerald-400'
      : e.type.startsWith('discard') || e.type.startsWith('spendable')
        ? 'text-rose-400'
        : 'text-primary';
  return (
    <div className="border-border/40 flex items-center gap-2 border-b py-1.5 text-xs last:border-0">
      <Bolt className={cn('h-3 w-3 shrink-0', iconCls)} aria-hidden />
      <Badge
        variant="outline"
        className={cn(
          'h-4 shrink-0 px-1.5 font-mono text-[9px]',
          e.node === 'A'
            ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
            : e.node === 'B'
              ? 'border-violet-500/40 text-violet-600 dark:text-violet-400'
              : 'border-sky-500/40 text-sky-600 dark:text-sky-400',
        )}
      >
        {e.node}
      </Badge>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">{detail}</span>
    </div>
  );
}

function NodeSummaryCard({
  label,
  nodeId,
  channels,
}: {
  label: string;
  nodeId: string | null;
  channels: LnChannelView[];
}) {
  const { t } = useT();
  const totalOut = channels.reduce((s, c) => s + msatToSats(c.outboundMsat), 0);
  const totalIn = channels.reduce((s, c) => s + msatToSats(c.inboundMsat), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Server className="text-primary h-4 w-4" /> {t('Nœud {n}', { n: label })}
        </CardTitle>
        <CardDescription className="font-mono text-[10px] break-all">
          {nodeId ?? '…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-1 text-xs">
        <div className="flex justify-between">
          <span>{t('Canaux')}</span>
          <span className="font-mono">{channels.length}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('Capacité sortante')}</span>
          <span className="font-mono">{fmtInt(totalOut)} sats</span>
        </div>
        <div className="flex justify-between">
          <span>{t('Capacité entrante')}</span>
          <span className="font-mono">{fmtInt(totalIn)} sats</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FundingBridge({
  pending,
  onSubmit,
}: {
  pending: LnPendingFunding;
  onSubmit: (hex: string, ucid: string) => Promise<void>;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const wallets = useLabStore((s) => s.wallets);
  const net = useLabStore((s) => s.network);
  const [walletId, setWalletId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const usable = wallets.filter((w) => (w.network ?? DEFAULT_NET) === net);
  const wallet = usable.find((w) => w.id === walletId) ?? usable[0] ?? null;

  const buildAndSubmit = async () => {
    if (!wallet) return;
    setBusy(true);
    try {
      if (!pending.address) throw new Error(t('Script de financement illisible.'));
      const valueSats = Number(pending.valueSats);
      const [allUtxos, fees] = await Promise.all([api.utxos(wallet.address), api.fees()]);
      const feeRate = Math.max(1, Number(fees.hourFee) || 1);
      const rank = (u: AddressUtxo) =>
        u.isCoinbase ? (u.status.block_height ?? Number.MAX_SAFE_INTEGER) : -1;
      const ordered = [...allUtxos].sort((a, b) => rank(a) - rank(b));
      const output = { address: pending.address, amountSats: valueSats };
      const needed = (inputs: number) =>
        valueSats +
        Math.ceil(estimateVsize(wallet.type, inputs, [output], true, wallet.address) * feeRate) +
        DUST_LIMIT;
      let covered = 0;
      const selected: AddressUtxo[] = [];
      for (const u of ordered) {
        selected.push(u);
        covered += u.value;
        if (covered >= needed(selected.length)) break;
      }
      const utxos = covered >= needed(selected.length) ? selected : allUtxos;
      const res = buildSignedTx({
        utxos,
        outputs: [{ address: pending.address, amountSats: valueSats }],
        feeRateSatVb: feeRate,
        changeAddress: wallet.address,
        privateKeyHex: wallet.privateKeyHex,
        inputAddress: wallet.address,
        inputType: wallet.type,
      });
      for (let attempt = 0; ; attempt += 1) {
        try {
          await mpBroadcast(res.hex);
          break;
        } catch (first) {
          const detail = first instanceof Error ? first.message : String(first);
          const need =
            net === 'regtest' && regtestMode() === 'embedded'
              ? /encore (\d+) bloc/.exec(detail)
              : null;
          if (!need || attempt >= 2) throw first;
          await regtestChain.mine(Math.min(Number(need[1]) + 2, 120));
        }
      }
      await onSubmit(res.hex, pending.userChannelId);
      let minedNote = '';
      if (net === 'regtest' && regtestMode() === 'embedded') {
        try {
          await regtestChain.mine(8);
          minedNote = ' ' + t('Blocs de confirmation minés automatiquement.');
        } catch {
          minedNote = ' ' + t('Minez des blocs depuis l’onglet Mineur pour confirmer.');
        }
      }
      toast({
        title: t('Financement diffusé'),
        description:
          t('La transaction de financement est sur la chaîne — attendez les confirmations.') +
          minedNote,
      });
    } catch (e) {
      toast({
        title: t('Échec du financement'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <WalletIcon className="h-4 w-4 text-amber-400" /> {t('Financer le canal')}
        </CardTitle>
        <CardDescription>
          {t(
            'Payez {sats} sats vers l’adresse P2WSH ci-dessous depuis un portefeuille test : signé localement, la clé ne quitte jamais le navigateur.',
            { sats: fmtInt(Number(pending.valueSats)) },
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.address ? (
          <Copyable value={pending.address} label={t('Adresse de financement')} />
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="funding-wallet" className="text-muted-foreground text-[10px] uppercase">
              {t('Portefeuille source')}
            </Label>
            <Select value={walletId || wallet?.id} onValueChange={setWalletId}>
              <SelectTrigger id="funding-wallet" className="h-8 text-xs">
                <SelectValue placeholder={t('Choisir un portefeuille')} />
              </SelectTrigger>
              <SelectContent>
                {usable.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">
                    {w.label || w.id.slice(0, 8)} — {w.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="gap-1" disabled={busy || !wallet} onClick={buildAndSubmit}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {t('Financer le canal')}
          </Button>
        </div>
        {usable.length === 0 ? (
          <p className="text-xs text-amber-400">
            {t(
              'Créez et alimentez d’abord un portefeuille sur ce réseau (module Bitcoin, robinet).',
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChannelsView({ st, scids }: { st: LnLabStatus; scids: Record<string, string> }) {
  const { t } = useT();
  const { toast } = useToast();
  const [capacity, setCapacity] = useState('100000');
  const [push, setPush] = useState('40000');
  const [opening, setOpening] = useState(false);
  const channels = st.channelsA;

  const open = async () => {
    const cap = parseInt(capacity, 10);
    const pushMs = parseInt(push, 10) || 0;
    if (!Number.isInteger(cap) || cap < 1000) {
      toast({
        title: t('Capacité invalide'),
        description: t('1000 sats minimum.'),
        variant: 'destructive',
      });
      return;
    }
    if (pushMs > cap * 1000) {
      toast({
        title: t('Montant poussé trop élevé'),
        description: t('Le push ne peut pas dépasser la capacité.'),
        variant: 'destructive',
      });
      return;
    }
    setOpening(true);
    try {
      await lnLab.openChannel(cap, pushMs);
      toast({
        title: t('Demande d’ouverture envoyée'),
        description: t('Le nœud B négocie le canal — l’adresse de financement va apparaître.'),
      });
    } catch (e) {
      toast({
        title: t('Ouverture impossible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  const close = async (ch: LnChannelView) => {
    lnLab.closeChannel('A', ch.channelId);
    toast({
      title: t('Fermeture demandée'),
      description: t('La transaction de fermeture sera diffusée on-chain.'),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="text-primary h-4 w-4" /> {t('Ouvrir un canal A → B')}
          </CardTitle>
          <CardDescription>
            {t(
              'Le canal est financé on-chain : A construit la transaction de financement, B l’accepte, puis 6 confirmations verrouillent le canal.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1">
            <Label htmlFor="cap" className="text-muted-foreground text-[10px] uppercase">
              {t('Capacité (sats)')}
            </Label>
            <Input
              id="cap"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="w-40 space-y-1">
            <Label htmlFor="push" className="text-muted-foreground text-[10px] uppercase">
              {t('Push vers B (msat)')}
            </Label>
            <Input
              id="push"
              value={push}
              onChange={(e) => setPush(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <Button size="sm" onClick={open} disabled={!st.connected || opening}>
            {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('Demander l’ouverture')}
          </Button>
        </CardContent>
      </Card>

      {st.pendingFunding ? (
        <FundingBridge
          pending={st.pendingFunding}
          onSubmit={(hex, ucid) => lnLab.submitFundingTx(hex, ucid)}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Canaux du nœud A')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {channels.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('Aucun canal pour le moment.')}</p>
          ) : null}
          {channels.map((ch) => {
            const ready = ch.isReady || ch.isUsable;
            const conf = ch.confirmations ?? '0';
            const required = ch.confirmationsRequired ?? '6';
            return (
              <div key={ch.channelId} className="border-border/60 rounded-md border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {ch.channelId.slice(0, 24)}…
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px]',
                      ready
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-amber-500/40 text-amber-400',
                    )}
                  >
                    {ready ? t('prêt') : t('{c}/{r} confirmations', { c: conf, r: required })}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase">{t('Capacité')}</p>
                    <p className="font-mono">{fmtInt(Number(ch.valueSats))} sats</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase">
                      <ArrowUpRight className="h-3 w-3" /> {t('Sortant')}
                    </p>
                    <p className="font-mono">{fmtInt(msatToSats(ch.outboundMsat))} sats</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase">
                      <ArrowDownLeft className="h-3 w-3" /> {t('Entrant')}
                    </p>
                    <p className="font-mono">{fmtInt(msatToSats(ch.inboundMsat))} sats</p>
                  </div>
                </div>
                {scids[ch.channelId] ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[10px] uppercase">
                      {t('Identifiant court de canal')}
                    </p>
                    <p className="font-mono text-[11px]">{scids[ch.channelId]}</p>
                  </div>
                ) : null}
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() => close(ch)}
                  >
                    <Unplug className="h-3 w-3" /> {t('Fermer')}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function NodePicker({
  id,
  label,
  value,
  onChange,
  liquidity,
}: {
  id: string;
  label: string;
  value: NodeKey;
  onChange: (n: NodeKey) => void;
  liquidity: Record<NodeKey, number>;
}) {
  const { t } = useT();
  return (
    <div className="w-56 space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-[10px] uppercase">
        {t(label)}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as NodeKey)}>
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['A', 'B'] as NodeKey[]).map((n) => (
            <SelectItem key={n} value={n} className="text-xs">
              {t('Nœud {n}', { n })} — {fmtInt(liquidity[n])} sats
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Bolt11Panel({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  const { toast } = useToast();
  const [amount, setAmount] = useState('21000');
  const [memo, setMemo] = useState('Café BitLab');
  const [payeeNode, setPayeeNode] = useState<NodeKey>('B');
  const [invoice, setInvoice] = useState('');
  const [payerNode, setPayerNode] = useState<NodeKey>('A');
  const [payInput, setPayInput] = useState('');
  const [decoded, setDecoded] = useState<Bolt11Preview | null>(null);
  const [openAmount, setOpenAmount] = useState('1000');
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  const outbound: Record<NodeKey, number> = {
    A: outboundOf(st.channelsA),
    B: outboundOf(st.channelsB),
  };
  const inbound: Record<NodeKey, number> = {
    A: inboundOf(st.channelsA),
    B: inboundOf(st.channelsB),
  };

  const create = async () => {
    setCreating(true);
    setInvoice('');
    try {
      const sats = parseInt(amount, 10);
      if (!Number.isInteger(sats) || sats <= 0) throw new Error(t('Montant invalide.'));
      const bolt11str = await lnLab.createInvoice(payeeNode, sats * 1000, memo, 3600);
      setInvoice(bolt11str);
      // Expose au banner mission BitQuest (kind=INVOICE)
      useBitquestMissionStore.getState().setLastBolt11(bolt11str);
      toast({
        title: t('Facture créée'),
        description: t('Signée par le nœud {n} — faites-la payer par l’autre nœud.', {
          n: payeeNode,
        }),
      });
    } catch (e) {
      toast({
        title: t('Création impossible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const onPayInput = (raw: string) => {
    setPayInput(raw);
    setDecoded(raw.trim() ? decodeBolt11(raw) : null);
  };

  const selfPayment =
    decoded?.payee != null && decoded.payee === (payerNode === 'A' ? st.nodeA : st.nodeB);
  const noLiquidity = outbound[payerNode] <= 0;
  const expired = decoded?.expiresAt != null && now != null && decoded.expiresAt * 1000 < now;
  const needsOpenAmount = decoded !== null && decoded.amountSats === null;
  const openMsat = parseInt(openAmount, 10);
  const payerChannels = payerNode === 'A' ? st.channelsA : st.channelsB;
  const payeeChannels = payerNode === 'A' ? st.channelsB : st.channelsA;
  const payAmountSats = decoded?.amountSats ?? (Number.isInteger(openMsat) ? openMsat : null);
  const exceedsHtlcLimit = payAmountSats != null && payAmountSats > maxPayableSats(payerChannels);
  const createAmountSats = parseInt(amount, 10);
  const createExceedsLimit =
    Number.isInteger(createAmountSats) &&
    createAmountSats > 0 &&
    createAmountSats > maxPayableSats(payeeChannels);

  const pay = async () => {
    const raw = payInput.trim();
    if (!raw) return;
    setPaying(true);
    try {
      if (expired) throw new Error(t('Cette facture est expirée : demandez-en une nouvelle.'));
      if (selfPayment)
        throw new Error(t('Le nœud payeur est aussi le destinataire : choisissez l’autre nœud.'));
      if (needsOpenAmount && (!Number.isInteger(openMsat) || openMsat <= 0))
        throw new Error(t('Facture à montant libre : indiquez combien payer.'));
      if (exceedsHtlcLimit)
        throw new Error(
          t(
            'Montant au-dessus de la limite HTLC du canal ({max} sats par paiement) : ouvrez un canal d’une capacité au moins 10 fois supérieure.',
            { max: fmtInt(maxPayableSats(payerChannels)) },
          ),
        );
      await lnLab.payInvoice(payerNode, raw, needsOpenAmount ? openMsat * 1000 : null);
      toast({
        title: t('Paiement lancé'),
        description: t('Le HTLC circule sur le canal {a} → {b}.', {
          a: payerNode,
          b: payerNode === 'A' ? 'B' : 'A',
        }),
      });
      setPayInput('');
      setDecoded(null);
      setOpenAmount('1000');
    } catch (e) {
      toast({
        title: t('Paiement impossible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <QrCode className="h-4 w-4 text-amber-400" />{' '}
            {t('Créer une facture BOLT11 (nœud {n})', { n: payeeNode })}
          </CardTitle>
          <CardDescription>
            {t('Une facture neuve à chaque paiement : montant verrouillé, expiration d’une heure.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <NodePicker
            id="b11-payee"
            label="Nœud payé"
            value={payeeNode}
            onChange={setPayeeNode}
            liquidity={inbound}
          />
          <div className="w-36 space-y-1">
            <Label htmlFor="amt" className="text-muted-foreground text-[10px] uppercase">
              {t('Montant (sats)')}
            </Label>
            <Input
              id="amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="w-52 flex-1 space-y-1">
            <Label htmlFor="memo" className="text-muted-foreground text-[10px] uppercase">
              {t('Description')}
            </Label>
            <Input
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={create} disabled={creating || !st.connected}>
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {t('Créer')}
          </Button>
        </CardContent>
        {createExceedsLimit ? (
          <CardContent className="pb-4">
            <p className="text-xs text-amber-400">
              {t(
                'Aucun canal du nœud {n} ne pourra payer {sats} sats d’un coup : un HTLC est limité à 10 % de la capacité du canal.',
                { n: payeeNode, sats: fmtInt(createAmountSats) },
              )}
            </p>
          </CardContent>
        ) : null}
        {invoice ? (
          <CardContent className="border-border/40 space-y-2 border-t pt-3">
            <div className="mx-auto w-fit rounded-lg bg-white p-2">
              <QRCode value={invoice} size={148} />
            </div>
            <Copyable value={invoice} label="BOLT11" />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowUpRight className="h-4 w-4 text-amber-400" /> {t('Payer une facture BOLT11')}
          </CardTitle>
          <CardDescription>
            {t(
              'Choisissez d’abord le nœud payeur, collez la facture (lntb…, lntbs…, lnbcrt…), vérifiez l’aperçu puis payez.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NodePicker
            id="b11-payer"
            label="Nœud payeur"
            value={payerNode}
            onChange={setPayerNode}
            liquidity={outbound}
          />
          {noLiquidity ? (
            <p className="text-xs text-amber-400">
              {t(
                'Le nœud {n} n’a aucune capacité sortante : ouvrez et confirmez d’abord un canal.',
                { n: payerNode },
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="b11" className="text-muted-foreground text-[10px] uppercase">
                BOLT11
              </Label>
              <Input
                id="b11"
                value={payInput}
                onChange={(e) => onPayInput(e.target.value)}
                placeholder="lntb… / lntbs… / lnbcrt…"
                className="h-8 font-mono text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => void pay()}
              disabled={
                !st.connected ||
                paying ||
                !payInput.trim() ||
                decoded === null ||
                noLiquidity ||
                selfPayment ||
                expired ||
                exceedsHtlcLimit ||
                (needsOpenAmount && (!Number.isInteger(openMsat) || openMsat <= 0))
              }
            >
              {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('Payer')}
            </Button>
          </div>
          {payInput.trim() && decoded === null ? (
            <p className="text-xs text-amber-400">
              {t('Facture illisible : vérifiez la chaîne complète copiée-collée.')}
            </p>
          ) : null}
          {decoded ? (
            <div
              className={cn(
                'space-y-1 rounded-md border p-3 text-xs',
                selfPayment || expired
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-amber-500/30 bg-amber-500/5',
              )}
            >
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Description')}</span>
                <span className="truncate">{decoded.description || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Montant')}</span>
                <span className="font-mono">
                  {decoded.amountSats != null
                    ? `${fmtInt(decoded.amountSats)} sats`
                    : t('montant libre')}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Expiration')}</span>
                <span>
                  {expired
                    ? t('facture expirée')
                    : decoded.expiresAt
                      ? new Date(decoded.expiresAt * 1000).toLocaleTimeString()
                      : '—'}
                </span>
              </div>
              {decoded.payee ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('Destination')}</span>
                  <span className="truncate font-mono text-[10px]">
                    {decoded.payee.slice(0, 24)}…
                  </span>
                </div>
              ) : null}
              {selfPayment ? (
                <p className="text-xs text-red-400">
                  {t('Le nœud payeur est aussi le destinataire : choisissez l’autre nœud.')}
                </p>
              ) : null}
            </div>
          ) : null}
          {needsOpenAmount && !selfPayment ? (
            <div className="w-40 space-y-1">
              <Label htmlFor="b11-open" className="text-muted-foreground text-[10px] uppercase">
                {t('Montant (sats)')}
              </Label>
              <Input
                id="b11-open"
                value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ProtocolLegend() {
  const { t } = useT();
  const items = [
    {
      key: 'bolt11',
      icon: QrCode,
      name: 'BOLT11',
      title: 'Facture à usage unique',
      desc: 'Un montant fixe, une expiration, un seul paiement — comme un ticket de caisse.',
      cls: 'border-amber-500/40 bg-amber-500/5',
      iconCls: 'text-amber-400',
    },
    {
      key: 'bolt12',
      icon: InfinityIcon,
      name: 'BOLT12',
      title: 'Offer réutilisable',
      desc: 'Un code de paiement réutilisable, montant parfois libre — la facture est demandée au moment du paiement.',
      cls: 'border-violet-500/40 bg-violet-500/5',
      iconCls: 'text-violet-400',
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.key} className={cn('flex items-start gap-3 rounded-lg border p-3', it.cls)}>
          <it.icon className={cn('mt-0.5 h-4 w-4 shrink-0', it.iconCls)} />
          <div>
            <p className="text-xs font-semibold">
              {it.name} · {t(it.title)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{t(it.desc)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Bolt12Panel({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  const { toast } = useToast();
  const [amount, setAmount] = useState('21000');
  const [memo, setMemo] = useState('Café BitLab');
  const [payeeNode, setPayeeNode] = useState<NodeKey>('B');
  const [offer, setOffer] = useState('');
  const [payerNode, setPayerNode] = useState<NodeKey>('A');
  const [payInput, setPayInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [decoded, setDecoded] = useState<LnOfferView | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);

  const outbound: Record<NodeKey, number> = {
    A: outboundOf(st.channelsA),
    B: outboundOf(st.channelsB),
  };
  const inbound: Record<NodeKey, number> = {
    A: inboundOf(st.channelsA),
    B: inboundOf(st.channelsB),
  };

  const create = async () => {
    setCreating(true);
    setOffer('');
    try {
      const sats = parseInt(amount, 10);
      if (!Number.isInteger(sats) || sats < 0) throw new Error(t('Montant invalide.'));
      const lno = await lnLab.createOffer(payeeNode, sats > 0 ? sats * 1000 : null, memo);
      setOffer(lno);
      toast({
        title: t('Offer créée'),
        description: t('Signée par le nœud {n} — réutilisable autant de fois que voulu.', {
          n: payeeNode,
        }),
      });
    } catch (e) {
      toast({
        title: t('Création impossible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const decode = async () => {
    const raw = payInput.trim();
    if (!raw) return;
    try {
      setDecoded(await lnLab.decodeOffer(raw));
    } catch (e) {
      setDecoded(null);
      toast({
        title: t('Offer illisible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const selfPayment =
    decoded?.signingPubkey != null &&
    decoded.signingPubkey === (payerNode === 'A' ? st.nodeA : st.nodeB);
  const noLiquidity = outbound[payerNode] <= 0;
  const freeAmount = !decoded || decoded.amountMsat === '';
  const payerChannels = payerNode === 'A' ? st.channelsA : st.channelsB;
  const payeeChannels = payerNode === 'A' ? st.channelsB : st.channelsA;
  const enteredSats = parseInt(payAmount, 10);
  const payAmountSats = freeAmount
    ? Number.isInteger(enteredSats) && enteredSats > 0
      ? enteredSats
      : null
    : msatToSats(decoded.amountMsat);
  const exceedsHtlcLimit = payAmountSats != null && payAmountSats > maxPayableSats(payerChannels);
  const createAmountSats = parseInt(amount, 10);
  const createExceedsLimit =
    Number.isInteger(createAmountSats) &&
    createAmountSats > 0 &&
    createAmountSats > maxPayableSats(payeeChannels);

  const pay = async () => {
    const raw = payInput.trim();
    if (!raw) return;
    setPaying(true);
    try {
      if (selfPayment)
        throw new Error(t('Le nœud payeur est aussi le destinataire : choisissez l’autre nœud.'));
      if (noLiquidity)
        throw new Error(
          t('Le nœud {n} n’a aucune capacité sortante : ouvrez et confirmez d’abord un canal.', {
            n: payerNode,
          }),
        );
      let amountMsat: number | null = null;
      if (freeAmount) {
        const sats = parseInt(payAmount, 10);
        if (!Number.isInteger(sats) || sats <= 0) {
          throw new Error(t('Cette offer ne fixe pas de montant : indiquez combien payer.'));
        }
        amountMsat = sats * 1000;
      }
      if (exceedsHtlcLimit)
        throw new Error(
          t(
            'Montant au-dessus de la limite HTLC du canal ({max} sats par paiement) : ouvrez un canal d’une capacité au moins 10 fois supérieure.',
            { max: fmtInt(maxPayableSats(payerChannels)) },
          ),
        );
      await lnLab.payOffer(payerNode, raw, amountMsat, payNote.trim() || null);
      toast({
        title: t('Demande de facture envoyée'),
        description: t(
          'Le nœud {a} interroge {b} via messages onion chiffrés, puis paie la facture retournée. Suivez le journal.',
          { a: payerNode, b: payerNode === 'A' ? 'B' : 'A' },
        ),
      });
      setPayInput('');
      setPayAmount('');
      setPayNote('');
      setDecoded(null);
    } catch (e) {
      toast({
        title: t('Paiement impossible'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <InfinityIcon className="h-4 w-4 text-violet-400" />{' '}
            {t('Créer une offer BOLT12 (nœud {n})', { n: payeeNode })}
          </CardTitle>
          <CardDescription>
            {t(
              'Un même code lno1… pour un nombre illimité de paiements. Montant facultatif : laissez 0 pour un paiement libre.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <NodePicker
            id="b12-payee"
            label="Nœud payé"
            value={payeeNode}
            onChange={setPayeeNode}
            liquidity={inbound}
          />
          <div className="w-44 space-y-1">
            <Label htmlFor="oamt" className="text-muted-foreground text-[10px] uppercase">
              {t('Montant (sats, 0 = libre)')}
            </Label>
            <Input
              id="oamt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <div className="w-52 flex-1 space-y-1">
            <Label htmlFor="omemo" className="text-muted-foreground text-[10px] uppercase">
              {t('Description')}
            </Label>
            <Input
              id="omemo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={create} disabled={creating || !st.connected}>
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <InfinityIcon className="h-3.5 w-3.5" />
            )}
            {t('Créer l’offer')}
          </Button>
        </CardContent>
        {createExceedsLimit ? (
          <CardContent className="pb-4">
            <p className="text-xs text-amber-400">
              {t(
                'Aucun canal du nœud {n} ne pourra payer {sats} sats d’un coup : un HTLC est limité à 10 % de la capacité du canal.',
                { n: payeeNode, sats: fmtInt(createAmountSats) },
              )}
            </p>
          </CardContent>
        ) : null}
        {offer ? (
          <CardContent className="border-border/40 space-y-2 border-t pt-3">
            <div className="mx-auto w-fit rounded-lg bg-white p-2">
              <QRCode value={offer} size={148} />
            </div>
            <Copyable value={offer} label="BOLT12" />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowUpRight className="h-4 w-4 text-violet-400" /> {t('Payer une offer BOLT12')}
          </CardTitle>
          <CardDescription>
            {t(
              'Choisissez d’abord le nœud payeur : il demande une facture au destinataire via messages onion chiffrés, puis la paie sur le canal.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NodePicker
            id="b12-payer"
            label="Nœud payeur"
            value={payerNode}
            onChange={setPayerNode}
            liquidity={outbound}
          />
          {noLiquidity ? (
            <p className="text-xs text-amber-400">
              {t(
                'Le nœud {n} n’a aucune capacité sortante : ouvrez et confirmez d’abord un canal.',
                { n: payerNode },
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="b12" className="text-muted-foreground text-[10px] uppercase">
                BOLT12
              </Label>
              <Input
                id="b12"
                value={payInput}
                onChange={(e) => {
                  setPayInput(e.target.value);
                  setDecoded(null);
                }}
                placeholder="lno1…"
                className="h-8 font-mono text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void decode()}
              disabled={!st.connected || !payInput.trim()}
            >
              {t('Vérifier')}
            </Button>
          </div>
          {decoded ? (
            <div
              className={cn(
                'space-y-1 rounded-md border p-3 text-xs',
                selfPayment
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-violet-500/30 bg-violet-500/5',
              )}
            >
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Description')}</span>
                <span className="truncate">{decoded.description || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Montant')}</span>
                <span className="font-mono">
                  {decoded.amountMsat
                    ? `${fmtInt(msatToSats(decoded.amountMsat))} sats`
                    : t('montant libre')}
                </span>
              </div>
              {decoded.signingPubkey ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('Émetteur')}</span>
                  <span className="truncate font-mono text-[10px]">
                    {decoded.signingPubkey.slice(0, 24)}…
                  </span>
                </div>
              ) : null}
              {selfPayment ? (
                <p className="text-xs text-red-400">
                  {t('Le nœud payeur est aussi le destinataire : choisissez l’autre nœud.')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            {freeAmount && !selfPayment ? (
              <div className="w-40 space-y-1">
                <Label htmlFor="payamt" className="text-muted-foreground text-[10px] uppercase">
                  {t('Montant (sats)')}
                </Label>
                <Input
                  id="payamt"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            ) : null}
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor="paynote" className="text-muted-foreground text-[10px] uppercase">
                {t('Note au payeur (facultatif)')}
              </Label>
              <Input
                id="paynote"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => void pay()}
              disabled={
                !st.connected ||
                paying ||
                !payInput.trim() ||
                noLiquidity ||
                selfPayment ||
                exceedsHtlcLimit ||
                (freeAmount && !payAmount.trim())
              }
            >
              {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t('Demander et payer')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsView({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <ProtocolLegend />
      <Tabs defaultValue="bolt11">
        <TabsList>
          <TabsTrigger value="bolt11" className="gap-1.5">
            <QrCode className="h-3 w-3 text-amber-400" /> BOLT11 · {t('facture')}
          </TabsTrigger>
          <TabsTrigger value="bolt12" className="gap-1.5">
            <InfinityIcon className="h-3 w-3 text-violet-400" /> BOLT12 · {t('offer')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bolt11" className="mt-4">
          <Bolt11Panel st={st} />
        </TabsContent>
        <TabsContent value="bolt12" className="mt-4">
          <Bolt12Panel st={st} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JournalView({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Événements Lightning')}</CardTitle>
        </CardHeader>
        <CardContent>
          {st.events.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('Aucun événement pour le moment.')}</p>
          ) : null}
          {st.events.map((e, i) => (
            <EventLine key={eventId(e, i)} e={e} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="text-primary h-4 w-4" /> {t('Diffusions on-chain')}
          </CardTitle>
          <CardDescription>
            {t('Transactions émises par les nœuds (financement, fermeture, sanctions).')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {st.broadcasts.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t('Aucune diffusion pour le moment.')}</p>
          ) : null}
          {st.broadcasts.map((b, i) => (
            <div
              key={`${b.at}-${i}`}
              className="border-border/40 flex items-center gap-2 border-b py-1.5 text-xs last:border-0"
            >
              {b.ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-red-400" />
              )}
              <span className="text-muted-foreground font-mono text-[10px]">
                {new Date(b.at).toLocaleTimeString()}
              </span>
              <span className="flex-1 truncate font-mono text-[10px]">{b.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Journal LDK')}</CardTitle>
          <CardDescription>
            {t(
              'Sorties brutes des nœuds (niveau LDK) : A en émeraude, B en violet, messages système en bleu.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-muted/30 max-h-72 scrollbar-thin space-y-0.5 overflow-y-auto rounded-md p-3 font-mono text-[10px] leading-relaxed">
          {st.logs.slice(0, 80).map((l, i) => (
            <p key={`${i}-${l.line.slice(0, 12)}`} className="flex gap-2">
              <span
                className={cn(
                  'w-3 shrink-0 font-semibold',
                  l.node === 'A'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : l.node === 'B'
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-sky-600 dark:text-sky-400',
                )}
              >
                {l.node}
              </span>
              <span className="text-muted-foreground min-w-0 break-all">{l.line}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LightningModule() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const st = useLnStatus();
  const supported = (LN_NETWORKS as string[]).includes(net);
  const lnNet = supported ? (net as LnNetId) : null;
  const active = st.phase === 'ready' || st.phase === 'booting' || st.phase === 'stopping';
  const onSameNetwork = st.network === lnNet;
  const busyElsewhere = active && !onSameNetwork;
  const scids = useChannelScids([...st.channelsA, ...st.channelsB]);
  useBitquestChannelCapture(scids);
  const autoTried = useRef(new Set<LnNetId>());

  useEffect(() => {
    if (!lnNet) return;
    if (autoTried.current.has(lnNet)) return;
    if (st.phase !== 'off' || st.error) return;
    if (!lnLab.isDesired(lnNet)) return;
    autoTried.current.add(lnNet);
    void lnLab.activate(lnNet);
  }, [lnNet, st.phase, st.error]);

  const toggle = (on: boolean) => {
    if (!lnNet) return;
    if (on) void lnLab.activate(lnNet);
    else lnLab.deactivate();
  };

  return (
    <div className="space-y-5">
      <PageIntro
        title={t('Laboratoire Lightning')}
        desc={t(
          'Deux nœuds LDK réels compilés en WebAssembly tournent dans votre navigateur : canaux financés on-chain, factures BOLT11, offers BOLT12 réutilisables via messages onion, paiements HTLC authentiques. Vos clés et vos données restent dans votre navigateur.',
        )}
        actions={<PhaseBadge phase={active && onSameNetwork ? st.phase : 'off'} />}
      />

      {lnNet === null ? (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-3 pt-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              {t(
                'Le laboratoire Lightning est disponible sur testnet4, testnet3, signet et regtest. Changez de réseau dans la barre latérale.',
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={active && onSameNetwork}
                disabled={busyElsewhere}
                onCheckedChange={toggle}
              />
              <div>
                <p className="text-sm font-medium">{t('Activer le laboratoire')}</p>
                <p className="text-muted-foreground text-xs">
                  {busyElsewhere
                    ? t(
                        'Le laboratoire tourne sur {other}. Arrêtez-le sur ce réseau avant de le démarrer ici.',
                        { other: NETWORKS[st.network as LnNetId].label },
                      )
                    : t(
                        'Les nœuds restent actifs après un rechargement de page et se réactivent automatiquement ; seul l’interrupteur les arrête.',
                      )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {st.phase === 'ready' && onSameNetwork ? (
                <>
                  {st.best ? (
                    <Badge variant="outline" className="gap-1 text-[9px]">
                      <Bolt className="h-2.5 w-2.5" />
                      {t('Bloc {h}', { h: st.best.height })}
                    </Badge>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 text-[9px]',
                      st.connected
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-amber-500/40 text-amber-400',
                    )}
                  >
                    {st.connected ? (
                      <Link2 className="h-2.5 w-2.5" />
                    ) : (
                      <Unplug className="h-2.5 w-2.5" />
                    )}
                    {st.connected ? t('A connecté à B') : t('pairs déconnectés')}
                  </Badge>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {lnNet !== null && active && onSameNetwork ? (
        st.phase === 'ready' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <NodeSummaryCard label="A" nodeId={st.nodeA} channels={st.channelsA} />
              <NodeSummaryCard label="B" nodeId={st.nodeB} channels={st.channelsB} />
            </div>
            <Tabs defaultValue="channels">
              <TabsList>
                <TabsTrigger value="channels">{t('Canaux')}</TabsTrigger>
                <TabsTrigger value="payments">{t('Paiements')}</TabsTrigger>
                <TabsTrigger value="journal">{t('Journal')}</TabsTrigger>
              </TabsList>
              <TabsContent value="channels" className="mt-4">
                <ChannelsView st={st} scids={scids} />
              </TabsContent>
              <TabsContent value="payments" className="mt-4">
                <PaymentsView st={st} />
              </TabsContent>
              <TabsContent value="journal" className="mt-4">
                <JournalView st={st} />
              </TabsContent>
            </Tabs>
            <ResetCard network={lnNet} />
          </>
        ) : (
          <Card>
            <CardContent className="text-muted-foreground flex items-center gap-3 py-8 text-sm">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              {t('Chargement du module WASM et synchronisation initiale…')}
            </CardContent>
          </Card>
        )
      ) : null}

      {st.error ? (
        <Card className="border-red-500/40">
          <CardContent className="flex items-start gap-3 pt-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="font-mono text-xs">{st.error}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ResetCard({ network }: { network: LnNetId }) {
  const { t } = useT();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card className="border-red-500/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <RotateCcw className="h-4 w-4 text-red-400" /> {t('Réinitialiser le laboratoire')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t(
              'Efface les graines, canaux et données locales des deux nœuds sur ce réseau. Les fonds on-chain du canal seront perdus si des canaux sont ouverts.',
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-[10px]"
                onClick={async () => {
                  setConfirming(false);
                  await lnLab.reset(network);
                  toast({
                    title: t('Laboratoire réinitialisé'),
                    description: t('Toutes les données Lightning locales ont été supprimées.'),
                  });
                }}
              >
                {t('Confirmer la suppression')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                onClick={() => setConfirming(false)}
              >
                {t('Annuler')}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px]"
              onClick={() => setConfirming(true)}
            >
              {t('Réinitialiser…')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
