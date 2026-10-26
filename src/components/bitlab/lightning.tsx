'use client';

/**
 * BitLab — Laboratoire Lightning RÉEL dans le navigateur.
 *
 * Les deux nœuds LDK (A et B) tournent en WebAssembly côté client, dans un
 * Web Worker : vraies clés, vrai protocole Lightning, vrais canaux financés
 * on-chain (Esplora), vraies factures BOLT11 signées, vrais HTLC. Aucune
 * simulation : chaque écran reflète l'état réel et les erreurs remontent
 * telles quelles. Le serveur ne sert que des fichiers statiques.
 */
import { useState, useSyncExternalStore } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copyable, PageIntro } from './bits';
import { QRCode } from './qrcode';
import { useLabStore } from '@/lib/store';
import { NETWORKS, DEFAULT_NET } from '@/lib/networks';
import { api, mpBroadcast, type AddressUtxo } from '@/lib/mempool';
import { buildSignedTx } from '@/lib/bitcoin/tx';
import { fmtInt } from '@/lib/bitcoin/utils';
import { regtestMode } from '@/lib/regtest';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  lnLab,
  msatToSats,
  LN_NETWORKS,
  type LnChannelView,
  type LnEventView,
  type LnLabStatus,
  type LnNetId,
  type LnOfferView,
  type LnPendingFunding,
} from '@/lib/lightning';

/* ─────────────────────────  Aides d'affichage  ───────────────────────── */

function useLnStatus(): LnLabStatus {
  return useSyncExternalStore(lnLab.subscribe, lnLab.getStatus, lnLab.getStatus);
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
  // Couleur par famille : paiements (ambre), financement (émeraude), fermetures (rouge).
  const iconCls = e.type.startsWith('payment')
    ? 'text-amber-400'
    : e.type.startsWith('funding') || e.type === 'channel_ready'
      ? 'text-emerald-400'
      : e.type.startsWith('discard') || e.type.startsWith('spendable')
        ? 'text-rose-400'
        : 'text-primary';
  return (
    <div className="flex items-center gap-2 border-b border-border/40 py-1.5 text-xs last:border-0">
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
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{detail}</span>
    </div>
  );
}

/* ─────────────────────────  Vue état des nœuds  ───────────────────────── */

