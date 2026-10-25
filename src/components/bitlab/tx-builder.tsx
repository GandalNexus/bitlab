'use client';

/**
 * BitLab — Constructeur de Transactions (2.2 & 2.3 du cahier des charges).
 * Workflow par étapes (Stepper) : Sélectionner → Construire → Signer → Diffuser.
 * Sélection d'UTXO, frais en sat/vB avec estimation temps réel, scripts multisig,
 * signature locale et sérialisation hexadécimale brute.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  ExternalLink,
  Hammer,
  ListChecks,
  PenTool,
  Send,
  Server,
  Wand2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Copyable, JsonBlock, PageIntro } from './bits';
import { useLabStore, useActiveWallet } from '@/lib/store';
import { TYPE_INFO, type LabWallet } from '@/lib/bitcoin/keys';
import { api, mpBroadcast, explorerBase } from '@/lib/mempool';
import { DEFAULT_NET, NETWORKS } from '@/lib/networks';
import {
  buildSignedTx,
  decodeRawTx,
  createMultisig,
  estimateVsize,
  DUST_LIMIT,
  type Utxo,
} from '@/lib/bitcoin/tx';
import { RX, satsToBtc, fmtInt } from '@/lib/bitcoin/utils';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Sélectionner', icon: ListChecks },
  { id: 2, label: 'Construire', icon: Hammer },
  { id: 3, label: 'Signer', icon: PenTool },
  { id: 4, label: 'Diffuser', icon: Send },
] as const;

/** Maturité des coinbase (règle de consensus) — les sorties de minage ne
 * sont dépensables qu'après 100 blocs, cf. moteur regtest embarqué. */
const COINBASE_MATURITY = 100;

interface OutputRow {
  address: string;
  amount: string;
}

/** Transaction signée prête pour diffusion (résultat de buildSignedTx). */
interface SignedTx {
  hex: string;
  txid: string;
  feeSats: number;
  vsize: number;
  changeSats: number;
}

