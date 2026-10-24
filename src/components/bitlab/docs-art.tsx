'use client';

/**
 * BitLab Docs — Illustrations vectorielles des sections du guide.
 * Bannières stylisées façon docs développeur (grille, dégradés, accents orange),
 * chaque composant est autonome (ids de dégradés préfixés). Textes traduits FR ⇄ EN via t().
 */
import { useT } from '@/lib/i18n';

const A = '#f7931a'; // orange Bitcoin
const B = '#ffb057'; // orange clair
const DIM = '#5b6472'; // gris des traits
const TXT = '#8b93a1';

function Grid({ id }: { id: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="880" height="240" fill={`url(#${id})`} />
    </>
  );
}

function Card({ x, y, w, h, title }: { x: number; y: number; w: number; h: number; title?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(148,163,184,0.25)" />
      {title ? (
        <text x={x + w / 2} y={y + h + 16} textAnchor="middle" fill={TXT} fontSize="11" fontFamily="inherit">
          {title}
        </text>
      ) : null}
    </g>
  );
}

/* ── 1. Démarrer — du navigateur au réseau ── */
export function ArtIntro() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Du navigateur au réseau Bitcoin')}>
      <Grid id="g-intro" />
      {/* Fenêtre navigateur */}
      <Card x={70} y={48} w={190} h={126} />
      <rect x={70} y={48} width={190} height={24} rx="10" fill="rgba(148,163,184,0.12)" />
      <circle cx="88" cy="60" r="4" fill={DIM} />
      <circle cx="102" cy="60" r="4" fill={DIM} />
      <rect x="86" y="88" width="70" height="8" rx="4" fill={A} opacity="0.9" />
      <rect x="86" y="106" width="150" height="6" rx="3" fill={DIM} opacity="0.5" />
      <rect x="86" y="120" width="130" height="6" rx="3" fill={DIM} opacity="0.35" />
      <rect x="86" y="138" width="90" height="6" rx="3" fill={DIM} opacity="0.35" />
      <text x="165" y="196" textAnchor="middle" fill={TXT} fontSize="11">{t('votre navigateur')}</text>

      {/* flèche */}
      <path d="M 272 110 L 330 110" stroke={A} strokeWidth="2" markerEnd="url(#arrow-intro)" />
      <defs>
        <marker id="arrow-intro" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={A} />
        </marker>
      </defs>

      {/* Parcours : 3 tuiles */}
      <g fontFamily="inherit">
        <Card x={344} y={58} w={140} h={104} title={t('1 · clés & adresses')} />
        <KeyGlyph cx={414} cy={104} />
        <Card x={500} y={58} w={140} h={104} title={t('2 · construction & signature')} />
        <rect x="540" y="88" width="60" height="14" rx="4" fill={A} opacity="0.85" />
        <rect x="552" y="110" width="36" height="14" rx="4" fill="none" stroke={B} />
        <text x="570" y="99" textAnchor="middle" fontSize="9" fill="#10141a">UTXO</text>
        <Card x={656} y={58} w={140} h={104} title={t('3 · diffusion & confirmation')} />
        <g>
          <rect x="686" y="86" width="26" height="26" rx="5" fill="none" stroke={A} />
          <rect x="704" y="98" width="26" height="26" rx="5" fill="none" stroke={DIM} />
          <rect x="722" y="110" width="26" height="26" rx="5" fill="none" stroke={DIM} />
        </g>
      </g>

      {/* blocs de chaîne décoratifs */}
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('BitLab — le cycle complet, en vrai')}</text>
    </svg>
  );
}

function KeyGlyph({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke={A} strokeWidth="2" fill="none">
      <circle cx={cx - 10} cy={cy} r="9" />
      <path d={`M ${cx - 1} ${cy} L ${cx + 22} ${cy} M ${cx + 14} ${cy} L ${cx + 14} ${cy + 7} M ${cx + 22} ${cy} L ${cx + 22} ${cy + 7}`} />
    </g>
  );
}