function NodeSummaryCard({ label, nodeId, channels }: { label: string; nodeId: string | null; channels: LnChannelView[] }) {
  const { t } = useT();
  const totalOut = channels.reduce((s, c) => s + msatToSats(c.outboundMsat), 0);
  const totalIn = channels.reduce((s, c) => s + msatToSats(c.inboundMsat), 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Server className="h-4 w-4 text-primary" /> {t('Nœud {n}', { n: label })}
        </CardTitle>
        <CardDescription className="font-mono text-[10px] break-all">{nodeId ?? '…'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
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

/* ─────────────────────────  Pont de financement  ───────────────────────── */

function FundingBridge({ pending, onSubmit }: { pending: LnPendingFunding; onSubmit: (hex: string, ucid: string) => void }) {
  const { t } = useT();
  const { toast } = useToast();
  const wallets = useLabStore((s) => s.wallets);
  const net = useLabStore((s) => s.network);
  const [walletId, setWalletId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Sandbox : seuls les portefeuilles dérivés pour le réseau actif du labo
  // peuvent financer le canal — des pièces réelles sont hors de portée par
  // construction (le labo lui-même n'existe que sur réseaux de test).
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
      // Sélection minimale « dépensabilité d'abord » : couvrir la cible avec le
      // moins d'UTXO possible — les sorties normales d'abord, puis les
      // coinbases les plus anciennes (déjà mûres). Sans cela, financer
      // 0.001 BTC dépenserait d'un bloc toutes les coinbases du robinet et
      // se heurterait à la règle de maturité des 100 blocs.
      const rank = (u: AddressUtxo) => (u.isCoinbase ? (u.status.block_height ?? Number.MAX_SAFE_INTEGER) : -1);
      const ordered = [...allUtxos].sort((a, b) => rank(a) - rank(b));
      const target = valueSats + 5000; // capacité + marge de frais
      let covered = 0;
      const selected: AddressUtxo[] = [];
      for (const u of ordered) {
        selected.push(u);
        covered += u.value;
        if (covered >= target) break;
      }
      const utxos = covered >= target ? selected : allUtxos;
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
          // Sandbox regtest embarquée : la chaîne indique combien de blocs de
          // maturité manquent — on les mine puis on retente (3 essais max).
          // Jamais appliqué aux réseaux réels : l'erreur remonte telle quelle.
          const detail = first instanceof Error ? first.message : String(first);
          const need = net === 'regtest' && regtestMode() === 'embedded' ? /encore (\d+) bloc/.exec(detail) : null;
          if (!need || attempt >= 2) throw first;
          const mineRes = await fetch('/api/regtest/mine', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ blocks: Math.min(Number(need[1]) + 2, 120) }),
          });
          if (!mineRes.ok) throw first;
        }
      }
      onSubmit(res.hex, pending.userChannelId);
      // Regtest embarqué : le serveur mine aussitôt les blocs de confirmation
      // (seuil du canal : 6, + 2 blocs de marge — LDK compte les
      // confirmations à partir du bloc suivant le financement). La chaîne
      // embarquée est locale : le minage est instantané.
      let minedNote = '';
      if (net === 'regtest' && regtestMode() === 'embedded') {
        try {
          const mineRes = await fetch('/api/regtest/mine', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ blocks: 8 }),
          });
          const mineBody = (await mineRes.json().catch(() => ({}))) as { ok?: boolean };
          minedNote = mineBody.ok ? ' ' + t('Blocs de confirmation minés automatiquement.') : '';
        } catch {
          minedNote = ' ' + t('Minez des blocs depuis l’onglet Mineur pour confirmer.');
        }
      }
      toast({
        title: t('Financement diffusé'),
        description: t('La transaction de financement est sur la chaîne — attendez les confirmations.') + minedNote,
      });
    } catch (e) {
      toast({ title: t('Échec du financement'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
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
        {pending.address ? <Copyable value={pending.address} label={t('Adresse de financement')} /> : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="funding-wallet" className="text-[10px] uppercase text-muted-foreground">
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
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {t('Financer le canal')}
          </Button>
        </div>
        {usable.length === 0 ? (
          <p className="text-xs text-amber-400">{t('Créez et alimentez d’abord un portefeuille sur ce réseau (module Bitcoin, robinet).')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────  Vue canaux  ───────────────────────── */

function ChannelsView({ st }: { st: LnLabStatus }) {
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
      toast({ title: t('Capacité invalide'), description: t('1000 sats minimum.'), variant: 'destructive' });
      return;
    }
    if (pushMs > cap * 1000) {
      toast({ title: t('Montant poussé trop élevé'), description: t('Le push ne peut pas dépasser la capacité.'), variant: 'destructive' });
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
      toast({ title: t('Ouverture impossible'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setOpening(false);
    }
  };

  const close = async (ch: LnChannelView) => {
    lnLab.closeChannel('A', ch.channelId);
    toast({ title: t('Fermeture demandée'), description: t('La transaction de fermeture sera diffusée on-chain.') });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-primary" /> {t('Ouvrir un canal A → B')}
          </CardTitle>
          <CardDescription>
            {t(
              'Le canal est financé on-chain : A construit la transaction de financement, B l’accepte, puis 6 confirmations verrouillent le canal.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1">
            <Label htmlFor="cap" className="text-[10px] uppercase text-muted-foreground">
              {t('Capacité (sats)')}
            </Label>
            <Input id="cap" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-8 font-mono text-xs" />
          </div>
          <div className="w-40 space-y-1">
            <Label htmlFor="push" className="text-[10px] uppercase text-muted-foreground">
              {t('Push vers B (msat)')}
            </Label>
            <Input id="push" value={push} onChange={(e) => setPush(e.target.value)} className="h-8 font-mono text-xs" />
          </div>
          <Button size="sm" onClick={open} disabled={!st.connected || opening}>
            {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t('Demander l’ouverture')}
          </Button>
        </CardContent>
      </Card>

      {st.pendingFunding ? <FundingBridge pending={st.pendingFunding} onSubmit={(hex, ucid) => lnLab.submitFundingTx(hex, ucid)} /> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Canaux du nœud A')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {channels.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('Aucun canal pour le moment.')}</p>
          ) : null}
          {channels.map((ch) => {
            const ready = ch.isReady || ch.isUsable;
            const conf = ch.confirmations ?? '0';
            const required = ch.confirmationsRequired ?? '6';
            return (
              <div key={ch.channelId} className="rounded-md border border-border/60 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{ch.channelId.slice(0, 24)}…</span>
                  <Badge variant="outline" className={cn('text-[9px]', ready ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400')}>
                    {ready ? t('prêt') : t('{c}/{r} confirmations', { c: conf, r: required })}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">{t('Capacité')}</p>
                    <p className="font-mono">{fmtInt(Number(ch.valueSats))} sats</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                      <ArrowUpRight className="h-3 w-3" /> {t('Sortant')}
                    </p>
                    <p className="font-mono">{fmtInt(msatToSats(ch.outboundMsat))} sats</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                      <ArrowDownLeft className="h-3 w-3" /> {t('Entrant')}
                    </p>
                    <p className="font-mono">{fmtInt(msatToSats(ch.inboundMsat))} sats</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => close(ch)}>
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

/* ─────────────────────────  Vue factures / paiements  ───────────────────────── */

function Bolt11Panel({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  const { toast } = useToast();
  const [amount, setAmount] = useState('21000');
  const [memo, setMemo] = useState('Café BitLab');
  const [invoice, setInvoice] = useState('');
  const [payInput, setPayInput] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setInvoice('');
    try {
      const sats = parseInt(amount, 10);
      if (!Number.isInteger(sats) || sats <= 0) throw new Error(t('Montant invalide.'));
      const bolt11 = await lnLab.createInvoice('B', sats * 1000, memo, 3600);
      setInvoice(bolt11);
      toast({ title: t('Facture créée'), description: t('Signée par le nœud B — faites-la payer par A.') });
    } catch (e) {
      toast({ title: t('Création impossible'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pay = () => {
    if (!payInput.trim()) return;
    lnLab.payInvoice('A', payInput.trim(), null);
    setPayInput('');
    toast({ title: t('Paiement lancé'), description: t('Le HTLC circule sur le canal A → B.') });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <QrCode className="h-4 w-4 text-amber-400" /> {t('Créer une facture BOLT11 (nœud B)')}
          </CardTitle>
          <CardDescription>{t('Une facture neuve à chaque paiement : montant verrouillé, expiration d’une heure.')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-36 space-y-1">
            <Label htmlFor="amt" className="text-[10px] uppercase text-muted-foreground">
              {t('Montant (sats)')}
            </Label>
            <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 font-mono text-xs" />
          </div>
          <div className="w-52 flex-1 space-y-1">
            <Label htmlFor="memo" className="text-[10px] uppercase text-muted-foreground">
              {t('Description')}
            </Label>
            <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={create} disabled={busy || !st.connected}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {t('Créer')}
          </Button>
        </CardContent>
        {invoice ? (
          <CardContent className="space-y-2 border-t border-border/40 pt-3">
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
            <ArrowUpRight className="h-4 w-4 text-amber-400" /> {t('Payer une facture (nœud A)')}
          </CardTitle>
          <CardDescription>{t('Collez une facture lntb…/lntbs… : le montant est déjà inscrit dedans.')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-1">
            <Label htmlFor="b11" className="text-[10px] uppercase text-muted-foreground">
              BOLT11
            </Label>
            <Input
              id="b11"
              value={payInput}
              onChange={(e) => setPayInput(e.target.value)}
              placeholder="lntb… / lntbs…"
              className="h-8 font-mono text-xs"
            />
          </div>
          <Button size="sm" onClick={pay} disabled={!st.connected || !payInput.trim()}>
            {t('Payer')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────  BOLT12 — offers réutilisables  ───────────────────── */

/** Bandeau pédagogique : les deux protocoles côte à côte, à lire avant d’agir. */
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
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{t(it.desc)}</p>
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
  const [offer, setOffer] = useState('');
  const [payInput, setPayInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [decoded, setDecoded] = useState<LnOfferView | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setOffer('');
    try {
      const sats = parseInt(amount, 10);
      if (!Number.isInteger(sats) || sats < 0) throw new Error(t('Montant invalide.'));
      const lno = await lnLab.createOffer('B', sats > 0 ? sats * 1000 : null, memo);
      setOffer(lno);
      toast({ title: t('Offer créée'), description: t('Signée par le nœud B — réutilisable autant de fois que voulu.') });
    } catch (e) {
      toast({ title: t('Création impossible'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const decode = async () => {
    const raw = payInput.trim();
    if (!raw) return;
    try {
      setDecoded(await lnLab.decodeOffer(raw));
    } catch (e) {
      setDecoded(null);
      toast({ title: t('Offer illisible'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  const pay = () => {
    const raw = payInput.trim();
    if (!raw) return;
    const freeAmount = !decoded || decoded.amountMsat === '';
    let amountMsat: number | null = null;
    if (freeAmount) {
      const sats = parseInt(payAmount, 10);
      if (!Number.isInteger(sats) || sats <= 0) {
        toast({
          title: t('Montant requis'),
          description: t('Cette offer ne fixe pas de montant : indiquez combien payer.'),
          variant: 'destructive',
        });
        return;
      }
      amountMsat = sats * 1000;
    }
    lnLab.payOffer('A', raw, amountMsat, payNote.trim() || null);
    setPayInput('');
    setPayAmount('');
    setPayNote('');
    setDecoded(null);
    toast({ title: t('Demande de facture envoyée'), description: t('A interroge B via messages onion chiffrés, puis paie la facture retournée. Suivez le journal.') });
  };

  const freeAmount = !decoded || decoded.amountMsat === '';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <InfinityIcon className="h-4 w-4 text-violet-400" /> {t('Créer une offer BOLT12 (nœud B)')}
          </CardTitle>
          <CardDescription>{t('Un même code lno1… pour un nombre illimité de paiements. Montant facultatif : laissez 0 pour un paiement libre.')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-44 space-y-1">
            <Label htmlFor="oamt" className="text-[10px] uppercase text-muted-foreground">
              {t('Montant (sats, 0 = libre)')}
            </Label>
            <Input id="oamt" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 font-mono text-xs" />
          </div>
          <div className="w-52 flex-1 space-y-1">
            <Label htmlFor="omemo" className="text-[10px] uppercase text-muted-foreground">
              {t('Description')}
            </Label>
            <Input id="omemo" value={memo} onChange={(e) => setMemo(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={create} disabled={busy || !st.connected}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <InfinityIcon className="h-3.5 w-3.5" />}
            {t('Créer l’offer')}
          </Button>
        </CardContent>
        {offer ? (
          <CardContent className="space-y-2 border-t border-border/40 pt-3">
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
            <ArrowUpRight className="h-4 w-4 text-violet-400" /> {t('Payer une offer (nœud A)')}
          </CardTitle>
          <CardDescription>{t('Le nœud A demande d’abord une facture au destinataire via messages onion chiffrés, puis la paie sur le canal.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="b12" className="text-[10px] uppercase text-muted-foreground">
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
            <Button size="sm" variant="outline" onClick={decode} disabled={!st.connected || !payInput.trim()}>
              {t('Vérifier')}
            </Button>
          </div>
          {decoded ? (
            <div className="space-y-1 rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Description')}</span>
                <span className="truncate">{decoded.description || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('Montant')}</span>
                <span className="font-mono">
                  {decoded.amountMsat ? `${fmtInt(msatToSats(decoded.amountMsat))} sats` : t('montant libre')}
                </span>
              </div>
              {decoded.signingPubkey ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('Émetteur')}</span>
                  <span className="truncate font-mono text-[10px]">{decoded.signingPubkey.slice(0, 24)}…</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            {freeAmount ? (
              <div className="w-40 space-y-1">
                <Label htmlFor="payamt" className="text-[10px] uppercase text-muted-foreground">
                  {t('Montant (sats)')}
                </Label>
                <Input id="payamt" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-8 font-mono text-xs" />
              </div>
            ) : null}
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor="paynote" className="text-[10px] uppercase text-muted-foreground">
                {t('Note au payeur (facultatif)')}
              </Label>
              <Input id="paynote" value={payNote} onChange={(e) => setPayNote(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" onClick={pay} disabled={!st.connected || !payInput.trim() || (freeAmount && !payAmount.trim())}>
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

/* ─────────────────────────  Vue journal  ───────────────────────── */

function JournalView({ st }: { st: LnLabStatus }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Événements Lightning')}</CardTitle>
        </CardHeader>
        <CardContent>
          {st.events.length === 0 ? <p className="text-xs text-muted-foreground">{t('Aucun événement pour le moment.')}</p> : null}
          {st.events.map((e, i) => (
            <EventLine key={eventId(e, i)} e={e} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" /> {t('Diffusions on-chain')}
          </CardTitle>
          <CardDescription>{t('Transactions émises par les nœuds (financement, fermeture, sanctions).')}</CardDescription>
        </CardHeader>
        <CardContent>
          {st.broadcasts.length === 0 ? <p className="text-xs text-muted-foreground">{t('Aucune diffusion pour le moment.')}</p> : null}
          {st.broadcasts.map((b, i) => (
            <div key={`${b.at}-${i}`} className="flex items-center gap-2 border-b border-border/40 py-1.5 text-xs last:border-0">
              {b.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
              <span className="font-mono text-[10px] text-muted-foreground">{new Date(b.at).toLocaleTimeString()}</span>
              <span className="flex-1 truncate font-mono text-[10px]">{b.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('Journal LDK')}</CardTitle>
          <CardDescription>{t('Sorties brutes des nœuds (niveau LDK) : A en émeraude, B en violet, messages système en bleu.')}</CardDescription>
        </CardHeader>
        <CardContent className="max-h-72 space-y-0.5 overflow-y-auto rounded-md bg-muted/30 p-3 font-mono text-[10px] leading-relaxed scrollbar-thin">
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
              <span className="min-w-0 break-all text-muted-foreground">{l.line}</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────  Module principal  ───────────────────────── */

export function LightningModule() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const st = useLnStatus();
  const supported = (LN_NETWORKS as string[]).includes(net);
  const lnNet = supported ? (net as LnNetId) : null;
  const active = st.phase === 'ready' || st.phase === 'booting' || st.phase === 'stopping';
  const onSameNetwork = st.network === lnNet;

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
              <Switch checked={active && onSameNetwork} onCheckedChange={toggle} />
              <div>
                <p className="text-sm font-medium">{t('Activer le laboratoire')}</p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Démarre deux nœuds Lightning dans ce navigateur ({net}). Désactivé, aucune ressource n’est consommée.',
                    { net: NETWORKS[lnNet].label },
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {st.phase === 'ready' && onSameNetwork ? (
                <Badge variant="outline" className={cn('gap-1 text-[9px]', st.connected ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400')}>
                  {st.connected ? <Link2 className="h-2.5 w-2.5" /> : <Unplug className="h-2.5 w-2.5" />}
                  {st.connected ? t('A connecté à B') : t('pairs déconnectés')}
                </Badge>
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
                <ChannelsView st={st} />
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
            <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
          <p className="text-xs text-muted-foreground">
            {t('Efface les graines, canaux et données locales des deux nœuds sur ce réseau. Les fonds on-chain du canal seront perdus si des canaux sont ouverts.')}
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
                  toast({ title: t('Laboratoire réinitialisé'), description: t('Toutes les données Lightning locales ont été supprimées.') });
                }}
              >
                {t('Confirmer la suppression')}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setConfirming(false)}>
                {t('Annuler')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setConfirming(true)}>
              {t('Réinitialiser…')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