/** Étape 1 — choix du portefeuille parmi la bibliothèque active, puis sélection de ses UTXO. */
function StepSelect({
  selected,
  setSelected,
  wallet,
  netWallets,
  activeWalletId,
  onPickWallet,
}: {
  selected: Utxo[];
  setSelected: (u: Utxo[]) => void;
  wallet: LabWallet | null;
  netWallets: LabWallet[];
  activeWalletId: string | null;
  onPickWallet: (id: string) => void;
}) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const fees = useQuery({ queryKey: ['fees', net], queryFn: api.fees, refetchInterval: 30_000, retry: 1 });
  const utxosQuery = useQuery({
    queryKey: ['utxos', net, wallet?.address],
    queryFn: () => {
      // Garde « enabled » ci-dessous : la branche d'erreur est inatteignable,
      // mais évite le `!` et garde la requête sûre en cas de refacto.
      if (!wallet) throw new Error('Portefeuille actif requis pour interroger les UTXO.');
      return api.utxos(wallet.address);
    },
    enabled: Boolean(wallet),
    refetchInterval: 30_000,
    retry: 1,
  });
  // Hauteur du tip : calcule la maturité restante des coinbase (champ
  // isCoinbase fourni par le moteur regtest embarqué uniquement).
  const tipQuery = useQuery({ queryKey: ['tip', net], queryFn: api.tipHeight, refetchInterval: 30_000, retry: 1 });
  const tip = tipQuery.data;

  if (!wallet) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <Coins className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium">{t('Aucun portefeuille actif')}</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {t('Créez un portefeuille dans le module « Portefeuille », obtenez des sats via un faucet, puis revenez construire votre transaction.')}
        </p>
      </div>
    );
  }

  const utxos = utxosQuery.data ?? [];
  const confirmed = utxos.filter((u) => u.status.confirmed);
  const pending = utxos.filter((u) => !u.status.confirmed);

  const toggle = (u: Utxo, on: boolean) =>
    setSelected(on ? [...selected, u] : selected.filter((s) => !(s.txid === u.txid && s.vout === u.vout)));

  return (
    <div className="space-y-4">
      {/* Choix du portefeuille parmi la bibliothèque du réseau actif */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Portefeuille utilisé pour cette transaction')}</Label>
            <Select value={wallet.id} onValueChange={onPickWallet}>
              <SelectTrigger className="w-full font-mono text-xs sm:w-96" aria-label={t('Choisir le portefeuille')}>
                <SelectValue placeholder={t('Choisir un portefeuille')} />
              </SelectTrigger>
              <SelectContent>
                {netWallets.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="font-mono text-xs">
                    {w.address.slice(0, 14)}…{w.address.slice(-6)} — {TYPE_INFO[w.type].tech}
                    {w.id === activeWalletId ? t(' · actif') : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {t('{n} portefeuille(s) {net} disponibles — changer de portefeuille réinitialise la sélection d’UTXO.', { n: netWallets.length, net: cfg.label })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Portefeuille sélectionné')}</div>
          <div className="mt-1 truncate font-mono text-xs">{wallet.address}</div>
          <Badge variant="outline" className="mt-1.5 border-primary/40 text-[10px] text-primary">
            {TYPE_INFO[wallet.type].tech}
          </Badge>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Frais réseau actuels')}</div>
          {fees.isLoading ? (
            <div className="mt-1 font-mono text-xs text-muted-foreground">{t('chargement…')}</div>
          ) : fees.isError ? (
            <div className="mt-1 font-mono text-xs text-muted-foreground">{t('indisponible')}</div>
          ) : (
            <div className="mt-1 font-mono text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">min {fees.data?.economyFee}</span> ·{' '}
              <span className="text-primary">{fees.data?.halfHourFee}</span> ·{' '}
              <span className="text-red-600 dark:text-red-400">max {fees.data?.fastestFee}</span> sat/vB
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('UTXO sélectionnés')}</div>
          <div className="mt-1 font-mono text-xs">
            {selected.length} · <span className="text-primary">{fmtInt(selected.reduce((s, u) => s + u.value, 0))} sats</span>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('UTXO disponibles (Unspent Transaction Outputs)')}</h3>
          {utxosQuery.isFetching ? <span className="text-[10px] text-muted-foreground">{t('actualisation…')}</span> : null}
        </div>
        {utxosQuery.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : utxos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            {t('Aucun UTXO sur cette adresse. Alimentez-la via le faucet intégré du module Portefeuille, ou choisissez un autre portefeuille ci-dessus.')}
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {[...confirmed, ...pending].map((u) => {
              const idx = selected.findIndex((s) => s.txid === u.txid && s.vout === u.vout);
              const checked = idx >= 0;
              // Coinbase immatures : dépensables après COINBASE_MATURITY blocs
              // (hauteur de dépense = tip + 1, comme chez Bitcoin Core).
              const matureIn =
                u.isCoinbase && tip != null && u.status.block_height != null
                  ? Math.max(0, COINBASE_MATURITY - (tip + 1 - u.status.block_height))
                  : null;
              return (
                <label
                  key={`${u.txid}:${u.vout}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    checked ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={(v) => toggle(u, Boolean(v))} aria-label={t('Sélectionner UTXO {id}', { id: u.txid.slice(0, 8) })} />
                  <div className="min-w-0 flex-1 font-mono text-[11px]">
                    <div className="truncate">{u.txid.slice(0, 18)}…{u.txid.slice(-8)} : {u.vout}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {u.status.confirmed ? t('confirmé') : t('en attente')} · {t('hauteur {n}', { n: u.status.block_height ?? '—' })}
                    </div>
                    {u.isCoinbase ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="border-amber-500/40 px-1.5 py-0 text-[9px] text-amber-600 dark:text-amber-400">
                          coinbase
                        </Badge>
                        {matureIn != null ? (
                          matureIn > 0 ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">
                              {t('mûr dans {n} bloc(s) — non dépensable avant', { n: matureIn })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{t('coinbase mûre (100 confirmations)')}</span>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm text-primary">{fmtInt(u.value)}</div>
                    <div className="text-[10px] text-muted-foreground">sats</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Étape 2 — sorties, frais et aperçu multisig. */
function StepBuild({
  selected,
  outputs,
  setOutputs,
  feeRate,
  setFeeRate,
  changeAddress,
  setChangeAddress,
  wallet,
}: {
  selected: Utxo[];
  outputs: OutputRow[];
  setOutputs: (o: OutputRow[]) => void;
  feeRate: number;
  setFeeRate: (n: number) => void;
  changeAddress: string;
  setChangeAddress: (a: string) => void;
  wallet: LabWallet | null;
}) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const fees = useQuery({ queryKey: ['fees', net], queryFn: api.fees, refetchInterval: 60_000, retry: 1 });

  const active = wallet;

  const totalIn = selected.reduce((s, u) => s + u.value, 0);
  const totalOut = outputs.reduce((s, o) => s + (parseInt(o.amount, 10) || 0), 0);
  const [showMs, setShowMs] = useState(false);

  const est = useMemo(() => {
    if (!active || selected.length === 0) return null;
    const validOutputs = outputs.filter((o) => RX.btcAddress.test(o.address.trim()) && parseInt(o.amount, 10) > 0);
    if (validOutputs.length === 0) return null;
    const changeAddr = changeAddress.trim() || active.address;
    const vsize = estimateVsize(
      active.type,
      selected.length,
      validOutputs.map((o) => ({ address: o.address.trim(), amountSats: parseInt(o.amount, 10) })),
      true,
      changeAddr,
    );
    const fee = Math.ceil(vsize * feeRate);
    return { vsize, fee, change: totalIn - totalOut - fee };
  }, [active, selected.length, outputs, feeRate, totalIn, totalOut, changeAddress]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm">{t('Sorties de la transaction')}</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={() => setOutputs([...outputs, { address: '', amount: '' }])}
          >
            {t('+ sortie')}
          </Button>
        </div>
        <div className="space-y-2">
          {outputs.map((o, i) => {
            const addr = o.address.trim();
            const badAddr = addr.length > 0 && !RX.btcAddress.test(addr);
            const amt = parseInt(o.amount, 10);
            const badAmt = o.amount.length > 0 && (!Number.isInteger(amt) || amt < DUST_LIMIT);
            return (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('Adresse destinataire')}</Label>
                <Input
                  value={o.address}
                  onChange={(e) => setOutputs(outputs.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))}
                  placeholder={`${NETWORKS[net].addressHint} (${NETWORKS[net].label})`}
                  className="font-mono text-xs"
                />
                {badAddr ? (
                  <p className="text-[10px] text-red-600 dark:text-red-400">
                    {t('Adresse invalide pour {net} — format attendu : {hint}', { net: NETWORKS[net].label, hint: NETWORKS[net].addressHint })}
                  </p>
                ) : null}
              </div>
              <div className="w-full space-y-1 sm:w-40">
                <Label className="text-[10px] text-muted-foreground">{t('Montant (sats)')}</Label>
                <Input
                  value={o.amount}
                  inputMode="numeric"
                  onChange={(e) => setOutputs(outputs.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9]/g, '') } : x)))}
                  placeholder="10000"
                  className="font-mono text-xs"
                />
                {badAmt ? (
                  <p className="text-[10px] text-red-600 dark:text-red-400">{t('Montant en sats entiers requis (≥ 546).')}</p>
                ) : null}
              </div>
              {outputs.length > 1 ? (
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 self-end text-muted-foreground hover:text-red-400" onClick={() => setOutputs(outputs.filter((_, j) => j !== i))} aria-label={t('Retirer cette sortie')}>
                  <XCircle className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('Taux de frais :')} <span className="font-mono text-primary">{feeRate} sat/vB</span></Label>
            {fees.data ? (
              <button className="text-[10px] text-muted-foreground underline hover:text-primary" onClick={() => { if (fees.data) setFeeRate(fees.data.halfHourFee); }}>
                {t('utiliser l’estimation réseau ({n})', { n: fees.data.halfHourFee })}
              </button>
            ) : null}
          </div>
          <Slider
            value={[feeRate]}
            min={1}
            max={80}
            step={1}
            onValueChange={([v]) => setFeeRate(v)}
            className="mt-3"
            aria-label={t('Taux de frais en satoshis par octet virtuel')}
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{t('1 (économie)')}</span>
            <span>{t('~20 (rapide)')}</span>
            <span>{t('80 (prioritaire)')}</span>
          </div>
          {est ? (
            <div className="mt-3 space-y-1 border-t border-border/60 pt-2 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('vsize estimé')}</span><span>{est.vsize.toFixed(1)} vB</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('frais estimés')}</span><span className="text-amber-600 dark:text-amber-400">{fmtInt(est.fee)} sats ({satsToBtc(est.fee)} BTC)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('monnaie restante')}</span><span className={est.change < 0 ? 'text-red-600 dark:text-red-400' : est.change >= DUST_LIMIT ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{est.change < 0 ? t('sorties + frais supérieurs aux entrées') : est.change >= DUST_LIMIT ? `${fmtInt(est.change)} sats` : t('ajoutée aux frais (< 546)')}</span></div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border p-3">
          <Label className="text-xs">{t('Adresse de monnaie restante (change)')}</Label>
          <Input
            value={changeAddress}
            onChange={(e) => setChangeAddress(e.target.value)}
            placeholder={active?.address ?? 'tb1q…'}
            className="mt-2 font-mono text-xs"
          />
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            {t('Le reste des UTXO moins les frais revient sur cette adresse. Laissez vide pour abandonner la monnaie aux mineurs.')}
          </p>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
            <span className="text-muted-foreground">{t('total entrées')}</span>
            <span className="text-primary">{fmtInt(totalIn)} sats</span>
          </div>
        </div>
      </div>

      {/* Scripts avancés — multisig */}
      {active ? (
        <Collapsible open={showMs} onOpenChange={setShowMs}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-xs font-medium hover:border-primary/40">
            <span className="flex items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-primary" /> {t('Scripts avancés — construction multisig (m-de-n)')}
            </span>
            <span className="text-muted-foreground">{showMs ? '▲' : '▼'}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <MultisigPanel />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

/** Panneau multisig : agrégation des clés publiques du lab → adresse P2WSH. */
function MultisigPanel() {
  const wallets = useLabStore((s) => s.wallets);
  const { t } = useT();
  const [picked, setPicked] = useState<number[]>([]);
  const [m, setM] = useState(2);
  const [result, setResult] = useState<ReturnType<typeof createMultisig> | null>(null);
  const [err, setErr] = useState('');

  const build = () => {
    setErr('');
    setResult(null);
    try {
      const pubs = picked.map((i) => wallets[i].publicKeyHex);
      setResult(createMultisig(pubs, m));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t('Sélectionnez les clés publiques des portefeuilles du lab pour composer un portefeuille à seuil : dépenser exige la signature de {m} participants sur {n}. L’adresse combine les clés dans un script P2WSH (Miniscript compatible BDK).', { m: 'm', n: 'n' })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {wallets.map((w, i) => (
          <button
            key={w.id}
            onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
            className={cn(
              'rounded border px-2 py-1 font-mono text-[10px] transition-colors',
              picked.includes(i) ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
            )}
          >
            {w.address.slice(0, 10)}… ({TYPE_INFO[w.type].tech})
          </button>
        ))}
      </div>
      {picked.length >= 2 ? (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('Seuil m (de {n})', { n: picked.length })}</Label>
            <Select value={String(Math.min(m, picked.length))} onValueChange={(v) => setM(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: picked.length }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={build} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> {t('Générer l’adresse {m}-de-{n}', { m: Math.min(m, picked.length), n: picked.length })}
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{t('Sélectionnez au moins 2 portefeuilles.')}</p>
      )}
      {err ? <p className="text-[11px] text-red-600 dark:text-red-400">{t(err)}</p> : null}
      {result ? (
        <div className="space-y-2">
          <Copyable label={t('Adresse multisig {m}-de-{n} (P2WSH)', { m: result.m, n: result.n })} value={result.address} />
          <Copyable label={t('Script témoin (witness script)')} value={result.witnessScriptHex} display={result.witnessScriptHex.slice(0, 30) + '…'} />
          <p className="text-[10px] text-muted-foreground">
            {t('Pour dépenser, chaque participant signe la transaction ; la dernière signature déclenche la finalisation du script.')}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Étapes 3 & 4 — signature locale puis diffusion. La tuile « Diffuser »
 * n'apparaît qu'à l'étape 4 : à l'étape 3, une transaction signée affiche
 * son récapitulatif et une invitation à appuyer sur « Suivant ». */
function StepSignAndBroadcast({
  selected,
  outputs,
  feeRate,
  changeAddress,
  wallet,
  step,
  signed,
  signedValid,
  onSigned,
  onBroadcasted,
}: {
  selected: Utxo[];
  outputs: OutputRow[];
  feeRate: number;
  changeAddress: string;
  wallet: LabWallet | null;
  step: number;
  signed: SignedTx | null;
  /** false dès qu'une entrée/sortie/frais/portefeuille change après la signature. */
  signedValid: boolean;
  onSigned: (res: SignedTx) => void;
  onBroadcasted: (txid: string) => void;
}) {
  const active = wallet;
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const { t } = useT();
  const { toast } = useToast();
  const addLog = useLabStore((s) => s.addLog);
  const [signErr, setSignErr] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ ok: boolean; txid?: string; err?: string } | null>(null);
  const ready = signedValid && signed !== null;

  const sign = () => {
    setSignErr('');
    setBroadcastResult(null);
    try {
      if (!active) throw new Error('Aucun portefeuille actif.');
      // Diagnostic précis ligne par ligne : une saisie partielle ou un format
      // étranger (tb1… sur regtest) produit un message ciblé au lieu d'un
      // refus générique — l'utilisateur sait exactement quoi corriger.
      const cfg = NETWORKS[net];
      const validOutputs: { address: string; amountSats: number }[] = [];
      const problems: string[] = [];
      outputs.forEach((o, i) => {
        const addr = o.address.trim();
        const amt = parseInt(o.amount, 10);
        if (!addr && !o.amount.trim()) return; // ligne entièrement vide → ignorée
        if (!RX.btcAddress.test(addr)) {
          problems.push(
            addr
              ? t('Sortie {i} : l’adresse « {a} » n’est pas valide pour {net} — format attendu : {hint}', { i: i + 1, a: addr, net: cfg.label, hint: cfg.addressHint })
              : t('Sortie {i} : adresse destinataire manquante.', { i: i + 1 }),
          );
        } else if (!Number.isInteger(amt) || amt <= 0) {
          problems.push(t('Sortie {i} : montant invalide (entiers en sats requis).', { i: i + 1 }));
        } else {
          validOutputs.push({ address: addr, amountSats: amt });
        }
      });
      if (problems.length > 0) throw new Error(problems.join('\n'));
      if (validOutputs.length === 0) throw new Error('Renseignez au moins une sortie valide à l’étape Construire.');
      const res = buildSignedTx({
        utxos: selected,
        outputs: validOutputs,
        feeRateSatVb: feeRate,
        changeAddress: changeAddress.trim() || active.address,
        privateKeyHex: active.privateKeyHex,
        inputAddress: active.address,
        inputType: active.type,
      });
      addLog({ kind: 'op', module: 'transactions', label: 'transaction signée localement', detail: { txid: res.txid, frais: res.feeSats, vsize: res.vsize } });
      onSigned(res);
      toast({ title: t('Transaction signée'), description: t('Frais : {fee} sats · vsize {v} vB', { fee: res.feeSats, v: res.vsize }) });
    } catch (e) {
      setSignErr((e as Error).message);
      addLog({ kind: 'error', module: 'transactions', label: 'échec de signature', detail: { erreur: (e as Error).message } });
    }
  };

  const broadcast = async () => {
    if (!signed) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const txid = await mpBroadcast(signed.hex);
      setBroadcastResult({ ok: true, txid });
      onBroadcasted(txid);
      toast({ title: t('Transaction diffusée'), description: `TXID ${txid.slice(0, 16)}…` });
    } catch (e) {
      setBroadcastResult({ ok: false, err: (e as Error).message });
    } finally {
      setBroadcasting(false);
    }
  };

  const decoded = useMemo(() => (signed && signedValid ? decodeRawTx(signed.hex) : null), [signed, signedValid]);

  return (
    <div className="space-y-4">
      {!ready ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
            <PenTool className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-medium">{t('Signature locale avec la clé privée du portefeuille actif')}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              {t('La signature ECDSA/Schnorr est calculée dans votre navigateur. La transaction est ensuite sérialisée en hexadécimal brut (Raw Transaction) prêt pour le réseau.')}
            </p>
            <Button onClick={sign} className="mt-3 gap-1.5">
              <PenTool className="h-4 w-4" /> {t('Signer {n} UTXO → {m} sortie(s)', { n: selected.length, m: outputs.filter((o) => parseInt(o.amount, 10) > 0).length })}
            </Button>
          </div>
          {signed && !signedValid ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              {t('La transaction a été modifiée depuis la dernière signature — signez à nouveau.')}
            </div>
          ) : null}
          {signErr ? (
            <div className="whitespace-pre-line rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              <strong className="block font-semibold">{t('Signature impossible')}</strong>
              {t(signErr)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Frais réels')}</div>
              <div className="mt-1 font-mono text-lg text-emerald-600 dark:text-emerald-400">{fmtInt(signed.feeSats)} sats</div>
              <div className="text-[10px] text-muted-foreground">{satsToBtc(signed.feeSats)} BTC</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Taille virtuelle')}</div>
              <div className="mt-1 font-mono text-lg">{signed.vsize} vB</div>
              <div className="text-[10px] text-muted-foreground">{t('{r} sat/vB réel', { r: (signed.feeSats / signed.vsize).toFixed(2) })}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Monnaie rendue')}</div>
              <div className="mt-1 font-mono text-lg">{signed.changeSats > 0 ? `${fmtInt(signed.changeSats)} sats` : '—'}</div>
              <div className="text-[10px] text-muted-foreground">{signed.changeSats > 0 ? satsToBtc(signed.changeSats) + ' BTC' : t('pas de sortie de change')}</div>
            </div>
          </div>

          <Copyable label={t('Transaction brute signée (Raw Transaction hexadécimale)')} value={signed.hex} display={signed.hex.slice(0, 46) + '…' + signed.hex.slice(-12)} className="text-[11px]" />

          {decoded ? (
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-xs font-medium hover:border-primary/40">
                {t('Contenu décodé de la transaction ({i} entrée(s), {o} sortie(s))', { i: decoded.inputs.length, o: decoded.outputs.length })}
                <span className="text-muted-foreground">▼</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <JsonBlock data={decoded} />
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          {step === 4 ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Server className="h-4 w-4 text-primary" /> {t('Diffusion au réseau {net}', { net: cfg.label })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('Seul le corps de transaction signé est envoyé au nœud via le proxy Edge — la clé privée reste locale.')}
              </p>
              <Button onClick={broadcast} disabled={broadcasting} className="mt-3 gap-1.5">
                <Send className="h-4 w-4" /> {broadcasting ? t('Diffusion en cours…') : t('Diffuser sur {net}', { net: cfg.label })}
              </Button>
              {broadcastResult?.ok ? (
                <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> {t('Transaction acceptée par le réseau')}
                  </div>
                  {explorerBase() ? (
                    <a
                      href={`${explorerBase()}/tx/${broadcastResult.txid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-300 underline underline-offset-2"
                    >
                      {broadcastResult.txid} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <>
                      <div className="mt-2 truncate font-mono text-[11px] text-emerald-600 dark:text-emerald-300" title={broadcastResult.txid}>
                        {broadcastResult.txid}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {t('Retrouvez-la dans l’Explorateur — cliquez la transaction pour son anatomie locale.')}
                      </p>
                    </>
                  )}
                </div>
              ) : null}
              {broadcastResult && !broadcastResult.ok ? (
                <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                  <strong className="block">{t('Diffusion refusée')}</strong>
                  {t(broadcastResult.err ?? '')}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {t('Transaction signée — prête pour la diffusion.')}
              </div>
              <p className="mt-1 text-xs text-emerald-600/90 dark:text-emerald-400/90">
                {t('Appuyez sur « Suivant » pour passer à l’étape Diffuser.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Composant principal : Stepper 4 étapes. */
export function TxBuilder() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const wallets = useLabStore((s) => s.wallets);
  const activeWalletId = useLabStore((s) => s.activeWalletId);
  const active = useActiveWallet();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Utxo[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([{ address: '', amount: '' }]);
  const [feeRate, setFeeRate] = useState(5);
  const [changeAddress, setChangeAddress] = useState('');
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  // Transaction signée remontée ici : l'étape Diffuser n'est accessible (bouton
  // « Suivant ») qu'avec une signature VALIDE — et la signature est invalidée
  // dès qu'un paramètre de la transaction change (empreinte signFp).
  const [signed, setSigned] = useState<SignedTx | null>(null);
  const [signedFp, setSignedFp] = useState('');
  // Portefeuille choisi pour ce workflow — le portefeuille « actif » est la valeur par défaut,
  // mais l'utilisateur peut en sélectionner n'importe lequel de sa bibliothèque du réseau actif.
  const [walletId, setWalletId] = useState<string | null>(null);

  // Bibliothèque filtrée par réseau actif (aucune opération croisée possible).
  const netWallets = useMemo(
    () => wallets.filter((w) => (w.network ?? DEFAULT_NET) === net),
    [wallets, net],
  );
  const wallet = useMemo(
    () => netWallets.find((w) => w.id === walletId) ?? active ?? netWallets[0] ?? null,
    [netWallets, walletId, active],
  );

  // Empreinte des paramètres de signature : UTXO choisis, sorties, frais,
  // change et portefeuille. Toute différence avec l'empreinte enregistrée au
  // moment de signer rend la transaction signée obsolète (jamais diffusée).
  const signFp = useMemo(
    () =>
      JSON.stringify({
        sel: selected.map((u) => [u.txid, u.vout, u.value]),
        out: outputs,
        feeRate,
        chg: changeAddress,
        w: wallet?.address ?? '',
        ty: wallet?.type ?? '',
      }),
    [selected, outputs, feeRate, changeAddress, wallet?.address, wallet?.type],
  );
  const signedValid = Boolean(signed) && signedFp === signFp;

  const pickWallet = (id: string) => {
    if (id === wallet?.id) return;
    setWalletId(id);
    setSelected([]); // les UTXO appartiennent à l'adresse — la sélection est invalide après changement
    setSigned(null);
    setSignedFp('');
    setLastTxid(null);
    setStep(1);
  };

  const reset = () => {
    setStep(1);
    setSelected([]);
    setOutputs([{ address: '', amount: '' }]);
    setChangeAddress('');
    setSigned(null);
    setSignedFp('');
    setLastTxid(null);
  };

  // Étape 3 (Signer) : « Suivant » exige une transaction signée ET à jour —
  // la tuile Diffuser n'est donc jamais montrée avant l'étape 4.
  const canNext = step === 1 ? selected.length > 0 : step === 3 ? signedValid : true;

  return (
    <div className="space-y-4">
      <PageIntro
        title={t('Constructeur de transactions')}
        desc={t('Sélection des UTXO, définition des sorties, frais en sat/vB, signature locale puis diffusion {net}.', { net: cfg.label })}
        actions={
          <Button variant="outline" size="sm" onClick={reset} className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('Réinitialiser')}
          </Button>
        }
      />
      <Card>
      <CardHeader className="pb-4">
        {/* Stepper */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = lastTxid ? true : step > s.id;
            const current = !lastTxid && step === s.id;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => !lastTxid && setStep(s.id)}
                  disabled={Boolean(lastTxid)}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    current && 'border-primary bg-primary text-primary-foreground',
                    done && !current && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    !done && !current && 'border-border text-muted-foreground',
                  )}
                >
                  {done && !current ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{t(s.label)}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>
                {i < STEPS.length - 1 ? <div className={cn('mx-1 h-px w-4 sm:w-8', step > s.id || lastTxid ? 'bg-emerald-500/50' : 'bg-border')} /> : null}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {step === 1 ? (
          <StepSelect
            selected={selected}
            setSelected={setSelected}
            wallet={wallet}
            netWallets={netWallets}
            activeWalletId={activeWalletId}
            onPickWallet={pickWallet}
          />
        ) : null}
        {step === 2 ? (
          <StepBuild
            selected={selected}
            outputs={outputs}
            setOutputs={setOutputs}
            feeRate={feeRate}
            setFeeRate={setFeeRate}
            changeAddress={changeAddress}
            setChangeAddress={setChangeAddress}
            wallet={wallet}
          />
        ) : null}
        {step >= 3 ? (
          <StepSignAndBroadcast
            key={wallet?.id ?? 'none'}
            step={step}
            selected={selected}
            outputs={outputs}
            feeRate={feeRate}
            changeAddress={changeAddress}
            wallet={wallet}
            signed={signed}
            signedValid={signedValid}
            onSigned={(res) => {
              setSigned(res);
              setSignedFp(signFp);
            }}
            onBroadcasted={(txid) => {
              setLastTxid(txid);
            }}
          />
        ) : null}

        {!lastTxid ? (
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> {t('Précédent')}
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canNext || step === 4}
              className="gap-1"
            >
              {t('Suivant')} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-between border-t border-emerald-500/30 pt-4">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {t('Transaction diffusée — surveillez-la dans l’explorateur.')}
            </div>
            <Button size="sm" variant="outline" onClick={reset}>{t('Nouvelle transaction')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
