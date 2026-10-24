'use client';

/**
 * BitLab — Regtest network settings card.
 *
 * EMBEDDED MODE (default): the private chain lives in the BitLab process —
 * no node installation, Docker, or hypervisor needed. Card shows engine state
 * (height, subsidy, halving, mempool, faucet), distributes sats via built-in
 * faucet, fast mining, and lab reset.
 *
 * EXTERNAL NODE MODE (advanced): connects to user's local Bitcoin Core with
 * REST (-rest=1) + RPC credentials, persisted in localStorage, end-to-end tested
 * (REST tip, RPC balance). Credentials stay in browser: only transmitted to
 * local BitLab server, which targets loopback/private hosts only.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Coins, Hammer, RotateCcw, Server, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useActiveWallet, useLabStore } from '@/lib/store';
import { api } from '@/lib/mempool';
import { loadRegtestCfg, isLocalHost, regtestMode, saveRegtestCfg, setRegtestMode, REGTEST_DEFAULTS, type RegtestCfg } from '@/lib/regtest';
import { satsToBtc } from '@/lib/bitcoin/utils';
import { useT } from '@/lib/i18n';

type ProbeState = 'idle' | 'running' | 'ok' | 'rest-fail' | 'rpc-fail';

interface EmbeddedInfo {
  ok: boolean;
  height: number;
  subsidyNextSats: number;
  halvingInBlocks: number;
  mempoolCount: number;
  faucet: { address: string; matureSats: number; immatureSats: number };
}

/** Montants proposés par le faucet embarqué (sats). */
const FAUCET_AMOUNTS = [100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000];

