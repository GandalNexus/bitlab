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
  ExternalLink,
  Info,
  ShieldAlert,
  TriangleAlert,
  Zap,
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
  return <p className="max-w-3xl text-[14px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
      <span>{children}</span>
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
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{children}</p>
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

/* ──────────────────────────────  Sections  ────────────────────────────── */

function SectionDemarrer() {
  const { t } = useT();
  return (
    <article id="demarrer" className="scroll-mt-24 space-y-6">
      <Banner><ArtIntro /></Banner>
      <H2 id="demarrer">{t('Démarrer')}</H2>
      <P>
        {t('BitLab est un laboratoire Bitcoin et Lightning où l’on apprend en manipulant les vraies primitives du protocole. La cryptographie — génération de clés, construction et signature des transactions — s’exécute intégralement dans votre navigateur, avec des bibliothèques auditées et les règles de consensus exactes du réseau. Les données publiques (blocs, soldes, frais) proviennent de nœuds Esplora publics, et deux véritables nœuds Lightning LDK compilés en WebAssembly s’exécutent dans votre navigateur. Rien n’est maquetté : ce qui s’affiche à l’écran s’est réellement produit sur un réseau Bitcoin.')}
      </P>
      <P>
        {t('Le projet suit le principe')} <strong className="text-foreground">{t('Zero-Knowledge')}</strong>
        {t(' : les clés privées, phrases mnémoniques et clés WIF sont générées puis conservées exclusivement dans le stockage local de votre navigateur. Le serveur n’agit que comme un proxy de données publiques — il ne détient aucun secret utilisateur, n’héberge aucun nœud Lightning, et ne peut ni lire ni déplacer vos fonds.')}
      </P>
      <H3>{t('Le parcours recommandé')}</H3>
      <div className="grid gap-2.5">
        <Step n="01" title={t('Générer un portefeuille')}>
          {t('Créez une graine BIP39 puis des adresses Legacy, SegWit ou Taproot depuis le module Portefeuille ; importez aussi une clé WIF ou une phrase existante.')}
        </Step>
        <Step n="02" title={t('Obtenir des sats de test')}>
          {t('Créditez votre adresse depuis un faucet externe du réseau actif — les liens vérifiés sont fournis dans le module Portefeuille.')}
        </Step>
        <Step n="03" title={t('Construire une transaction')}>
          {t('Sélectionnez vos UTXO, composez les sorties, ajustez les frais en sat/vB, signez localement (ECDSA ou Schnorr) puis diffusez sur le réseau.')}
        </Step>
        <Step n="04" title={t('Observer dans l’explorateur')}>
          {t('Suivez les confirmations de vos transactions et décodez des transactions brutes hexadécimales pour comprendre leur anatomie.')}
        </Step>
        <Step n="05" title={t('Expérimenter Lightning')}>
          {t('Activez le lab Lightning : les deux nœuds LDK réels démarrent dans votre navigateur ; ouvrez un canal financé on-chain, émettez et payez des factures BOLT11 ou des offers BOLT12 instantanément.')}
        </Step>
      </div>
      <Callout kind="info" title={t('Réseaux')}>
        {t('Le lab démarre sur')} <strong>Testnet4</strong> {t('(sats sans valeur). Le Lightning réel supporte Testnet4, Testnet3 et Signet. Le mainnet reste accessible pour l’exploration mais y est volontairement verrouillé côté financement.')}
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
        {t('Chaque portefeuille naît d’une entropie locale transformée en phrase mnémonique BIP39 (12 ou 24 mots). La graine dérivée alimente une arborescence BIP32 dont chaque branche correspond à un standard d’adresse : BIP44 pour les Legacy P2PKH, BIP84 pour les SegWit P2WPKH et BIP86 pour les Taproot P2TR. BitLab s’appuie sur les bibliothèques auditées')}{' '}
        <span className="font-mono text-xs text-foreground">@scure/bip39</span>, <span className="font-mono text-xs text-foreground">@scure/bip32</span>{' '}
        {t('et')} <span className="font-mono text-xs text-foreground">@scure/btc-signer</span> {t('— les mêmes primitives que de nombreux portefeuilles en production.')}
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
        <span className="font-mono text-xs">1&apos;</span> {t('pour tous les réseaux de test. Cette cloison garantit l’étanchéité des portefeuilles entre réseaux — aucun portefeuille de test ne peut être manipulé sur mainnet, et inversement. Les adresses sont encodées en base58check ou bech32/bech32m selon le format, avec le préfixe humain propre au réseau.')}
      </P>
      <H3>{t('Importer une clé existante')}</H3>
      <P>
        {t('Une clé privée importée en WIF (Wallet Import Format) est décodée puis re-dérivée dans les trois formats, comme si elle venait d’être générée. BitLab vérifie le préfixe réseau (0x80 pour le mainnet, 0xEF pour les testnets) et refuse toute clé appartenant à un autre réseau que le réseau actif. L’import par phrase BIP39 applique le chemin de dérivation correspondant au format choisi, affiché en clair avant validation.')}
      </P>
      <Callout kind="danger" title="Mainnet">
        {t('Sur mainnet, les adresses deviennent')} <span className="font-mono text-xs">bc1…</span> {t('et les clés WIF commencent par')}{' '}
        <span className="font-mono text-xs">5H / 5K / L</span>{t('. Toute transaction y engage des fonds réels — le module Portefeuille affiche un avertissement permanent et le financement automatique est désactivé.')}
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
        {t('Bitcoin fonctionne en modèle UTXO (Unspent Transaction Outputs) : une transaction consomme des sorties non dépensées comme entrées et produit de nouvelles sorties. La différence entre le total des entrées et le total des sorties — moins ce que l’on rend à soi-même en monnaie (change) — constitue les frais perçus par le mineur. Le constructeur de BitLab expose ce modèle sans abstraction : vous choisissez précisément quels UTXO dépenser, à qui envoyer quoi, et à quel prix vous voulez que le réseau traite votre transaction.')}
      </P>
      <H3>{t('Le flux complet en quatre étapes')}</H3>
      <div className="grid gap-2.5">
        <Step n="01" title={t('Sélectionner')}>
          {t('Récupération des UTXO de l’adresse active via Esplora. Les sorties confirmées et en attente sont distinguées ; vous cochez celles qui financeront la transaction.')}
        </Step>
        <Step n="02" title={t('Construire')}>
          {t('Assemblage des entrées et sorties, ajout du change automatique lorsque le reliquat dépasse la limite de poussière (546 sats), estimation de la taille virtuelle en direct.')}
        </Step>
        <Step n="03" title={t('Signer')}>
          {t('Signature locale : ECDSA pour Legacy et SegWit, Schnorr et tweak Taproot (BIP86) pour P2TR. La clé privée ne quitte jamais le navigateur.')}
        </Step>
        <Step n="04" title={t('Diffuser')}>
          {t('Publication de l’hexadécimal signé vers le nœud du réseau actif via le proxy, puis suivi des confirmations dans l’explorateur intégré.')}
        </Step>
      </div>
      <H3>{t('Tailles et frais')}</H3>
      <P>
        {t('Les frais s’expriment en')} <span className="font-mono text-xs">sat/vB</span> {t('(satoshis par octet virtuel) et les recommandations en temps réel (économie, rapide, prioritaire) proviennent de l’estimation mempool.space. Plus les entrées sont anciennes au format, plus la transaction est lourde : c’est pourquoi le choix du format d’adresse influence directement le coût d’usage.')}
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
        {t('Le constructeur embarque une composition multisig m-de-n : sélectionnez plusieurs clés publiques de votre bibliothèque, BitLab dérive l’adresse P2WSH correspondante et son script témoin — la dépense exigera la signature de m participants sur n.')}
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
        {t('BitLab est multi-réseaux : le sélecteur en haut à droite bascule l’intégralité des modules — portefeuilles, constructeur, explorateur et Lightning. Toutes les données on-chain transitent par un proxy Edge unique')}{' '}
        <span className="font-mono text-xs">/api/bitcoin</span> {t('qui applique une liste blanche stricte de chemins (protection anti-injection), un cache mémoire de 60 secondes par réseau, et relaie vers l’API Esplora publique correspondante. Aucune donnée utilisateur ne transite par ce canal : uniquement des informations publiques de la blockchain.')}
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
        {t('Chaque réseau de test expose ses faucets dans le module Portefeuille — avec une mention honnête de ce qu’ils exigent (aucun compte, captcha, ou connexion). Copiez votre adresse active, demandez des sats, puis observez la transaction apparaître dans votre solde — le laboratoire rafraîchit automatiquement les soldes via Esplora.')}
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
        {t(' : BitLab exécute deux nœuds')} <span className="font-mono text-xs">lightning (LDK, Rust)</span>{' '}
        {t('— le cœur Rust du Lightning Dev Kit, compilé en WebAssembly depuis rust/lnlab et piloté par un Web Worker dans votre navigateur. Ils se synchronisent sur la chaîne via le proxy Esplora et dialoguent par le protocole Lightning authentique (poignée de main Noise, messages BOLT) sur une paire de sockets en mémoire. Chaque nœud possède sa propre graine conservée exclusivement dans votre IndexedDB, ses canaux et son historique de paiements.')}
      </P>
      <H3>{t('Cycle de vie d’un canal')}</H3>
      <ul className="space-y-2.5">
        <Li><strong className="text-foreground">{t('Démarrer les nœuds')}</strong> — {t('les nœuds se reconstruisent depuis leur graine, se resynchronisent (blocs, frais) puis passent à l’état « opérationnel ».')}</Li>
        <Li><strong className="text-foreground">{t('Financer')}</strong> — {t('l’ouverture génère une adresse de financement P2WSH ; créditez-la depuis l’un de vos portefeuilles BitLab — la transaction est construite et signée localement, puis diffusée via le proxy.')}</Li>
        <Li><strong className="text-foreground">{t('Connecter')}</strong> — {t('A et B sont reliés par une paire de sockets en mémoire : chaque octet échangé est du vrai protocole (handshake Noise authentique), mais rien ne quitte votre machine.')}</Li>
        <Li><strong className="text-foreground">{t('Ouvrir')}</strong> — {t('la transaction de financement 2-de-2 est signée par les deux parties et diffusée ; le canal passe « en financement » puis « prêt » après confirmations.')}</Li>
        <Li><strong className="text-foreground">{t('Payer')}</strong> — {t('le payeur signe un HTLC vers la facture BOLT11 émise par le bénéficiaire ; le règlement met à jour les soldes locaux sans écriture on-chain.')}</Li>
        <Li><strong className="text-foreground">{t('Fermer')}</strong> — {t('clôture coopérative (une transaction consensuelle) ou forcée (diffusion d’un ancien état, assortie d’une pénalité).')}</Li>
      </ul>
      <H3>{t('Factures BOLT11')}</H3>
      <P>
        {t('Les factures émises par les nœuds sont réellement signées par leur clé Lightning et encodées au format BOLT11 : copiez le QR ou la chaîne lntb/lntbs et payez-la depuis n’importe quel portefeuille du réseau correspondant. Montant, hash de paiement, secret et expiration sont générés et vérifiés par le nœud lui-même.')}
      </P>
      <H3>{t('Offers BOLT12')}</H3>
      <P>
        {t('L’onglet Paiements sépare volontairement les deux protocoles pour éviter toute confusion. Une offer BOLT12 (lno1…) est un code de paiement réutilisable : A demande une facture au nœud B via messages onion chiffrés, B répond par une vraie facture BOLT12 portant un chemin de paiement aveuglé, puis le HTLC part sur le canal. Montant facultatif (paiement libre possible), note au payeur, décodeur intégré — le flux BOLT12 complet tourne réellement dans votre navigateur.')}
      </P>
      <H3>{t('Liquidité et honnêteté des erreurs')}</H3>
      <P>
        {t('À l’ouverture d’un canal, le champ « poussé au pair » transfère immédiatement de la liquidité à la contrepartie : en ouvrant A vers B avec 100 000 sats de capacité dont 40 000 poussés, B dispose d’un solde Lightning réel de 40 000 sats et peut émettre des factures que A paie instantanément. Le routage est un saut direct entre A et B — correct par construction pour un lab à deux nœuds — : sans liquidité suffisante, le paiement échoue et')}{' '}
        <strong className="text-foreground">{t('l’erreur exacte du réseau est affichée')}</strong> {t('— jamais masquée, jamais simulée. C’est précisément ce comportement qu’un développeur Lightning doit apprendre à lire.')}
      </P>
      <Callout kind="info" title={t('Pourquoi deux nœuds ?')}>
        {t('Lightning n’a de sens qu’entre pairs. Le lab embarque A et B pour réaliser un cycle complet (canal, facture, paiement, clôture) sans aucune dépendance externe ni serveur : tout tient dans votre navigateur.')}
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
        {t('Un unique proxy serveur alimente l’interface. Il n’expose aucune donnée sensible, filtre strictement les chemins autorisés, ajoute un cache court par réseau et relaie aussi les blocs bruts dont le lab Lightning se nourrit. Le module Lightning lui-même ne passe plus par le serveur : il vit dans votre navigateur.')}
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
        {t('Aucun endpoint HTTP : les deux nœuds tournent dans un Web Worker (public/lnlab/worker.js) qui charge le module WASM au premier démarrage. Les graines, monitors de canal et historiques restent dans l’IndexedDB du site, et seules les données publiques (blocs, frais, diffusion) transitent par /api/bitcoin. Le serveur n’héberge plus aucun nœud.')}
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
        <Li><strong className="text-foreground">{t('Stockage local')}</strong> — {t('portefeuilles et préférences vivent dans IndexedDB sur votre appareil ; effacez les données du site pour repartir de zéro.')}</Li>
        <Li><strong className="text-foreground">{t('Graines Lightning locales')}</strong> — {t('les nœuds LDK détiennent leurs propres graines (IndexedDB du site, jamais transmises au serveur) : n’y financez que des montants de test.')}</Li>
        <Li><strong className="text-foreground">{t('Mainnet = danger')}</strong> — {t('sur mainnet, frais, montants et destinataires sont irrévocables ; le lab verrouille tout financement mainnet par conception.')}</Li>
        <Li><strong className="text-foreground">{t('Vérifiez toujours')}</strong> — {t('adresse de réception complète, montant en sats, réseau actif dans le sélecteur : trois réflexes avant toute diffusion.')}</Li>
        <Li><strong className="text-foreground">{t('Transparence des erreurs')}</strong> — {t('chaque écran reflète l’état réel : une erreur Lightning (route absente, pair injoignable, fonds insuffisants) est affichée telle quelle.')}</Li>
      </ul>
      <Callout kind="warn" title={t('Environnement restreint')}>
        {t('Le lab Lightning s’exécute entièrement dans votre navigateur : aucun port sortant n’est nécessaire, et seul le proxy Esplora de l’application a besoin d’un accès Internet. Il fonctionne donc derrière les pare-feux les plus restrictifs.')}
      </Callout>
      <H3>{t('Références officielles')}</H3>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'developer.bitcoin.org', url: 'https://developer.bitcoin.org/' },
          { label: 'lightningdevkit.org', url: 'https://lightningdevkit.org/' },
          { label: 'docs.rs/lightning', url: 'https://docs.rs/lightning/latest/lightning/' },
          { label: 'mempool.space/docs/api', url: 'https://mempool.space/docs/api/rest' },
          { label: t('Index des BIPs'), url: 'https://github.com/bitcoin/bips' },
          { label: t('BOLT #11 (factures)'), url: 'https://github.com/lightning/bolts/blob/master/11-payment-encoding.md' },
        ].map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {l.label} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
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
];

const SECTIONS = [
  { id: 'demarrer', render: () => <SectionDemarrer /> },
  { id: 'cles-adresses', render: () => <SectionCles /> },
  { id: 'transactions', render: () => <SectionTransactions /> },
  { id: 'reseaux', render: () => <SectionReseaux /> },
  { id: 'lightning', render: () => <SectionLightning /> },
  { id: 'api', render: () => <SectionApi /> },
  { id: 'securite', render: () => <SectionSecurite /> },
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
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary text-primary-foreground">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">BitLab</span>
          </Link>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-px text-[11px] font-medium text-primary">Docs</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">{t('Guide du développeur')}</span>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t('Ouvrir le laboratoire')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero docs */}
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/8 via-transparent to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Zap className="h-3 w-3" /> {t('Documentation officielle du laboratoire')}
          </span>
          <h1 className="lab-display mt-4 max-w-3xl text-3xl leading-tight sm:text-[38px] sm:leading-[46px]">
            {t('Le guide du développeur Bitcoin & Lightning')}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {t('Clés et adresses, construction de transactions, multi-réseaux, nœuds LDK réels et API du laboratoire — tout ce que BitLab exécute, expliqué au niveau du protocole.')}
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