/* ── 2. Clés & adresses — arbre de dérivation ── */
export function ArtKeys() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Dérivation hiérarchique des clés')}>
      <Grid id="g-keys" />
      {/* Graine */}
      <Card x={60} y={70} w={150} h={100} title={t('phrase BIP39 (12/24 mots)')} />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 3 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={84 + c * 42} y={92 + r * 16} width={32} height={8} rx={4} fill={c === 0 ? A : DIM} opacity={c === 0 ? 0.85 : 0.4} />
        )),
      )}
      {/* nœud maître */}
      <path d="M 210 120 L 280 120" stroke={DIM} strokeWidth="1.5" />
      <circle cx="295" cy="120" r="14" fill="none" stroke={A} strokeWidth="2" />
      <text x="295" y="152" textAnchor="middle" fill={TXT} fontSize="10">{t('graine 512 bits')}</text>

      {/* branches */}
      <path d="M 309 120 C 350 120 350 62 390 62 M 309 120 L 390 120 M 309 120 C 350 120 350 178 390 178" stroke={DIM} strokeWidth="1.5" fill="none" />
      {[
        { y: 62, label: "m/44' — Legacy", addr: 'm… / n…', c: '#fbbf24' },
        { y: 120, label: "m/84' — SegWit", addr: 'tb1q…', c: A },
        { y: 178, label: "m/86' — Taproot", addr: 'tb1p…', c: '#34d399' },
      ].map((b) => (
        <g key={b.label}>
          <Card x={390} y={b.y - 24} w={220} h={48} />
          <rect x="404" y={b.y - 9} width="52" height="18" rx="4" fill="none" stroke={b.c} />
          <text x="430" y={b.y + 4} textAnchor="middle" fill={b.c} fontSize="10">{b.addr}</text>
          <text x="470" y={b.y + 4} fill={TXT} fontSize="11">{b.label}</text>
        </g>
      ))}
      {/* cadenas */}
      <g transform="translate(740 96)">
        <rect x="0" y="14" width="44" height="34" rx="7" fill="none" stroke={A} strokeWidth="2" />
        <path d="M 10 14 v-6 a12 12 0 0 1 24 0 v6" fill="none" stroke={A} strokeWidth="2" />
        <text x="22" y="66" textAnchor="middle" fill={TXT} fontSize="10">{'coin type 0\u2019 mainnet · 1\u2019 testnets'}</text>
      </g>
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Une graine, une arborescence, trois formats d’adresse')}</text>
    </svg>
  );
}

/* ── 3. Transactions — flux UTXO ── */
export function ArtTx() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Modèle UTXO d’une transaction')}>
      <Grid id="g-tx" />
      {/* entrées */}
      <text x="130" y="52" textAnchor="middle" fill={TXT} fontSize="11">{t('entrées (UTXO)')}</text>
      <Card x={60} y={66} w={140} h={40} />
      <text x="130" y="90" textAnchor="middle" fill={B} fontSize="10" fontFamily="monospace">3a7f…:0 · 42 000 sats</text>
      <Card x={60} y={116} w={140} h={40} />
      <text x="130" y="140" textAnchor="middle" fill={B} fontSize="10" fontFamily="monospace">9c21…:1 · 18 500 sats</text>

      <path d="M 200 86 L 320 108 M 200 136 L 320 132" stroke={DIM} strokeWidth="1.5" fill="none" />

      {/* transaction */}
      <Card x={320} y={72} w={220} h={96} />
      <text x="430" y="100" textAnchor="middle" fill={A} fontSize="13" fontWeight="600">transaction</text>
      <rect x="344" y="114" width="120" height="8" rx="4" fill={DIM} opacity="0.4" />
      <rect x="344" y="130" width="90" height="8" rx="4" fill={DIM} opacity="0.3" />
      <circle cx="514" cy="96" r="11" fill="none" stroke="#34d399" strokeWidth="2" />
      <path d="M 509 96 l 4 4 l 7 -8" fill="none" stroke="#34d399" strokeWidth="2" />
      <text x="430" y="188" textAnchor="middle" fill={TXT} fontSize="10">{t('signature ECDSA / Schnorr — dans le navigateur')}</text>

      <path d="M 540 104 L 640 84 M 540 136 L 640 156" stroke={DIM} strokeWidth="1.5" fill="none" />

      {/* sorties */}
      <text x="735" y="52" textAnchor="middle" fill={TXT} fontSize="11">{t('sorties')}</text>
      <Card x={640} y={66} w={190} h={40} />
      <text x="735" y="90" textAnchor="middle" fill={B} fontSize="10" fontFamily="monospace">{t('destinataire · 50 000 sats')}</text>
      <Card x={640} y={116} w={190} h={40} />
      <text x="735" y="140" textAnchor="middle" fill={B} fontSize="10" fontFamily="monospace">{t('monnaie rendue · 9 200 sats')}</text>
      <text x="735" y="190" textAnchor="middle" fill={TXT} fontSize="10">{t('différence = frais du mineur')}</text>

      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Chaque satoshi suit une chaîne de propriété vérifiable')}</text>
    </svg>
  );
}

