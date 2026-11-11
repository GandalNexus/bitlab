/**
 * Pont BitLab → BitQuest : helpers de parsing / construction des URL de
 * mission.
 *
 * Protocole (owner : BitQuest, docs/PHASE_3_BITLAB.md §« Protocole deep-link ») :
 *
 *   SENDER (BitQuest → BitLab) : URL de cette app avec les params
 *     ?questCode=<kebab>&kind=<TX|BLOCK|INVOICE|CHANNEL|ADDRESS>
 *      &network=<testnet4|signet|regtest>&returnTo=<URL BitQuest>
 *      [&ts=<unix>&sig=<base64url>]
 *
 *   RECEIVER (BitLab → BitQuest) : on redirige l'apprenant vers
 *     ${returnTo}?bitlab_result=1&kind=…&network=…&<field>=<value>
 *     [&ts=…&sig=…]  (ts/sig échoés tels quels)
 *
 *   `field` dépend du kind :
 *     TX → txid, BLOCK → hash, INVOICE → bolt11,
 *     CHANNEL → scid, ADDRESS → address
 *
 * ⚠️ BitLab **n'est pas** le propriétaire du secret HMAC (vit côté serveur
 * BitQuest, cf. BITLAB_SIGN_SECRET). On se contente ici d'échoer `ts` et
 * `sig` tels quels : la vérification se fait côté BitQuest à la réception
 * via `POST /api/bitlab/deep-link/verify-return`.
 */

import type { NetId } from './networks';

export type BitquestKind = 'TX' | 'BLOCK' | 'INVOICE' | 'CHANNEL' | 'ADDRESS';

export const BITQUEST_KINDS = ['TX', 'BLOCK', 'INVOICE', 'CHANNEL', 'ADDRESS'] as const;

export interface BitquestMission {
  questCode: string;
  kind: BitquestKind;
  network: NetId;
  returnTo: string;
  /** Timestamp unix (seconds) si BitQuest signe le lien. */
  ts: number | null;
  /** HMAC-SHA256 base64url si BitQuest signe le lien. */
  sig: string | null;
}

/** Nom du param de retour selon le kind. */
export const RETURN_FIELD_BY_KIND: Record<BitquestKind, string> = {
  TX: 'txid',
  BLOCK: 'hash',
  INVOICE: 'bolt11',
  CHANNEL: 'scid',
  ADDRESS: 'address',
};

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KNOWN_NETWORKS: readonly NetId[] = ['testnet4', 'signet', 'regtest'] as const;

function isKind(v: string): v is BitquestKind {
  return (BITQUEST_KINDS as readonly string[]).includes(v);
}

function isAllowedNetwork(v: string): v is NetId {
  return (KNOWN_NETWORKS as readonly string[]).includes(v);
}

/**
 * Valide que returnTo est bien une URL absolue (nécessaire pour window.location.href).
 * Évite l'open-redirect trivial en refusant les schémas autres que http(s).
 */
function isSafeReturnTo(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Parse les params URL d'une entrée BitQuest. Retourne null si les params
 * sont absents ou invalides (BitLab fonctionne normalement sans mission).
 */
export function parseBitquestMission(params: URLSearchParams): BitquestMission | null {
  const questCode = params.get('questCode')?.trim() ?? '';
  const kindRaw = params.get('kind')?.trim() ?? '';
  const networkRaw = params.get('network')?.trim() ?? '';
  const returnTo = params.get('returnTo')?.trim() ?? '';

  if (!questCode || !KEBAB_RE.test(questCode)) return null;
  if (!isKind(kindRaw)) return null;
  if (!isAllowedNetwork(networkRaw)) return null;
  if (!returnTo || !isSafeReturnTo(returnTo)) return null;

  const tsRaw = params.get('ts');
  const sigRaw = params.get('sig');
  const ts = tsRaw && /^\d+$/.test(tsRaw) ? Number(tsRaw) : null;
  const sig = sigRaw && sigRaw.length >= 16 && sigRaw.length <= 128 ? sigRaw : null;

  return {
    questCode,
    kind: kindRaw,
    network: networkRaw,
    returnTo,
    ts,
    sig,
  };
}

/**
 * Validation minimale par kind du payload à renvoyer. Le serveur BitQuest
 * refera une validation stricte (regex + lookup explorateur), mais on
 * évite d'envoyer n'importe quoi côté UX.
 */
export function isValidReturnValue(kind: BitquestKind, raw: string): boolean {
  const v = raw.trim();
  if (v.length === 0) return false;
  switch (kind) {
    case 'TX':
    case 'BLOCK':
      return /^[0-9a-f]{64}$/i.test(v);
    case 'INVOICE':
      return /^ln[a-z0-9]{10,}$/i.test(v);
    case 'CHANNEL':
      return /^\d+x\d+x\d+$/.test(v) || /^\d{10,24}$/.test(v);
    case 'ADDRESS':
      return /^[a-zA-Z0-9]{10,100}$/.test(v);
  }
}

/**
 * Construit l'URL de retour vers BitQuest avec la preuve. `ts` et `sig`
 * sont échoés tels quels (BitQuest les re-vérifiera avec son secret).
 */
export function buildReturnUrl(mission: BitquestMission, value: string): string {
  const url = new URL(mission.returnTo);
  url.searchParams.set('bitlab_result', '1');
  url.searchParams.set('kind', mission.kind);
  url.searchParams.set('network', mission.network);
  url.searchParams.set(RETURN_FIELD_BY_KIND[mission.kind], value);
  if (mission.ts !== null) url.searchParams.set('ts', String(mission.ts));
  if (mission.sig !== null) url.searchParams.set('sig', mission.sig);
  return url.toString();
}

/** Mapping kind → onglet BitLab à pré-sélectionner automatiquement. */
export type BitlabTab =
  | 'dashboard'
  | 'portefeuille'
  | 'transactions'
  | 'lightning'
  | 'mineur'
  | 'explorateur';

export function kindToTab(kind: BitquestKind): BitlabTab {
  switch (kind) {
    case 'TX':
      return 'transactions';
    case 'BLOCK':
      return 'mineur';
    case 'INVOICE':
    case 'CHANNEL':
      return 'lightning';
    case 'ADDRESS':
      return 'portefeuille';
  }
}
