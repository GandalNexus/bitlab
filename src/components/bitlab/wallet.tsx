'use client';

/**
 * BitLab — Wallet Management (step 2.1).
 * Key pair and address generation (Legacy, SegWit, Taproot),
 * WIF/BIP39 import, built-in faucet and local wallet library.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bitcoin,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  Import,
  KeyRound,
  Plus,
  ShieldAlert,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { QRCode } from '@/components/bitlab/qrcode';

import { RegtestSettingsCard } from '@/components/bitlab/regtest-settings';
import { Copyable, PageIntro, TypeBadge } from './bits';
import { useLabStore, useActiveWallet } from '@/lib/store';
import { miner } from '@/lib/mining/miner';
import { TYPE_INFO, createWallet, walletFromMnemonic, walletFromWif, type AddrType, type LabWallet } from '@/lib/bitcoin/keys';
import { api } from '@/lib/mempool';
import { DEFAULT_NET, NETWORKS, pathForNetwork } from '@/lib/networks';
import { satsToBtc } from '@/lib/bitcoin/utils';
import { useToast } from '@/hooks/use-toast';
import { tLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function TypeSelector({ value, onChange }: { value: AddrType; onChange: (t: AddrType) => void }) {
  const { t } = useT();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(TYPE_INFO) as AddrType[]).map((tp) => {
        const info = TYPE_INFO[tp];
        const active = value === tp;
        return (
          <button
            key={tp}
            type="button"
            onClick={() => onChange(tp)}
            aria-pressed={active}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{info.label}</span>
              <TypeBadge type={tp === 'legacy' ? 'legacy' : tp === 'segwit' ? 'segwit' : 'taproot'} />
            </div>
            <div className="mt-1 font-mono text-[10px] text-primary">{info.tech} · {info.bip}</div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(info.desc)}</p>
          </button>
        );
      })}
    </div>
  );
}

/** Détail complet d'un portefeuille avec révélation progressive des secrets. */
function WalletDetail({ w }: { w: LabWallet }) {
  const [showSecret, setShowSecret] = useState(false);
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const info = TYPE_INFO[w.type];
  const balance = useQuery({
    queryKey: ['address', net, w.address],
    queryFn: () => api.address(w.address),
    refetchInterval: 45_000,
    retry: 1,
    enabled: Boolean(w.address),
  });
  const funded = (balance.data?.chain_stats.funded_txo_sum ?? 0) - (balance.data?.chain_stats.spent_txo_sum ?? 0);
  const pending = (balance.data?.mempool_stats.funded_txo_sum ?? 0) - (balance.data?.mempool_stats.spent_txo_sum ?? 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex justify-center rounded-lg border border-border bg-muted/30 p-3">
          <QRCode value={`bitcoin:${w.address}`} size={132} caption={w.address.slice(0, 14) + '…'} />
        </div>
        <div className="space-y-2">
          <Copyable label={t('Adresse')} value={w.address} />
          <Copyable label={t('Clé publique')} value={w.publicKeyHex} display={w.publicKeyHex.slice(0, 20) + '…' + w.publicKeyHex.slice(-8)} />
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('Solde')}</div>
            {balance.isLoading ? (
              <div className="mt-1 font-mono text-sm text-muted-foreground">{t('chargement…')}</div>
            ) : balance.isError ? (
              <div className="mt-1 font-mono text-sm text-muted-foreground">{t('indisponible')}</div>
            ) : (
              <div className="mt-1 font-mono text-sm">
                <span className="text-primary">{satsToBtc(funded)} BTC</span>
                {pending !== 0 ? <span className="ml-2 text-xs text-amber-500 dark:text-amber-400">({t('{v} en attente', { v: `${pending > 0 ? '+' : ''}${satsToBtc(pending)}` })})</span> : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="text-muted-foreground">{t('Type : ')}</span>
          <span className="font-medium">{info.label} ({info.tech})</span>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="text-muted-foreground">{t('Chemin de dérivation : ')}</span>
          <span className="font-mono">{w.derivationPath ?? t('import WIF (sans chemin HD)')}</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <KeyRound className="h-3.5 w-3.5" /> {t('Secrets du laboratoire — ne jamais partager')}
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" onClick={() => setShowSecret((v) => !v)}>
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSecret ? t('Masquer') : t('Révéler')}
          </Button>
        </div>
        {showSecret ? (
          <div className="mt-3 space-y-2">
            {w.mnemonic ? (
              <Copyable label={t('Phrase mnémonique BIP39 ({n} mots)', { n: w.mnemonic.split(' ').length })} value={w.mnemonic} />
            ) : null}
            <Copyable label={t('Clé privée (hex)')} value={w.privateKeyHex} />
            <Copyable label={t('Clé privée (WIF)')} value={w.wif} />
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t('Masqué par défaut. Ces données restent dans votre navigateur ; aucun serveur n’y a accès.')}
          </p>
        )}
      </div>
    </div>
  );
}

