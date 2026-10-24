/**
 * BitLab — Réglages du réseau regtest (côté navigateur).
 *
 * PAR DÉFAUT : la chaîne regtest est EMBARQUÉE dans l'application (moteur
 * serveur, cf. src/lib/regtest-engine) — aucune installation, ni Docker, ni
 * hyperviseur. Le mode « nœud externe » (avancé) permet de dialoguer avec le
 * Bitcoin Core de l'utilisateur via son interface REST (-rest=1) et deux RPC
 * strictement bornés (scantxoutset, sendrawtransaction) : dans ce mode
 * uniquement, l'adresse et les identifiants RPC sont stockés dans localStorage
 * et transmis au proxy par en-tête X-Regtest-Cfg (jamais dans l'URL).
 *
 * SÉCURITÉ : les identifiants ne quittent jamais la machine de l'utilisateur
 * (localStorage → serveur local) et le serveur revalide l'hôte cible
 * (boucle locale / réseaux privés uniquement — cf. regtest-translate.ts).
 */

export interface RegtestCfg {
  /** Hôte du nœud (127.0.0.1 par défaut — l'UI avertit pour tout autre choix). */
  host: string;
  /** Port RPC/REST partagé de Bitcoin Core (18443 en regtest). */
  port: number;
  /** rpcuser de bitcoin.conf — requis pour les RPC (solde, diffusion). */
  user: string;
  /** rpcpass / rpcauth de bitcoin.conf. */
  pass: string;
}

export const REGTEST_DEFAULTS: RegtestCfg = { host: '127.0.0.1', port: 18443, user: '', pass: '' };

const STORAGE_KEY = 'bitlab-regtest-rpc';
/** Nom d'en-tête transportant la config vers le proxy (valeur = base64 JSON). */
export const REGTEST_CFG_HEADER = 'x-regtest-cfg';

/* ───────── Mode regtest : embarqué (défaut) ou nœud externe ───────── */

export type RegtestMode = 'embedded' | 'external';
const MODE_KEY = 'bitlab-regtest-mode';

/** Mode actif : embarqué par défaut. Les utilisateurs ayant déjà configuré
 * des identifiants RPC restent en mode externe (migration sans rupture). */
export function regtestMode(): RegtestMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'embedded' || stored === 'external') return stored;
  } catch {
    /* stockage indisponible */
  }
  return loadRegtestCfg().user ? 'external' : 'embedded';
}

/** Change le mode actif (persisté en localStorage). */
export function setRegtestMode(mode: RegtestMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* stockage indisponible */
  }
}

/** Hôtes autorisés : boucle locale et plages privées (garde anti-SSRF, doublée côté serveur). */
export function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '::1' || h === '[::1]') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

/** Charge la configuration persistée (valeurs par défaut si absente/corrompue). */
export function loadRegtestCfg(): RegtestCfg {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...REGTEST_DEFAULTS };
    const cfg = JSON.parse(raw) as Partial<RegtestCfg>;
    const port = Number(cfg.port);
    return {
      host: typeof cfg.host === 'string' && cfg.host.trim() ? cfg.host.trim() : REGTEST_DEFAULTS.host,
      port: Number.isInteger(port) && port > 0 && port < 65_536 ? port : REGTEST_DEFAULTS.port,
      user: typeof cfg.user === 'string' ? cfg.user : '',
      pass: typeof cfg.pass === 'string' ? cfg.pass : '',
    };
  } catch {
    return { ...REGTEST_DEFAULTS };
  }
}

/** Persiste la configuration (localStorage uniquement — jamais transmise ailleurs). */
export function saveRegtestCfg(cfg: RegtestCfg): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* stockage indisponible — la session reste utilisable en mémoire */
  }
}

/** Valeur d'en-tête brute (base64 JSON) — réutilisée par le worker Lightning,
 * qui n'a pas accès à localStorage. */
export function regtestHeaderValue(): string {
  const cfg = loadRegtestCfg();
  try {
    const json = JSON.stringify(cfg);
    return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  } catch {
    return '';
  }
}

/**
 * En-têtes à joindre aux appels /api/bitcoin quand le réseau regtest est
 * actif. Mode embarqué : aucun en-tête — le moteur interne répond. Mode
 * externe uniquement : la config du nœud voyage pré-encodée (base64 JSON).
 */
export function regtestHeaders(): Record<string, string> {
  if (regtestMode() !== 'external') return {};
  const value = regtestHeaderValue();
  return value ? { [REGTEST_CFG_HEADER]: value } : {};
}

/** Décode l'en-tête X-Regtest-Cfg côté serveur — exporté pour être testé. */
export function decodeRegtestHeader(value: string | null): RegtestCfg | null {
  if (!value) return null;
  try {
    const json = base64ToUtf8(value);
    const cfg = JSON.parse(json) as Partial<RegtestCfg>;
    const port = Number(cfg.port);
    if (!cfg.host || !Number.isInteger(port) || port <= 0 || port >= 65_536) return null;
    return {
      host: cfg.host,
      port,
      user: typeof cfg.user === 'string' ? cfg.user : '',
      pass: typeof cfg.pass === 'string' ? cfg.pass : '',
    };
  } catch {
    return null;
  }
}

/** base64 → UTF-8 : atob navigateur, Buffer côté Node (tests / serveur). */
function base64ToUtf8(value: string): string {
  if (typeof atob === 'function') {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  const globals = globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
  if (globals.Buffer) return globals.Buffer.from(value, 'base64').toString('utf8');
  throw new Error('base64 indisponible');
}
