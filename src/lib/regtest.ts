export interface RegtestCfg {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export const REGTEST_DEFAULTS: RegtestCfg = { host: '127.0.0.1', port: 18443, user: '', pass: '' };

const STORAGE_KEY = 'bitlab-regtest-rpc';
export const REGTEST_CFG_HEADER = 'x-regtest-cfg';

export type RegtestMode = 'embedded' | 'external';
const MODE_KEY = 'bitlab-regtest-mode';

export function regtestMode(): RegtestMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'embedded' || stored === 'external') return stored;
  } catch {
  }
  return loadRegtestCfg().user ? 'external' : 'embedded';
}

export function setRegtestMode(mode: RegtestMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
  }
}

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

export function saveRegtestCfg(cfg: RegtestCfg): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
  }
}

export function regtestHeaderValue(): string {
  const cfg = loadRegtestCfg();
  try {
    const json = JSON.stringify(cfg);
    return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  } catch {
    return '';
  }
}

export function regtestHeaders(): Record<string, string> {
  if (regtestMode() !== 'external') return {};
  const value = regtestHeaderValue();
  return value ? { [REGTEST_CFG_HEADER]: value } : {};
}

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

function base64ToUtf8(value: string): string {
  if (typeof atob === 'function') {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  const globals = globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
  if (globals.Buffer) return globals.Buffer.from(value, 'base64').toString('utf8');
  throw new Error('base64 indisponible');
}