const REQ_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: 'sans compte', cls: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  captcha: { label: 'captcha', cls: 'border-amber-600/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  account: { label: 'connexion requise', cls: 'border-sky-600/40 bg-sky-500/10 text-sky-600 dark:text-sky-400' },
};

/** Faucet : liens externes vérifiés (la distribution directe mempool a été retirée — API indisponible). */
function FaucetPanel() {
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const active = useActiveWallet();
  const { t } = useT();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplets className="h-4 w-4 text-primary" /> {t('Faucet — obtenir des BTC de test')}
        </CardTitle>
        <CardDescription>{t(cfg.faucetNote)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Regtest : le faucet c'est vous — connexion au nœud local + minage. */}
        {cfg.local ? <RegtestSettingsCard /> : null}
        {active ? (
          <Copyable label={t('Votre adresse active à financer')} value={active.address} />
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {t('Générez et sélectionnez un portefeuille {net} pour utiliser le faucet.', { net: cfg.label })}
          </div>
        )}

        {/* Faucets externes vérifiés */}
        {cfg.faucets.length > 0 ? (
          <>
            <div className="text-[13px] font-medium text-muted-foreground">{t('Faucets externes — copiez l’adresse ci-dessus, collez-la, recevez :')}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cfg.faucets.map((f) => {
                const badge = REQ_BADGE[f.req];
                return (
                  <a
                    key={f.url}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="truncate">{f.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(f.desc)}</p>
                    {badge ? (
                      <span className={cn('mt-1.5 inline-flex rounded-full border px-2 py-px text-[10px] font-medium', badge.cls)}>
                        {t(badge.label)}
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Mainnet : aucun faucet — les bitcoins y ont une valeur réelle. */
function MainnetNotice() {
  const { t } = useT();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500" /> {t('Mainnet — bitcoins réels, aucun faucet')}
        </CardTitle>
        <CardDescription>
          {t('Ici, chaque satoshi a une valeur réelle : personne ne les distribue gratuitement. Pour vous entraîner sans risque, basculez sur Testnet, Signet ou Regtest depuis le sélecteur de réseau en haut à droite.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-semibold">{t('Fonds réels — prudence')}</strong>{' '}
            {t('Toute transaction déplace des bitcoins ayant une valeur monétaire — vérifiez chaque adresse avant diffusion.')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function WalletModule() {
  const { toast } = useToast();
  const { t } = useT();
  const net = useLabStore((s) => s.network);
  const cfg = NETWORKS[net];
  const wallets = useLabStore((s) => s.wallets);
  const activeId = useLabStore((s) => s.activeWalletId);
  const active = useActiveWallet();
  const { addWallet, removeWallet, setActiveWallet, mineOnKeyGen } = useLabStore();

  // Bibliothèque filtrée par réseau actif — aucune opération croisée possible.
  const netWallets = useMemo(
    () => wallets.filter((w) => (w.network ?? DEFAULT_NET) === net),
    [wallets, net],
  );
  const otherCount = wallets.length - netWallets.length;

  const [genType, setGenType] = useState<AddrType>('segwit');
  const [genWords, setGenWords] = useState<12 | 24>(12);
  const [preview, setPreview] = useState<LabWallet | null>(null);

  const [impMode, setImpMode] = useState<'mnemonic' | 'wif'>('mnemonic');
  const [impType, setImpType] = useState<AddrType>('segwit');
  const [mnemonic, setMnemonic] = useState('');
  const [wif, setWif] = useState('');

  const generate = () => {
    try {
      const w = createWallet(genType, genWords);
      setPreview(w);
      toast({ title: t('Portefeuille généré'), description: t('Adresse {tech} créée localement.', { tech: TYPE_INFO[genType].tech }) });
    } catch (e) {
      toast({ title: t('Erreur de génération'), description: t((e as Error).message), variant: 'destructive' });
    }
  };

  /** Si l'utilisateur a activé l'auto-minage, le mineur démarre sur l'adresse
   * fraîchement générée (testnet4 : fenêtres BIP 94 ; regtest : blocs
   * instantanés vers la chaîne locale). */
  const maybeAutoMine = (w: LabWallet) => {
    const mineable = (w.network ?? DEFAULT_NET) === 'testnet4' || (w.network ?? DEFAULT_NET) === 'regtest';
    if (mineOnKeyGen && mineable) {
      miner.start(w.address, 4, w.network ?? DEFAULT_NET);
      toast({
        title: t('Mineur démarré automatiquement'),
        description:
          (w.network ?? DEFAULT_NET) === 'regtest'
            ? t('Blocs instantanés vers {a} sur la chaîne regtest — le panneau ci-dessous suit la progression.', { a: `${w.address.slice(0, 10)}…` })
            : t('Il minera vers {a} pendant les fenêtres BIP 94 — le panneau ci-dessous suit la progression.', { a: `${w.address.slice(0, 10)}…` }),
      });
    }
  };

  const confirmPreview = () => {
    if (!preview) return;
    addWallet(preview);
    setPreview(null);
    toast({ title: t('Portefeuille enregistré'), description: t('Ajouté à votre bibliothèque locale (IndexedDB).') });
    maybeAutoMine(preview);
  };

  const doImport = () => {
    try {
      const w = impMode === 'mnemonic' ? walletFromMnemonic(mnemonic, impType) : walletFromWif(wif, impType);
      addWallet(w);
      setMnemonic('');
      setWif('');
      toast({ title: t('Import réussi'), description: t('Adresse {a} ajoutée.', { a: `${w.address.slice(0, 12)}…` }) });
      maybeAutoMine(w);
    } catch (e) {
      toast({ title: t('Import impossible'), description: t((e as Error).message), variant: 'destructive' });
    }
  };

  const totalBalance = useMemo(() => netWallets.length, [netWallets]);

  return (
    <div className="space-y-4">
      <PageIntro
        title={t('Portefeuille')}
        desc={t('Générez des paires de clés {net} (Legacy, SegWit, Taproot), importez une phrase BIP39 ou une clé WIF, et pilotez votre bibliothèque locale.', { net: cfg.label })}
      />

      <Tabs defaultValue="generer">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="generer" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> {t('Générer')}</TabsTrigger>
          <TabsTrigger value="importer" className="gap-1.5"><Import className="h-3.5 w-3.5" /> {t('Importer')}</TabsTrigger>
          <TabsTrigger value="bibliotheque" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> {t('Mes portefeuilles')}
            {totalBalance > 0 ? <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{totalBalance}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Génération ── */}
        <TabsContent value="generer" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('Créer une paire de clés {net}', { net: cfg.label })}</CardTitle>
              <CardDescription>
                {t('La clé privée est tirée d’un aléa cryptographique local, puis dérivée selon le chemin BIP du format choisi.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TypeSelector value={genType} onChange={setGenType} />
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>{t('Longueur mnémonique')}</Label>
                  <Select value={String(genWords)} onValueChange={(v) => setGenWords(Number(v) as 12 | 24)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">{t('12 mots (128 bits)')}</SelectItem>
                      <SelectItem value="24">{t('24 mots (256 bits)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={generate} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t('Générer le portefeuille')}
                </Button>
              </div>

              {preview ? (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Bitcoin className="h-4 w-4 text-primary" /> {t('Aperçu du nouveau portefeuille')}
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary">{t('non enregistré')}</Badge>
                  </div>
                  <WalletDetail w={preview} />
                  <div className="mt-3 flex gap-2">
                    <Button onClick={confirmPreview} size="sm">{t('Enregistrer dans le lab')}</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreview(null)}>{t('Annuler')}</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Import ── */}
        <TabsContent value="importer" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('Importer des clés pour test')}</CardTitle>
              <CardDescription>{t('Importez une phrase mnémonique BIP39 ou une clé privée WIF (format {net}).', { net: cfg.label })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={impMode} onValueChange={(v) => setImpMode(v as 'mnemonic' | 'wif')}>
                <TabsList>
                  <TabsTrigger value="mnemonic">{t('Mnémonique BIP39')}</TabsTrigger>
                  <TabsTrigger value="wif">{t('Clé privée WIF')}</TabsTrigger>
                </TabsList>
                <TabsContent value="mnemonic" className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mnemo">{t('Phrase de récupération (12 ou 24 mots)')}</Label>
                    <Textarea
                      id="mnemo"
                      placeholder="ex. abandon ability able about above absent absorb abstract absurd abuse access accident …"
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      className="min-h-20 font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t('Chemin appliqué ({net}) :', { net: cfg.label })} <span className="font-mono text-primary">{pathForNetwork(TYPE_INFO[impType].path, net)}</span> {t('— dérivation déterministe BIP32.')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('Format d’adresse dérivé')}</Label>
                    <Select value={impType} onValueChange={(v) => setImpType(v as AddrType)}>
                      <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_INFO) as AddrType[]).map((tp) => (
                          <SelectItem key={tp} value={tp}>{TYPE_INFO[tp].label} — {TYPE_INFO[tp].tech} ({TYPE_INFO[tp].bip})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={doImport} disabled={!mnemonic.trim()} className="gap-1.5">
                    <Import className="h-4 w-4" /> {t('Importer la mnémonique')}
                  </Button>
                </TabsContent>
                <TabsContent value="wif" className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wif">{t('Clé privée WIF {net}', { net: cfg.label })}</Label>
                    <Input
                      id="wif"
                      placeholder={t(cfg.wifHint)}
                      value={wif}
                      onChange={(e) => setWif(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {cfg.realFunds
                        ? t('Réseau Mainnet sélectionné : seules les clés WIF mainnet (5/K/L) sont acceptées — les fonds sont réels.')
                        : t('Les clés mainnet (5/K/L) sont rejetées — le réseau actif est {net}, sans risque financier.', { net: cfg.label })}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('Format d’adresse correspondant')}</Label>
                    <Select value={impType} onValueChange={(v) => setImpType(v as AddrType)}>
                      <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_INFO) as AddrType[]).map((tp) => (
                          <SelectItem key={tp} value={tp}>{TYPE_INFO[tp].label} — {TYPE_INFO[tp].tech}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={doImport} disabled={!wif.trim()} className="gap-1.5">
                    <Import className="h-4 w-4" /> {t('Importer la clé WIF')}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bibliothèque ── */}
        <TabsContent value="bibliotheque" className="mt-4 space-y-4">
          {netWallets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">{t('Aucun portefeuille {net}', { net: cfg.label })}</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {t('Générez un premier portefeuille {net} depuis l’onglet « Générer » pour commencer les expérimentations.', { net: cfg.label })}
                  {otherCount > 0 ? ' ' + t('{n} portefeuille(s) existent sur d’autres réseaux — changez de réseau pour les voir.', { n: otherCount }) : ''}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                {netWallets.map((w) => (
                  <div
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveWallet(w.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveWallet(w.id);
                      }
                    }}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      w.id === activeId ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <TypeBadge type={w.type === 'taproot' ? 'taproot' : w.type === 'segwit' ? 'segwit' : 'legacy'} />
                        <span className="truncate font-mono text-xs">{w.address}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                        aria-label={t('Supprimer le portefeuille')}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWallet(w.id);
                          toast({ title: t('Portefeuille supprimé du lab') });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{TYPE_INFO[w.type].tech}</span>·
                      <span>{w.source === 'generated' ? t('généré') : w.source === 'mnemonic' ? 'BIP39' : 'WIF'}</span>·
                      <span>{new Date(w.createdAt).toLocaleDateString(tLocale())}</span>
                      {w.id === activeId ? <Badge className="ml-auto h-4 bg-primary/20 px-1 text-[9px] text-primary">{t('actif')}</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                {active ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{t('Portefeuille actif')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <WalletDetail w={active} />
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Faucet intégré (réseaux de test) / notice Mainnet ── */}
      {net === 'mainnet' ? <MainnetNotice /> : <FaucetPanel />}
    </div>
  );
}
