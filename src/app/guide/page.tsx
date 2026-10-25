'use client';

/**
 * BitLab Docs — developer guide (external page, developers.stellar.org style).
 * Dedicated docs header, fixed side navigation with scrollspy, illustrated
 * section banners, tables and callouts — no code blocks.
 * FR <-> EN translation via t().
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NETWORKS, NET_ORDER } from '@/lib/networks';
import { useT } from '@/lib/i18n';
import { LangToggle, ThemeToggle } from '@/components/bitlab/controls';
import {
  ArtApi,
  ArtIntro,
  ArtKeys,
  ArtLightning,
  ArtNetworks,
  ArtSecurity,
  ArtTx,
} from '@/components/bitlab/docs-art';
import { BrandMark } from '@/components/bitlab/sidebar';

/* ──────────────────────────────  Primitives  ────────────────────────────── */

function Callout({ kind, title, children }: { kind: 'info' | 'warn' | 'danger'; title: string; children: ReactNode }) {
  const styles = {
    info: { box: 'border-sky-500/30 bg-sky-500/5', icon: <Info className="h-4 w-4 text-sky-400" />, tint: 'text-sky-600 dark:text-sky-300' },
    warn: { box: 'border-amber-500/30 bg-amber-500/5', icon: <TriangleAlert className="h-4 w-4 text-amber-400" />, tint: 'text-amber-600 dark:text-amber-300' },
    danger: { box: 'border-red-500/30 bg-red-500/5', icon: <ShieldAlert className="h-4 w-4 text-red-400" />, tint: 'text-red-600 dark:text-red-300' },
  }[kind];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13.5px] leading-relaxed', styles.box)}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div>
        <span className={cn('font-semibold', styles.tint)}>{title} — </span>
        <span className="text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2.5 font-semibold text-foreground/80">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={cn('px-3.5 py-2.5 align-top text-muted-foreground', j === 0 && 'font-mono text-xs text-foreground')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-b border-border/70 pb-2.5 text-[22px] font-semibold tracking-tight">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-1 text-[16px] font-semibold tracking-tight">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-justify text-[14px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="text-justify">{children}</span>
    </li>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-lg border border-border bg-card/60 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary">
        {n}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 max-w-2xl text-justify text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Illustrated section banner (no header strip — the art stands alone). */
function Banner({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-2 py-2 sm:px-4">{children}</div>
    </div>
  );
}

/** Scroll to bibliography entry `n` and flash it (target of an in-text [n] citation). */
function goToRef(n: number) {
  const el = document.getElementById(`ref-${n}`);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('ref-flash');
  void el.offsetWidth; // restart the animation on repeated clicks
  el.classList.add('ref-flash');
  window.setTimeout(() => el.classList.remove('ref-flash'), 2000);
}

/** In-text numbered citation — clickable [n] jumping to the references section. */
function Ref({ n }: { n: number }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={() => goToRef(n)}
      title={`${t('Voir la référence')} [${n}]`}
      className="cursor-pointer align-super font-mono text-[10px] font-medium text-primary hover:underline"
    >
      [{n}]
    </button>
  );
}

/* ──────────────────────────────  Sections  ────────────────────────────── */

function SectionDemarrer() {
  const { t } = useT();
  return (
    <article id="demarrer" className="scroll-mt-24 space-y-6">
      <Banner><ArtIntro /></Banner>
      <H2 id="demarrer">{t('Démarrer')}</H2>
      <P>
        {t('BitLab est un laboratoire d’apprentissage de Bitcoin et Lightning. La cryptographie — génération de clés, construction et signature de transactions — s’exécute intégralement dans le navigateur, au moyen de bibliothèques auditées')}<Ref n={15} />{' '}
        {t('appliquant les règles de consensus du réseau. Les données publiques (blocs, soldes, frais) proviennent de nœuds Esplora publics')}<Ref n={13} />
        {t(' ; deux nœuds Lightning LDK')}<Ref n={11} />
        {t(', compilés en WebAssembly, s’exécutent localement. Rien n’est simulé : tout résultat affiché provient d’un réseau Bitcoin réel.')}
      </P>
      <P>
        {t('Le projet suit le principe')} <strong className="text-foreground">{t('Zero-Knowledge')}</strong>
        {t(' : les clés privées, phrases mnémoniques et clés WIF sont générées et conservées exclusivement dans le stockage local du navigateur. Le serveur agit uniquement comme mandataire de données publiques ; il ne détient aucun secret, n’héberge aucun nœud Lightning et ne peut ni lire ni déplacer les fonds.')}
      </P>
      <H3>{t('Le parcours recommandé')}</H3>
      <div className="grid gap-2.5">
        <Step n="01" title={t('Générer un portefeuille')}>
          {t('Créer une graine BIP39 dans le module Portefeuille, puis dériver des adresses Legacy, SegWit ou Taproot. Une clé WIF ou une phrase existante peut également être importée.')}
        </Step>
        <Step n="02" title={t('Obtenir des sats de test')}>
          {t('Créditer l’adresse active auprès d’un faucet du réseau actif ; les liens vérifiés sont fournis dans le module Portefeuille.')}
        </Step>
        <Step n="03" title={t('Construire une transaction')}>
          {t('Sélectionner les UTXO, composer les sorties, régler les frais en sat/vB, signer localement (ECDSA ou Schnorr), puis diffuser la transaction.')}
        </Step>
        <Step n="04" title={t('Observer dans l’explorateur')}>
          {t('Suivre les confirmations des transactions et décoder des transactions brutes afin d’en examiner la structure.')}
        </Step>
        <Step n="05" title={t('Expérimenter Lightning')}>
          {t('Démarrer les deux nœuds LDK dans le navigateur, ouvrir un canal financé on-chain, puis émettre et payer des factures BOLT11')}<Ref n={9} />{' '}
          {t(' ou des offers BOLT12')}<Ref n={10} />
          {'.'}
        </Step>
      </div>
      <Callout kind="info" title={t('Réseaux')}>
        {t('Le lab démarre sur')} <strong>Testnet4</strong> {t('(sats sans valeur). Lightning prend en charge Testnet4, Testnet3 et Signet. Le mainnet reste accessible en exploration ; le financement y est désactivé par conception.')}
      </Callout>
    </article>
  );
}

function SectionCles() {
  const { t } = useT();
  return (
    <article id="cles-adresses" className="scroll-mt-24 space-y-6">
      <Banner><ArtKeys /></Banner>
      <H2 id="cles-adresses">{t('Clés & adresses')}</H2>
      <P>
        {t('Chaque portefeuille dérive d’une entropie locale convertie en phrase mnémonique BIP39')}<Ref n={5} />
        {t(' (12 ou 24 mots). La graine résultante alimente une arborescence BIP32')}<Ref n={4} />
        {t(' dont chaque branche correspond à un standard d’adresse : BIP44 (Legacy P2PKH)')}<Ref n={6} />
        {t(', BIP84 (SegWit P2WPKH)')}<Ref n={7} />
        {t(' et BIP86 (Taproot P2TR)')}<Ref n={8} />
        {t('. BitLab repose sur les bibliothèques auditées')}{' '}
        <span className="font-mono text-xs text-foreground">@scure/bip39</span>, <span className="font-mono text-xs text-foreground">@scure/bip32</span>{' '}
        {t('et')} <span className="font-mono text-xs text-foreground">@scure/btc-signer</span> {t('— les mêmes primitives que de nombreux portefeuilles en production.')}<Ref n={15} />
      </P>
      <Table
        head={[t('Type'), t('Chemin de dérivation'), t('Script'), t('Préfixe exemple')]}
        rows={[
          ['Legacy P2PKH', "m/44'/1'/0'/0/0", 'P2PKH', 'm… / n… (testnet)'],
          ['SegWit P2WPKH', "m/84'/1'/0'/0/0", 'P2WPKH (bech32)', 'tb1q…'],
          ['Taproot P2TR', "m/86'/1'/0'/0/0", 'P2TR (bech32m, x-only)', 'tb1p…'],
        ]}
      />
      <P>
        {t('Le')} <em>coin type</em> {t('suit le réseau :')} <span className="font-mono text-xs">0&apos;</span> {t('pour le mainnet,')}{' '}
        <span className="font-mono text-xs">1&apos;</span> {t('pour les réseaux de test. Cette séparation garantit l’étanchéité des portefeuilles entre réseaux. Selon le format, les adresses sont encodées en base58check ou en bech32/bech32m, avec le préfixe propre à chaque réseau.')}
      </P>
      <H3>{t('Importer une clé existante')}</H3>
      <P>
        {t('Une clé privée importée au format WIF (Wallet Import Format) est décodée puis re-dérivée dans les trois formats. BitLab vérifie le préfixe réseau (0x80 pour le mainnet, 0xEF pour les testnets) et refuse toute clé étrangère au réseau actif. L’import par phrase BIP39 applique le chemin de dérivation du format choisi, affiché avant validation.')}
      </P>
      <Callout kind="danger" title="Mainnet">
        {t('Sur mainnet, les adresses deviennent')} <span className="font-mono text-xs">bc1…</span> {t('et les clés WIF commencent par')}{' '}
        <span className="font-mono text-xs">5H / 5K / L</span>{t('. Toute transaction y engage des fonds réels : le module Portefeuille affiche un avertissement permanent et le financement automatique est désactivé.')}
      </Callout>
    </article>
  );
}
function SectionTransactions() {
  const { t } = useT();
  return (
    <article id="transactions" className="scroll-mt-24 space-y-6">
      <Banner><ArtTx /></Banner>
      <H2 id="transactions">{t('Transactions')}</H2>
      <P>
        {t('Bitcoin repose sur le modèle UTXO (Unspent Transaction Outputs)')}<Ref n={1} />
        {t(' : une transaction consomme des sorties non dépensées (entrées) et produit de nouvelles sorties. La différence entre le total des entrées et celui des sorties, déduction faite du change, constitue les frais perçus par le mineur. Le constructeur de BitLab expose ce modèle sans abstraction : le choix des UTXO, des destinataires et du niveau de frais reste sous le contrôle explicite de l’utilisateur.')}
      </P>
      <H3>{t('Le flux complet en quatre étapes')}</H3>
      <div className="grid gap-2.5">
        <Step n="01" title={t('Sélectionner')}>
          {t('Les UTXO de l’adresse active sont récupérés via Esplora ; sorties confirmées et en attente sont distinguées. L’utilisateur coche celles qui financeront la transaction.')}
        </Step>
        <Step n="02" title={t('Construire')}>
          {t('Les entrées et sorties sont assemblées ; un change automatique est ajouté lorsque le reliquat dépasse la limite de poussière (546 sats)')}<Ref n={2} />
          {t('. La taille virtuelle est estimée en direct.')}
        </Step>
        <Step n="03" title={t('Signer')}>
          {t('La signature s’effectue localement : ECDSA pour Legacy et SegWit ; Schnorr et tweak Taproot (BIP86) pour P2TR')}<Ref n={8} />
          {t('. La clé privée ne quitte pas le navigateur.')}
        </Step>
        <Step n="04" title={t('Diffuser')}>
          {t('L’hexadécimal signé est publié vers le nœud du réseau actif via le proxy ; les confirmations sont ensuite suivies dans l’explorateur intégré.')}
        </Step>
      </div>
      <H3>{t('Tailles et frais')}</H3>
      <P>
        {t('Les frais s’expriment en')} <span className="font-mono text-xs">sat/vB</span> {t('(satoshis par octet virtuel) ; les recommandations en temps réel — économie, rapide, prioritaire — proviennent de l’estimation mempool.space')}<Ref n={14} />
        {t('. Le format des entrées détermine le poids de la transaction : le choix du format d’adresse influence donc directement le coût.')}
      </P>
      <Table
        head={[t('Format d’entrée'), t('Poids approximatif'), t('Usage')]}
        rows={[
          ['Legacy P2PKH', t('~148 vB par entrée'), t('démonstrations pédagogiques')],
          ['SegWit P2WPKH', t('~68 vB par entrée'), t('standard actuel')],
          ['Taproot P2TR', t('~57 vB par entrée'), t('le plus économique')],
        ]}
      />
      <Callout kind="info" title="Multisig">
        {t('Le constructeur prend en charge le multisig m-de-n : après sélection de plusieurs clés publiques de la bibliothèque, BitLab dérive l’adresse P2WSH et son script témoin ; la dépense exige m signatures sur n.')}
      </Callout>
    </article>
  );
}

function SectionReseaux() {
  const { t } = useT();
  return (
    <article id="reseaux" className="scroll-mt-24 space-y-6">
      <Banner><ArtNetworks /></Banner>
      <H2 id="reseaux">{t('Réseaux & connectivité')}</H2>
      <P>
        {t('BitLab est multi-réseaux : le sélecteur en haut à droite bascule l’ensemble des modules — portefeuilles, constructeur, explorateur et Lightning. Les données on-chain transitent par un proxy unique')}{' '}
        <span className="font-mono text-xs">/api/bitcoin</span> {t('qui applique une liste blanche stricte de chemins (protection contre l’injection), maintient un cache mémoire de 60 secondes par réseau et relaie vers l’API Esplora publique correspondante')}<Ref n={13} />
        {t('. Ce canal ne transporte aucune donnée utilisateur : uniquement des informations publiques de la blockchain.')}
      </P>
      <Table
        head={[t('Réseau'), t('API Esplora'), t('Rôle au laboratoire')]}
        rows={NET_ORDER.map((id) => {
          const n = NETWORKS[id];
          return [
            n.label,
            n.apiBase.replace('https://', ''),
            id === 'mainnet'
              ? t('exploration seule — fonds réels')
              : id === 'testnet4'
                ? t('réseau on-chain par défaut du lab')
                : t('on-chain + Lightning LDK réel'),
          ];
        })}
      />
      <H3>{t('S’approvisionner en sats de test')}</H3>
      <P>
        {t('Chaque réseau de test recense ses faucets dans le module Portefeuille, avec la mention de leurs exigences (compte, captcha ou connexion). Copiez l’adresse active, demandez des sats, puis observez la transaction dans le solde ; le laboratoire actualise automatiquement les soldes via Esplora.')}
      </P>
      <Callout kind="warn" title={t('Étanchéité réseau')}>
        {t('Les portefeuilles sont étiquetés par réseau à la création. Le sélecteur n’affiche que les portefeuilles du réseau actif — un import mainnet en testnet est refusé, et une signature croisée entre réseaux est structurellement impossible.')}
      </Callout>
    </article>
  );
}

function SectionLightning() {
  const { t } = useT();
  return (
    <article id="lightning" className="scroll-mt-24 space-y-6">
      <Banner><ArtLightning /></Banner>
      <H2 id="lightning">{t('Lightning — LDK réel')}</H2>
      <P>
        {t('Le module Lightning n’est')} <strong className="text-foreground">{t('pas une simulation')}</strong>
        {t(' : BitLab exécute deux nœuds')} <span className="font-mono text-xs">lightning (LDK, Rust)</span><Ref n={11} /> {t('— le cœur Rust du Lightning Dev Kit')}<Ref n={12} />
        {t(', compilé en WebAssembly depuis rust/lnlab et piloté par un Web Worker dans le navigateur. Ils se synchronisent sur la chaîne via le proxy Esplora et échangent le protocole Lightning authentique — poignée de main Noise, messages BOLT')}<Ref n={3} />
        {t(' — sur une paire de sockets mémoire. Chaque nœud possède sa propre graine, conservée exclusivement dans l’IndexedDB du site, ainsi que ses canaux et son historique de paiements.')}
      </P>
      <H3>{t('Cycle de vie d’un canal')}</H3>
      <ul className="space-y-2.5">
        <Li><strong className="text-foreground">{t('Démarrer les nœuds')}</strong> — {t('les nœuds se reconstruisent depuis leur graine, se resynchronisent (blocs, frais), puis atteignent l’état opérationnel.')}</Li>
        <Li><strong className="text-foreground">{t('Financer')}</strong> — {t('l’ouverture génère une adresse de financement P2WSH ; créditez-la depuis l’un de vos portefeuilles BitLab. La transaction est construite et signée localement, puis diffusée via le proxy.')}</Li>
        <Li><strong className="text-foreground">{t('Connecter')}</strong> — {t('A et B sont reliés par une paire de sockets mémoire : chaque octet échangé relève du protocole réel (handshake Noise authentique) ; rien ne quitte la machine.')}</Li>
        <Li><strong className="text-foreground">{t('Ouvrir')}</strong> — {t('la transaction de financement 2-de-2 est signée par les deux parties puis diffusée ; le canal passe en financement, puis en prêt après confirmations.')}</Li>
        <Li><strong className="text-foreground">{t('Payer')}</strong> — {t('le payeur signe un HTLC vers la facture BOLT11 émise par le bénéficiaire ; le règlement met à jour les soldes locaux sans écriture on-chain.')}</Li>
        <Li><strong className="text-foreground">{t('Fermer')}</strong> — {t('la clôture est coopérative (transaction consensuelle) ou forcée (diffusion d’un état révoqué, assortie d’une pénalité).')}</Li>
      </ul>
      <H3>{t('Factures BOLT11')}</H3>
      <P>
        {t('Les factures émises sont réellement signées par la clé Lightning du nœud et encodées au format BOLT11')}<Ref n={9} />
        {t('. Le QR ou la chaîne lntb/lntbs peut être payé depuis tout portefeuille du réseau correspondant. Montant, hash de paiement, secret et expiration sont générés et vérifiés par le nœud lui-même.')}
      </P>
      <H3>{t('Offers BOLT12')}</H3>
      <P>
        {t('L’onglet Paiements distingue les deux protocoles. Une offer BOLT12 (lno1…) est un code de paiement réutilisable')}<Ref n={10} />
        {t(' : A demande une facture au nœud B par messages onion chiffrés ; B répond par une facture BOLT12 portant un chemin de paiement aveuglé, puis le HTLC emprunte le canal. Montant facultatif (paiement libre possible), note au payeur, décodeur intégré : le flux BOLT12 complet s’exécute dans le navigateur.')}
      </P>
      <H3>{t('Liquidité et honnêteté des erreurs')}</H3>
      <P>
        {t('À l’ouverture d’un canal, le champ « poussé au pair » transfère immédiatement de la liquidité à la contrepartie : en ouvrant A vers B avec 100 000 sats de capacité dont 40 000 poussés, B dispose d’un solde Lightning réel de 40 000 sats et peut émettre des factures payables instantanément par A. Le routage se réduit à un saut direct entre A et B, correct par construction pour un lab à deux nœuds. Sans liquidité suffisante, le paiement échoue et')}{' '}
        <strong className="text-foreground">{t('l’erreur exacte du réseau est affichée')}</strong> {t('— sans masquage ni simulation. C’est ce comportement que le développeur Lightning doit apprendre à interpréter.')}
      </P>
      <Callout kind="info" title={t('Pourquoi deux nœuds ?')}>
        {t('Lightning n’a de sens qu’entre pairs. Le lab embarque A et B afin de réaliser un cycle complet — canal, facture, paiement, clôture — sans dépendance externe ni serveur : tout s’exécute dans le navigateur.')}
      </Callout>
    </article>
  );
}
function SectionApi() {
  const { t } = useT();
  return (
    <article id="api" className="scroll-mt-24 space-y-6">
      <Banner><ArtApi /></Banner>
      <H2 id="api">{t('API du laboratoire')}</H2>
      <P>
        {t('Un proxy serveur unique alimente l’interface. Il n’expose aucune donnée sensible, filtre strictement les chemins autorisés, ajoute un cache court par réseau et relaie les blocs bruts consommés par le lab Lightning')}<Ref n={13} />
        {t('. Le module Lightning, lui, ne passe plus par le serveur : il s’exécute dans le navigateur.')}
      </P>
      <H3><span className="font-mono text-sm text-primary">/api/bitcoin</span>{t(' — proxy Esplora multi-réseaux')}</H3>
      <Table
        head={[t('Endpoint'), t('Description')]}
        rows={[
          ['GET ?path=v1/fees/recommended', t('recommandations de frais (économie → prioritaire)')],
          ['GET ?path=blocks/tip/height', t('hauteur du dernier bloc')],
          ['GET ?path=address/{adresse}/utxo', t('UTXO dépensables d’une adresse')],
          ['GET ?path=tx/{txid}', t('détails et confirmations d’une transaction')],
          ['GET ?path=v1/lightning/statistics/latest', t('statistiques mondiales Lightning (mainnet)')],
          ['GET ?path=block-height/{n}', t('hauteur du bloc n (flux du lab Lightning)')],
          ['GET ?path=block/{hash}/raw', t('bloc brut binaire (flux du lab Lightning)')],
          ['POST ?path=tx', t('diffusion d’une transaction signée (hexadécimal)')],
        ]}
      />
      <H3><span className="font-mono text-sm text-primary">Lightning (navigateur)</span>{t(' — Web Worker + WebAssembly')}</H3>
      <P>
        {t('Aucun endpoint HTTP : les deux nœuds s’exécutent dans un Web Worker (public/lnlab/worker.js) qui charge le module WASM au premier démarrage. Les graines, monitors de canal et historiques demeurent dans l’IndexedDB du site ; seules les données publiques — blocs, frais, diffusion — transitent par /api/bitcoin. Le serveur n’héberge aucun nœud.')}
      </P>
    </article>
  );
}

function SectionSecurite() {
  const { t } = useT();
  return (
    <article id="securite" className="scroll-mt-24 space-y-6">
      <Banner><ArtSecurity /></Banner>
      <H2 id="securite">{t('Bonnes pratiques')}</H2>
      <ul className="space-y-2.5">
        <Li><strong className="text-foreground">{t('Clés locales uniquement')}</strong> — {t('la signature s’exécute dans le navigateur ; aucun octet de clé privée ne transite par le réseau, ni vers BitLab ni vers un tiers.')}</Li>
        <Li><strong className="text-foreground">{t('Stockage local')}</strong> — {t('les portefeuilles et préférences résident dans l’IndexedDB de l’appareil ; effacer les données du site réinitialise l’ensemble.')}</Li>
        <Li><strong className="text-foreground">{t('Graines Lightning locales')}</strong> — {t('les nœuds LDK détiennent leurs propres graines (IndexedDB du site, jamais transmises au serveur) : n’y financez que des montants de test.')}</Li>
        <Li><strong className="text-foreground">{t('Mainnet = danger')}</strong> — {t('sur mainnet, frais, montants et destinataires sont irrévocables ; le lab verrouille tout financement mainnet par conception.')}</Li>
        <Li><strong className="text-foreground">{t('Vérifiez toujours')}</strong> — {t('avant toute diffusion, vérifier trois points : adresse de réception complète, montant en sats, réseau actif dans le sélecteur.')}</Li>
        <Li><strong className="text-foreground">{t('Transparence des erreurs')}</strong> — {t('chaque écran reflète l’état réel : une erreur Lightning (route absente, pair injoignable, fonds insuffisants) est affichée telle quelle.')}</Li>
      </ul>
      <Callout kind="warn" title={t('Environnement restreint')}>
        {t('Le lab Lightning s’exécute entièrement dans le navigateur : aucun port sortant n’est requis, et seul le proxy Esplora de l’application a besoin d’un accès Internet. Il fonctionne donc derrière les pare-feux les plus restrictifs.')}
      </Callout>
    </article>
  );
}

/* ──────────────────────────────  Références  ────────────────────────────── */

/** Bibliographie — sources normatives et documentation technique. */
const REFS: { label: string; url: string }[] = [
  { label: 'S. Nakamoto — « Bitcoin: A Peer-to-Peer Electronic Cash System » (2008)', url: 'https://bitcoin.org/bitcoin.pdf' },
  { label: 'Bitcoin Core — Developer documentation', url: 'https://developer.bitcoin.org/' },
  { label: 'Bitcoin Improvement Proposals — Index', url: 'https://github.com/bitcoin/bips' },
  { label: 'BIP 32 — Hierarchical Deterministic Wallets', url: 'https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki' },
  { label: 'BIP 39 — Mnemonic Code for Generating Deterministic Keys', url: 'https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki' },
  { label: 'BIP 44 — Multi-Account Hierarchy for Deterministic Wallets', url: 'https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki' },
  { label: 'BIP 84 — Derivation Paths for P2WPKH', url: 'https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki' },
  { label: 'BIP 86 — Derivation Paths for P2TR', url: 'https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki' },
  { label: 'BOLT #11 — Invoice Encoding for Lightning Payments', url: 'https://github.com/lightning/bolts/blob/master/11-payment-encoding.md' },
  { label: 'BOLT #12 — Offer Encoding', url: 'https://github.com/lightning/bolts/blob/master/12-offer-encoding.md' },
  { label: 'Lightning Dev Kit (LDK)', url: 'https://lightningdevkit.org/' },
  { label: 'lightning crate — Rust documentation (LDK)', url: 'https://docs.rs/lightning/latest/lightning/' },
  { label: 'Esplora — HTTP API', url: 'https://github.com/Blockstream/esplora/blob/master/API.md' },
  { label: 'mempool.space — REST API', url: 'https://mempool.space/docs/api/rest' },
  { label: 'scure — Audited cryptographic libraries (@scure/bip39, @scure/bip32, @scure/btc-signer)', url: 'https://github.com/paulmillr/scure' },
];

function SectionReferences() {
  const { t } = useT();
  return (
    <article id="references" className="scroll-mt-24 space-y-6">
      <H2 id="references">{t('Références')}</H2>
      <P>{t('Sources normatives et documentation technique utilisées dans ce guide.')}</P>
      <ol className="space-y-2.5">
        {REFS.map((r, i) => (
          <li
            key={r.url}
            id={`ref-${i + 1}`}
            className="-mx-2 flex gap-3 rounded-md px-2 py-1.5 text-[13.5px] leading-relaxed"
          >
            <span className="shrink-0 pt-px font-mono text-xs text-primary">[{i + 1}]</span>
            <span className="text-muted-foreground">
              {r.label} —{' '}
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-primary hover:underline"
              >
                {r.url.replace(/^https:\/\//, '')}
              </a>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

/* ──────────────────────────────  Coquille docs  ────────────────────────────── */

const NAV = [
  { id: 'demarrer', label: 'Démarrer' },
  { id: 'cles-adresses', label: 'Clés & adresses' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reseaux', label: 'Réseaux & connectivité' },
  { id: 'lightning', label: 'Lightning — LDK réel' },
  { id: 'api', label: 'API du laboratoire' },
  { id: 'securite', label: 'Bonnes pratiques' },
  { id: 'references', label: 'Références' },
];

const SECTIONS = [
  { id: 'demarrer', render: () => <SectionDemarrer /> },
  { id: 'cles-adresses', render: () => <SectionCles /> },
  { id: 'transactions', render: () => <SectionTransactions /> },
  { id: 'reseaux', render: () => <SectionReseaux /> },
  { id: 'lightning', render: () => <SectionLightning /> },
  { id: 'api', render: () => <SectionApi /> },
  { id: 'securite', render: () => <SectionSecurite /> },
  { id: 'references', render: () => <SectionReferences /> },
];

export default function GuideDocsPage() {
  const { t } = useT();
  const [active, setActive] = useState('demarrer');

  // Scrollspy — visible section in the top third of the window.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-96px 0px -66% 0px', threshold: 0 },
    );
    for (const id of NAV.map((n) => n.id)) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen">
      {/* Dedicated docs header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="BitLab" className="flex items-center">
            <BrandMark responsive pill={false} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link
              href="/"
              aria-label={t('Retour au laboratoire')}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{t('Retour au laboratoire')}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero docs */}
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/8 via-transparent to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="lab-display max-w-3xl text-3xl leading-tight sm:text-[38px] sm:leading-[46px]">
            {t('Guide Bitcoin & Lightning')}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {t('Bitcoin et Lightning, expliqués au niveau du protocole — à manipuler directement dans votre navigateur.')}
          </p>
        </div>
      </div>

      {/* Body: side nav + content */}
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-10 sm:px-6">
        <nav aria-label={t('Sections du guide')} className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-0.5">
            <div className="nav-section-label px-3 pb-1.5 text-muted-foreground/70">{t('Sur cette page')}</div>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                aria-current={active === n.id ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center rounded-[4px] px-3 py-1.5 text-left text-[13px] transition-colors',
                  active === n.id
                    ? 'bg-primary/15 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {t(n.label)}
              </button>
            ))}
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="/"
                className="flex w-full items-center gap-2 rounded-[4px] px-3 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t('Retour au laboratoire')}
              </Link>
            </div>
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-14">
          {SECTIONS.map((s) => (
            <div key={s.id}>{s.render()}</div>
          ))}

          <footer className="border-t border-border/60 pt-6 text-xs leading-relaxed text-muted-foreground">
            {t('BitLab — pilier du projet GandalNexus · « Vires in Numeris ». Les données publiques proviennent des nœuds mempool.space ; les nœuds Lightning tournent dans le navigateur via LDK (Lightning Dev Kit).')}
          </footer>
        </div>
      </div>
    </div>
  );
}