/* ── 4. Réseaux ── */
export function ArtNetworks() {
  const { t } = useT();
  const nodes = [
    { x: 160, y: 70, label: 'Testnet4', c: '#10b981' },
    { x: 160, y: 170, label: 'Testnet3', c: '#0ea5e9' },
    { x: 720, y: 70, label: 'Signet', c: '#8b5cf6' },
    { x: 720, y: 170, label: 'Mainnet', c: A },
  ];
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Multi-réseaux via un proxy unique')}>
      <Grid id="g-net" />
      {nodes.map((n) => (
        <path key={n.label} d={`M ${n.x < 440 ? n.x + 60 : n.x - 60} ${n.y} L ${n.x < 440 ? 380 : 500} 120`} stroke={n.c} strokeWidth="1.5" opacity="0.55" fill="none" strokeDasharray="4 4" />
      ))}
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="22" fill="none" stroke={n.c} strokeWidth="2" />
          <circle cx={n.x} cy={n.y} r="7" fill={n.c} opacity="0.85" />
          <text x={n.x} y={n.y + 40} textAnchor="middle" fill={TXT} fontSize="11">{n.label}</text>
        </g>
      ))}
      {/* hub BitLab */}
      <rect x="380" y="94" width="120" height="52" rx="10" fill="rgba(247,147,26,0.12)" stroke={A} strokeWidth="1.5" />
      <text x="440" y="125" textAnchor="middle" fill={A} fontSize="13" fontWeight="600">BitLab</text>
      <text x="440" y="168" textAnchor="middle" fill={TXT} fontSize="10">{t('proxy Esplora unique · cache 60 s · liste blanche')}</text>
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Un sélecteur, quatre réseaux, mêmes primitives')}</text>
    </svg>
  );
}

/* ── 5. Lightning ── */
export function ArtLightning() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Canal Lightning entre deux nœuds')}>
      <Grid id="g-ln" />
      {/* nœud A */}
      <g>
        <circle cx="200" cy="120" r="46" fill="rgba(247,147,26,0.10)" stroke={A} strokeWidth="2" />
        <text x="200" y="116" textAnchor="middle" fill={A} fontSize="15" fontWeight="700">A</text>
        <text x="200" y="134" textAnchor="middle" fill={TXT} fontSize="9">BitLab-A · LDK</text>
      </g>
      {/* nœud B */}
      <g>
        <circle cx="680" cy="120" r="46" fill="rgba(52,211,153,0.10)" stroke="#34d399" strokeWidth="2" />
        <text x="680" y="116" textAnchor="middle" fill="#34d399" fontSize="15" fontWeight="700">B</text>
        <text x="680" y="134" textAnchor="middle" fill={TXT} fontSize="9">BitLab-B · LDK</text>
      </g>
      {/* canal */}
      <path d="M 248 120 L 632 120" stroke={B} strokeWidth="2.5" />
      <path d="M 420 96 l -18 30 h 14 l -8 26 l 26 -34 h -14 l 10 -22 z" fill={A} stroke="none" />
      <text x="440" y="86" textAnchor="middle" fill={B} fontSize="10">canal 2/2 · HTLC</text>
      {/* on-chain funding */}
      <path d="M 200 168 C 260 214 620 214 680 168" stroke={DIM} strokeWidth="1.5" fill="none" strokeDasharray="5 5" />
      <rect x="380" y="196" width="120" height="26" rx="7" fill="none" stroke={DIM} />
      <text x="440" y="213" textAnchor="middle" fill={TXT} fontSize="10">{t('financement on-chain 2/2')}</text>
      {/* capacité */}
      <text x="200" y="196" textAnchor="middle" fill={TXT} fontSize="10">{t('liquidité sortante')}</text>
      <text x="680" y="196" textAnchor="middle" fill={TXT} fontSize="10">{t('liquidité entrante')}</text>
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Paiements instantanés, routage par gossip, règlement sans écriture on-chain')}</text>
    </svg>
  );
}

