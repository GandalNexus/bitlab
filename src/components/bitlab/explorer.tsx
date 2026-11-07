'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Binary, ChevronDown, ExternalLink, Radio, ScanSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copyable, PageIntro, StatCard, TypeBadge } from './bits';
import { api, type BlockSummary } from '@/lib/mempool';
import { useLabStore } from '@/lib/store';
import { NETWORKS } from '@/lib/networks';
import { decodeRawTx, type DecodedTx } from '@/lib/bitcoin/tx';
import { fmtInt, satsToBtc } from '@/lib/bitcoin/utils';
import { tLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function MempoolLive() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const mempool = useQuery({
    queryKey: ['mempool', net],
    queryFn: api.mempool,
    refetchInterval: 15_000,
    retry: 1,
  });
  const recent = useQuery({
    queryKey: ['mempool-recent', net],
    queryFn: api.mempoolRecent,
    refetchInterval: 15_000,
    retry: 1,
  });
  const blocks = useQuery({
    queryKey: ['blocks', net],
    queryFn: api.recentBlocks,
    refetchInterval: 60_000,
    retry: 1,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title={t('Transactions en attente')}
          value={mempool.data ? fmtInt(mempool.data.count) : '—'}
          sub={
            mempool.data
              ? t('{v} MvB occupés', { v: (mempool.data.vsize / 1e6).toFixed(2) })
              : `mempool ${cfg.label}`
          }
          icon={<Radio className="h-4 w-4" />}
          loading={mempool.isLoading}
          accent
        />
        <StatCard
          title={t('Frais totaux en attente')}
          value={
            mempool.data ? `${fmtInt(Math.round(mempool.data.total_fee / 1e5) / 10)} M sats` : '—'
          }
          sub={t('cumul des frais de la file d’attente')}
          icon={<Binary className="h-4 w-4" />}
          loading={mempool.isLoading}
        />
        <StatCard
          title={t('Flux récent')}
          value={recent.data ? `${recent.data.length} tx` : '—'}
          sub={t('échantillon des dernières transmissions')}
          icon={<Radio className="h-4 w-4" />}
          loading={recent.isLoading}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="text-primary h-4 w-4 animate-pulse" />{' '}
            {t('Dernières transactions observées (rafraîchi toutes les 15 s)')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/50 h-10 animate-pulse rounded-md" />
              ))}
            </div>
          ) : recent.isError ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <AlertCircle className="h-4 w-4" />{' '}
              {t(
                'Nœud {net} momentanément injoignable — nouvelle tentative automatique en cours.',
                { net: cfg.label },
              )}
            </div>
          ) : (
            <div className="max-h-80 scrollbar-thin space-y-1.5 overflow-y-auto pr-1">
              {(recent.data ?? []).length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed py-8 text-center text-xs">
                  {t(
                    'Mempool vide — diffusez une transaction depuis le module Transactions et elle apparaîtra ici.',
                  )}
                </div>
              ) : (
                (recent.data ?? [])
                  .slice(0, 25)
                  .map((tx) => <TxRow key={tx.txid} txid={tx.txid} fee={tx.fee} vsize={tx.vsize} />)
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('Derniers blocs minés')}</CardTitle>
        </CardHeader>
        <CardContent>
          {blocks.isLoading ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-muted/50 h-16 animate-pulse rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {(blocks.data ?? []).slice(0, 6).map((b) => (
                <BlockRow key={b.id} block={b} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TxRow({ txid, fee, vsize }: { txid: string; fee?: number; vsize?: number }) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const external = NETWORKS[net].explorer;
  const [open, setOpen] = useState(false);
  const hexQuery = useQuery({
    queryKey: ['tx-hex', txid],
    queryFn: () => api.txHex(txid),
    enabled: !external && open,
    staleTime: Infinity,
    retry: 1,
  });
  const decoded = useMemo(() => {
    if (!hexQuery.data) return { ok: true as const, tx: null };
    try {
      return { ok: true as const, tx: decodeRawTx(hexQuery.data) };
    } catch (e) {
      return { ok: false as const, err: (e as Error).message };
    }
  }, [hexQuery.data]);

  if (external) {
    return (
      <a
        href={`${external}/tx/${txid}`}
        target="_blank"
        rel="noreferrer"
        className="border-border hover:border-primary/40 hover:bg-primary/5 flex items-center gap-3 rounded-md border px-3 py-2 transition-colors"
      >
        <span className="truncate font-mono text-[11px]">
          {txid.slice(0, 20)}…{txid.slice(-10)}
        </span>
        {vsize != null ? (
          <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
            {vsize} vB
          </span>
        ) : null}
        {fee != null && vsize ? (
          <span className="text-primary shrink-0 font-mono text-[11px]">
            {(fee / vsize).toFixed(1)} sat/vB
          </span>
        ) : null}
        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
      </a>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="border-border hover:border-primary/40 hover:bg-primary/5 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
      >
        <span className="truncate font-mono text-[11px]">
          {txid.slice(0, 20)}…{txid.slice(-10)}
        </span>
        {vsize != null ? (
          <span className="text-muted-foreground ml-auto shrink-0 font-mono text-[10px]">
            {vsize} vB
          </span>
        ) : null}
        {fee != null && vsize ? (
          <span className="text-primary shrink-0 font-mono text-[11px]">
            {(fee / vsize).toFixed(1)} sat/vB
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div className="border-border bg-muted/20 mt-1 rounded-md border p-3">
          {hexQuery.isLoading ? (
            <div className="bg-muted/50 h-24 animate-pulse rounded-md" />
          ) : hexQuery.isError ? (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> {t(hexQuery.error.message)}
            </div>
          ) : !decoded.ok ? (
            <div className="text-xs text-red-600 dark:text-red-400">{t(decoded.err)}</div>
          ) : decoded.tx ? (
            <div className="space-y-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] italic">
                <ScanSearch className="h-3 w-3" />{' '}
                {t('Anatomie décodée localement — aucun explorateur public sur ce réseau.')}
              </p>
              <DecodedTxView decoded={decoded.tx} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BlockRow({ block }: { block: BlockSummary }) {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const external = NETWORKS[net].explorer;
  const [open, setOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ['block-detail', block.id],
    queryFn: () => api.block(block.id),
    enabled: !external && open,
    staleTime: Infinity,
    retry: 1,
  });

  if (external) {
    return (
      <a
        href={`${external}/block/${block.id}`}
        target="_blank"
        rel="noreferrer"
        className="border-border hover:border-primary/40 rounded-lg border p-3 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-primary font-mono text-sm font-semibold">
            #{fmtInt(block.height)}
          </span>
          <span className="text-muted-foreground text-[10px]">{block.tx_count} tx</span>
        </div>
        <div className="text-muted-foreground mt-1 text-[10px]">
          {new Date(block.timestamp * 1000).toLocaleTimeString(tLocale())} ·{' '}
          {(block.size / 1e6).toFixed(2)} {t('Mo')}
        </div>
      </a>
    );
  }

  const detail = detailQuery.data;
  return (
    <div className="border-border rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:bg-primary/5 w-full rounded-lg p-3 text-left transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-primary font-mono text-sm font-semibold">
            #{fmtInt(block.height)}
          </span>
          <span className="text-muted-foreground text-[10px]">{block.tx_count} tx</span>
        </div>
        <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-[10px]">
          <span>
            {new Date(block.timestamp * 1000).toLocaleTimeString(tLocale())} ·{' '}
            {(block.size / 1e6).toFixed(2)} {t('Mo')}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>
      {open ? (
        <div className="border-border/60 border-t p-3">
          {detailQuery.isLoading ? (
            <div className="bg-muted/50 h-24 animate-pulse rounded-md" />
          ) : detailQuery.isError || !detail ? (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />{' '}
              {t(detailQuery.error?.message ?? 'Bloc indisponible.')}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="border-border bg-muted/20 rounded-md border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">
                    {t('hash du bloc')}
                  </div>
                  <div className="truncate font-mono text-[11px]" title={detail.id}>
                    {detail.id.slice(0, 18)}…
                  </div>
                </div>
                <div className="border-border bg-muted/20 rounded-md border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">
                    {t('racine de Merkle')}
                  </div>
                  <div className="truncate font-mono text-[11px]" title={detail.merkle_root ?? ''}>
                    {detail.merkle_root ? `${detail.merkle_root.slice(0, 18)}…` : '—'}
                  </div>
                </div>
                <div className="border-border bg-muted/20 rounded-md border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">
                    {t('bloc précédent')}
                  </div>
                  <div
                    className="truncate font-mono text-[11px]"
                    title={detail.previousblockhash ?? ''}
                  >
                    {detail.previousblockhash ? `${detail.previousblockhash.slice(0, 18)}…` : '—'}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
                  {t('Transactions du bloc ({n})', { n: detail.txids.length })}
                </h4>
                <div className="max-h-72 scrollbar-thin space-y-1.5 overflow-y-auto pr-1">
                  {detail.txids.map((txid) => (
                    <TxRow key={txid} txid={txid} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TxDecoder() {
  const { toast } = useToast();
  const { t } = useT();
  const [raw, setRaw] = useState('');
  const [decoded, setDecoded] = useState<DecodedTx | null>(null);
  const [err, setErr] = useState('');

  const decode = () => {
    setErr('');
    setDecoded(null);
    try {
      const d = decodeRawTx(raw);
      setDecoded(d);
      toast({
        title: t('Transaction décodée'),
        description: t('{i} entrée(s) · {o} sortie(s)', {
          i: d.inputs.length,
          o: d.outputs.length,
        }),
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const loadSample = () => {
    setRaw(
      '020000000001016d1e5c8f3c7d5c0c0d9d9bfad825e7a4f5e63248c6ac7f687e32a228dc80e1150000000000ffffffff0210270000000000001600149682b3791530a7ffc35569ff7a7fefbcbef53a06b699000000000000160014924ff042f8897a2fddd9581f0c7609d9800b5d8f02483045022100ef400c50530ff5c057cea829713e5bce943cc56ad9d95fcbf290fd298259921b0220792032fb55230681a4a0ff8482b944a592ff5bec607573058178af6678a4f1540121034bda180047030ee0228822ac8900c7b4d4c6352e2e0d763cac184063b5fafe3a00000000',
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScanSearch className="text-primary h-4 w-4" /> {t('Décodeur de transaction brute')}
          </CardTitle>
          <CardDescription>
            {t(
              'Collez une transaction hexadécimale (raw tx) pour l’inspecter champ par champ : version, entrées, sorties, témoin SegWit. Le décodage s’effectue localement dans votre navigateur.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={t('02000000000101…  (hexadécimal de la transaction)')}
            className="hex-wrap min-h-28 font-mono text-[11px]"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={decode} disabled={!raw.trim()} className="gap-1.5">
              <ScanSearch className="h-4 w-4" /> {t('Décoder localement')}
            </Button>
            <Button variant="outline" onClick={loadSample} className="gap-1.5">
              {t('Charger un exemple')}
            </Button>
          </div>
          {err ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {t(err)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {decoded ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t('Résultat du décodage')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DecodedTxView decoded={decoded} />
            <Copyable label={t('Hexadécimal analysé')} value={raw.trim().replace(/\s+/g, '')} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DecodedTxView({ decoded }: { decoded: DecodedTx }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="border-border rounded-md border p-2.5">
          <div className="text-muted-foreground text-[10px] uppercase">TXID</div>
          <div className="truncate font-mono text-xs">{decoded.txid}</div>
        </div>
        <div className="border-border rounded-md border p-2.5">
          <div className="text-muted-foreground text-[10px] uppercase">Version</div>
          <div className="font-mono text-xs">{decoded.version}</div>
        </div>
        <div className="border-border rounded-md border p-2.5">
          <div className="text-muted-foreground text-[10px] uppercase">{t('Taille')}</div>
          <div className="font-mono text-xs">
            {t('{b} octets · {v} vB', { b: decoded.sizeBytes, v: decoded.vsize })}
          </div>
        </div>
        <div className="border-border rounded-md border p-2.5">
          <div className="text-muted-foreground text-[10px] uppercase">{t('État')}</div>
          <Badge
            variant="outline"
            className={
              decoded.isSigned
                ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
            }
          >
            {decoded.isSigned ? t('signée') : t('non signée')}
          </Badge>
        </div>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
          {t('Entrées ({n})', { n: decoded.inputs.length })}
        </h4>
        <div className="space-y-1.5">
          {decoded.inputs.map((inp) => (
            <div
              key={inp.index}
              className="border-border bg-muted/20 rounded-md border p-2.5 font-mono text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="text-primary">
                  {inp.txid
                    ? `${inp.txid.slice(0, 18)}…:${inp.vout}`
                    : t('(coinbase ou txid absent)')}
                </span>
              </div>
              {inp.scriptSigHex ? (
                <div className="text-muted-foreground mt-1 truncate text-[10px]">
                  scriptSig : {inp.scriptSigHex}
                </div>
              ) : null}
              {inp.witness.length > 0 ? (
                <div className="text-muted-foreground mt-1 text-[10px]">
                  {t('witness : {n} élément(s) — {w}…', {
                    n: inp.witness.length,
                    w: inp.witness[0].slice(0, 20),
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
          {t('Sorties ({n})', { n: decoded.outputs.length })}
        </h4>
        <div className="space-y-1.5">
          {decoded.outputs.map((out) => (
            <div key={out.index} className="border-border bg-muted/20 rounded-md border p-2.5">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-primary">{satsToBtc(out.valueSats)} BTC</span>
                <span className="text-muted-foreground">({fmtInt(out.valueSats)} sats)</span>
                <TypeBadge type={out.type} />
                {out.address ? (
                  <span className="truncate text-emerald-600 dark:text-emerald-300">
                    {out.address}
                  </span>
                ) : null}
              </div>
              {out.opReturnText ? (
                <div className="text-muted-foreground mt-1 text-[10px] italic">
                  OP_RETURN : « {out.opReturnText} »
                </div>
              ) : null}
              <div className="text-muted-foreground mt-1 truncate font-mono text-[10px]">
                script : {out.scriptHex}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExplorerModule() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  return (
    <div className="space-y-4">
      <PageIntro
        title={t('Explorateur')}
        desc={t(
          'Mempool {net} en direct et décodeur de transactions brutes — champ par champ, sans quitter votre navigateur.',
          { net: cfg.label },
        )}
      />
      <Tabs defaultValue="mempool">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="mempool" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" /> {t('Mempool live')}
          </TabsTrigger>
          <TabsTrigger value="decodeur" className="gap-1.5">
            <ScanSearch className="h-3.5 w-3.5" /> {t('Décodeur raw')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mempool" className="mt-4">
          <MempoolLive />
        </TabsContent>
        <TabsContent value="decodeur" className="mt-4">
          <TxDecoder />
        </TabsContent>
      </Tabs>
    </div>
  );
}