export function RegtestSettingsCard() {
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const [mode, setModeState] = useState<'embedded' | 'external'>(() => regtestMode());

  const switchMode = (external: boolean) => {
    const next = external ? 'external' : 'embedded';
    setRegtestMode(next);
    setModeState(next);
  };

  // Changement de réseau pendant que la carte est affichée : impossible (la
  // carte n'est rendue que sur regtest) — garde défensive sans effet sinon.
  if (net !== 'regtest') return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-4 w-4 text-primary" /> {t('Chaîne regtest — laboratoire local')}
        </CardTitle>
        <CardDescription>
          {mode === 'embedded'
            ? t('La chaîne privée est embarquée dans BitLab : rien à installer, ni Docker, ni machine virtuelle.')
            : t('Mode avancé : BitLab dialogue avec votre Bitcoin Core local (-regtest -rest=1) au lieu du moteur embarqué.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium">{t('Nœud externe (Bitcoin Core)')}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t('Désactivé : le moteur embarqué de BitLab sert la chaîne. Activé : votre Core local fait foi.')}
            </p>
          </div>
          <Switch checked={mode === 'external'} onCheckedChange={switchMode} />
        </div>

        {mode === 'embedded' ? (
          <EmbeddedPanel />
        ) : (
          <ExternalPanel />
        )}
      </CardContent>
    </Card>
  );
}

/** Panneau du moteur embarqué : état, faucet, minage rapide, réinitialisation. */
function EmbeddedPanel() {
  const { t } = useT();
  const active = useActiveWallet();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(FAUCET_AMOUNTS[0]));
  const [busy, setBusy] = useState<'faucet' | 'mine' | 'reset' | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const info = useQuery({
    queryKey: ['regtest-info'],
    queryFn: async () => {
      const res = await fetch('/api/regtest/info', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as EmbeddedInfo;
    },
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['regtest-info'] });
    if (active) void queryClient.invalidateQueries({ queryKey: ['address', 'regtest', active.address] });
  };

  const runFaucet = async () => {
    if (!active) return;
    setBusy('faucet');
    setFeedback(null);
    try {
      const res = await fetch('/api/regtest/faucet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: active.address, sats: Number(amount) }),
      });
      const body = (await res.json()) as { ok?: boolean; detail?: string; txid?: string; blockHeight?: number };
      if (!res.ok || !body.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
      setFeedback({ ok: true, text: t('{sats} sats envoyés — confirmés au bloc #{h}.', { sats: Number(amount).toLocaleString('fr-FR'), h: body.blockHeight ?? '?' }) });
      invalidate();
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const runMine = async () => {
    setBusy('mine');
    setFeedback(null);
    try {
      const res = await fetch('/api/regtest/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blocks: 10, address: active?.address }),
      });
      const body = (await res.json()) as { ok?: boolean; detail?: string; tip?: { height: number } };
      if (!res.ok || !body.ok) throw new Error(body.detail ?? `HTTP ${res.status}`);
      setFeedback({ ok: true, text: t('10 blocs minés — hauteur {h}. La récompense mûrit après 100 blocs.', { h: body.tip?.height ?? '?' }) });
      invalidate();
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const runReset = async () => {
    setBusy('reset');
    setFeedback(null);
    try {
      await fetch('/api/regtest/reset', { method: 'POST' });
      setFeedback({ ok: true, text: t('Chaîne réinitialisée — genèse neuf, pool faucet reconstitué.') });
      invalidate();
    } catch (err) {
      setFeedback({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('Hauteur')} value={info.data ? String(info.data.height) : '…'} />
        <Stat label={t('Subvention / bloc')} value={info.data ? `${satsToBtc(info.data.subsidyNextSats)} BTC` : '…'} />
        <Stat label={t('Halving dans')} value={info.data ? t('{n} blocs', { n: info.data.halvingInBlocks }) : '…'} />
        <Stat label={t('Mempool')} value={info.data ? String(info.data.mempoolCount) : '…'} />
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Coins className="h-3.5 w-3.5 text-primary" /> {t('Faucet intégré — sats de test instantanés')}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t('Le serveur signe une vraie transaction depuis son pool préminé puis mine 1 bloc : le solde est dépensable immédiatement.')}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1 space-y-1">
            <Label className="text-xs">{t('Montant')}</Label>
            <Select value={amount} onValueChange={setAmount}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAUCET_AMOUNTS.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">
                    {satsToBtc(s)} BTC
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="gap-1.5" disabled={!active || busy !== null} onClick={() => void runFaucet()}>
            <Coins className="h-3.5 w-3.5" /> {t('Recevoir sur {a}', { a: active ? `${active.address.slice(0, 10)}…` : '—' })}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy !== null} onClick={() => void runMine()}>
            <Hammer className="h-3.5 w-3.5" /> {t('Miner 10 blocs')}
          </Button>
        </div>
        {!active ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">{t('Générez et sélectionnez un portefeuille pour recevoir des sats.')}</p>
        ) : null}
      </div>

      {feedback ? (
        <p
          className={
            feedback.ok
              ? 'rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400'
              : 'rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400'
          }
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-snug text-muted-foreground">{t('Pool faucet : {m} BTC mûrs · {i} BTC en maturation.', { m: info.data ? satsToBtc(info.data.faucet.matureSats) : '…', i: info.data ? satsToBtc(info.data.faucet.immatureSats) : '…' })}</p>
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" disabled={busy !== null} onClick={() => void runReset()}>
          <RotateCcw className="h-3.5 w-3.5" /> {t('Réinitialiser la chaîne')}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-[13px] font-semibold">{value}</p>
    </div>
  );
}

/** Panneau historique : connexion à un Bitcoin Core local (mode externe). */
function ExternalPanel() {
  const { t } = useT();
  const active = useActiveWallet();
  const [cfg, setCfg] = useState<RegtestCfg>(() => loadRegtestCfg());
  const [saved, setSaved] = useState<RegtestCfg>(() => loadRegtestCfg());
  const [probe, setProbe] = useState<ProbeState>('idle');

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const test = async () => {
    if (dirty) {
      saveRegtestCfg(cfg);
      setSaved(cfg);
    }
    setProbe('running');
    try {
      // 1) REST : lecture publique du tip (aucun identifiant requis).
      await api.tipHeight();
    } catch {
      setProbe('rest-fail');
      return;
    }
    if (!active) {
      setProbe('ok');
      return;
    }
    try {
      // 2) RPC : le solde de l'adresse active valide rpcuser/rpcpass.
      await api.utxos(active.address);
      setProbe('ok');
    } catch {
      setProbe('rpc-fail');
    }
  };

  const hostWarning = cfg.host !== REGTEST_DEFAULTS.host && !isLocalHost(cfg.host);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="regtest-host" className="text-xs">{t('Hôte du nœud')}</Label>
          <Input
            id="regtest-host"
            value={cfg.host}
            onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
            placeholder="127.0.0.1"
            autoComplete="off"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regtest-port" className="text-xs">{t('Port RPC/REST')}</Label>
          <Input
            id="regtest-port"
            type="number"
            value={cfg.port}
            onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) || REGTEST_DEFAULTS.port })}
            placeholder="18443"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regtest-user" className="text-xs">{t('rpcuser (bitcoin.conf)')}</Label>
          <Input
            id="regtest-user"
            value={cfg.user}
            onChange={(e) => setCfg({ ...cfg, user: e.target.value })}
            autoComplete="off"
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regtest-pass" className="text-xs">{t('rpcpass / rpcauth')}</Label>
          <Input
            id="regtest-pass"
            type="password"
            value={cfg.pass}
            onChange={(e) => setCfg({ ...cfg, pass: e.target.value })}
            autoComplete="off"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      {hostWarning ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          {t('Hôte hors boucle locale : le serveur BitLab n’accepte que les adresses locales ou privées (127.0.0.1, LAN).')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void test()} disabled={probe === 'running'} className="gap-1.5">
          {t('Enregistrer et tester')}
        </Button>
        {probe === 'ok' ? (
          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> {t('Nœud connecté')}
          </Badge>
        ) : null}
        {probe === 'rest-fail' ? (
          <Badge variant="outline" className="gap-1 border-red-500/40 text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" /> {t('Nœud injoignable — Core tourne-t-il avec -regtest -rest=1 ?')}
          </Badge>
        ) : null}
        {probe === 'rpc-fail' ? (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
            <XCircle className="h-3 w-3" /> {t('REST OK mais RPC refusé — vérifiez rpcuser/rpcpass')}
          </Badge>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        <p>bitcoind -regtest -rest=1 -rpcuser=&lt;user&gt; -rpcpassword=&lt;pass&gt;</p>
        <p>bitcoin-cli -regtest generatetoaddress 1 &lt;adresse&gt;</p>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {t('Identifiants stockés uniquement dans votre navigateur et transmis au serveur BitLab local, qui ne cible jamais d’hôte public.')}
      </p>
    </div>
  );
}