/* ── 6. API ── */
export function ArtApi() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Architecture des API du laboratoire')}>
      <Grid id="g-api" />
      {/* navigateur */}
      <Card x={70} y={88} w={150} h={64} />
      <text x="145" y="124" textAnchor="middle" fill={TXT} fontSize="12">{t('interface BitLab')}</text>
      <path d="M 220 120 L 320 120" stroke={A} strokeWidth="2" />
      <text x="270" y="108" textAnchor="middle" fill={TXT} fontSize="10">fetch JSON</text>
      {/* proxy */}
      <rect x="320" y="88" width="180" height="64" rx="10" fill="rgba(247,147,26,0.10)" stroke={A} strokeWidth="1.5" />
      <text x="410" y="116" textAnchor="middle" fill={A} fontSize="12" fontWeight="600">{t('proxy serveur')}</text>
      <text x="410" y="136" textAnchor="middle" fill={TXT} fontSize="10">{t('liste blanche · cache · aucun secret')}</text>

      <path d="M 500 108 L 610 78" stroke={DIM} strokeWidth="1.5" fill="none" />
      {/* Esplora */}
      <Card x={610} y={54} w={200} h={54} />
      <text x="710" y="77" textAnchor="middle" fill={B} fontSize="11">/api/bitcoin → Esplora</text>
      <text x="710" y="95" textAnchor="middle" fill={TXT} fontSize="10">{t('blocs · adresses · UTXO · frais · diffusion')}</text>
      {/* module Lightning : direct navigateur, sans serveur */}
      <path d="M 145 152 L 145 205 L 710 205 L 710 186" stroke={DIM} strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
      <text x="427" y="199" textAnchor="middle" fill={DIM} fontSize="10">Web Worker + WASM</text>
      <Card x={610} y={132} w={200} h={54} />
      <text x="710" y="155" textAnchor="middle" fill={B} fontSize="11">{t('module Lightning — navigateur')}</text>
      <text x="710" y="173" textAnchor="middle" fill={TXT} fontSize="10">{t('nœuds réels · factures · canaux')}</text>
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Un proxy strict, zéro donnée sensible exposée')}</text>
    </svg>
  );
}

/* ── 7. Sécurité ── */
export function ArtSecurity() {
  const { t } = useT();
  return (
    <svg viewBox="0 0 880 240" className="h-auto w-full" role="img" aria-label={t('Les clés restent dans le navigateur')}>
      <Grid id="g-sec" />
      {/* coffre navigateur */}
      <g transform="translate(120 70)">
        <path d="M 0 24 L 52 0 L 104 24 V 78 Q 52 104 0 78 Z" fill="rgba(247,147,26,0.10)" stroke={A} strokeWidth="2" />
        <circle cx="52" cy="48" r="13" fill="none" stroke={A} strokeWidth="2" />
        <rect x="49" y="48" width="6" height="12" rx="3" fill={A} />
        <text x="52" y="126" textAnchor="middle" fill={TXT} fontSize="11">{t('clés privées · IndexedDB locale')}</text>
      </g>
      {/* barré serveur */}
      <g transform="translate(620 70)">
        <rect x="10" y="14" width="130" height="72" rx="10" fill="none" stroke={DIM} strokeDasharray="5 4" />
        <text x="75" y="46" textAnchor="middle" fill={DIM} fontSize="12">{t('serveur')}</text>
        <text x="75" y="64" textAnchor="middle" fill={DIM} fontSize="10">{t('aucun secret détenu')}</text>
        <path d="M 4 92 L 146 8" stroke="#ef4444" strokeWidth="2.5" />
        <text x="75" y="126" textAnchor="middle" fill={TXT} fontSize="11">{t('architecture Zero-Knowledge')}</text>
      </g>
      <path d="M 240 106 L 610 106" stroke={DIM} strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="425" y="96" textAnchor="middle" fill={B} fontSize="11">{t('seules les données publiques transitent')}</text>
      <text x="440" y="30" textAnchor="middle" fill={B} fontSize="12" fontWeight="600">{t('Ce que le navigateur signe, le serveur ne le saura jamais')}</text>
    </svg>
  );
}
