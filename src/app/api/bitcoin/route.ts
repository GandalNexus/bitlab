/**
 * BitLab — multi-network Esplora proxy (Edge).
 *
 * Public networks (mainnet, testnet3, testnet4, signet): relay to public
 * mempool.space nodes with strict path sanitization (regex whitelist) to
 * prevent injection.
 *
 * Local network (regtest): BY DEFAULT an embedded regtest chain engine in the
 * BitLab process responds in Esplora format (no installation, Docker, or hypervisor
 * — see src/lib/regtest-engine). If user enabled "external node" mode (Settings card,
 * X-Regtest-Cfg header present), proxy translates paths to user's local Bitcoin Core
 * (-rest=1) and two strictly scoped RPCs — historical behavior preserved.
 *
 * No sensitive data (private key, mnemonic) transits through this route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { decodeRegtestHeader, isLocalHost, type RegtestCfg } from '@/lib/regtest';
import { getRegtestChain, persist } from '@/lib/regtest-engine/server';
import { handleEsploraPath } from '@/lib/regtest-engine/esplora-router';
import {
  blockHashByHeight,
  chainInfoToTipHash,
  chainInfoToTipHeight,
  coreBlockToSummary,
  coreTxToEsplora,
  headersToFirstHeader,
  mempoolContentsToRecent,
  mempoolInfoToStats,
  planRegtestRequest,
  scantxoutsetToAddressInfo,
  scantxoutsetToUtxos,
} from '@/lib/bitcoin/regtest-translate';

const UPSTREAMS: Record<string, string> = {
  mainnet: 'https://mempool.space/api',
  testnet3: 'https://mempool.space/testnet/api',
  testnet4: 'https://mempool.space/testnet4/api',
  signet: 'https://mempool.space/signet/api',
};

const DEFAULT_NET = 'testnet4';

/** Strict whitelist of allowed paths (injection protection). */
const ALLOWED_GET: RegExp[] = [
  /^v1\/fees\/recommended$/,
  /^blocks\/tip\/height$/,
  /^blocks\/tip\/hash$/,
  /^v1\/blocks(\/\d{1,2})?$/,
  /^mempool$/,
  /^mempool\/recent$/,
  /^address\/[a-z0-9]{6,90}(\/utxo|\/txs)?$/i,
  /^tx\/[a-f0-9]{64}$/i,
  /^tx\/[a-f0-9]{64}\/hex$/i,
  // Lightning lab: block position and raw download.
  /^block-height\/\d+$/,
  /^block\/[a-f0-9]{64}\/raw$/i,
  // Block detail (embedded regtest explorer).
  /^block\/[a-f0-9]{64}$/i,
  // Testnet4 miner: tip header for BIP 94 template assembly.
  /^block\/[a-f0-9]{64}\/header$/i,
  // Global Lightning stats (mempool.space, mainnet).
  /^v1\/lightning\/statistics\/latest$/,
];

/** Raw block (bytes): transferred as-is, never cached in memory. */
const RAW_BLOCK = /^block\/[a-f0-9]{64}\/raw$/i;

function sanitizePath(raw: string | null): string | null {
  if (!raw) return null;
  const path = decodeURIComponent(raw).replace(/[^a-zA-Z0-9/_-]/g, '');
  return ALLOWED_GET.some((rx) => rx.test(path)) ? path : null;
}

function sanitizeNet(raw: string | null): string {
  return raw && (raw in UPSTREAMS || raw === 'regtest') ? raw : DEFAULT_NET;
}

/* ───────────────────────── Regtest adapter (local node) ───────────────────────── */

const REST_TIMEOUT_MS = 8_000;
const RPC_TIMEOUT_MS = 15_000;

/** Valide la config du nœud : hôte local/privé uniquement, port explicite. */
function safeRegtestCfg(req: NextRequest): RegtestCfg | null {
  const cfg = decodeRegtestHeader(req.headers.get('x-regtest-cfg'));
  if (!cfg || !isLocalHost(cfg.host)) return null;
  return cfg;
}

/** Appel JSON-RPC 1.0 strictement borné (methodes whitelistées par les appelants). */
async function regtestRpc(cfg: RegtestCfg, method: string, params: unknown[]): Promise<unknown> {
  const auth = Buffer.from(`${cfg.user}:${cfg.pass}`).toString('base64');
  const res = await fetch(`http://${cfg.host}:${cfg.port}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Basic ${auth}` },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'bitlab', method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => null)) as { result?: unknown; error?: { message?: string } } | null;
  if (!body) throw new Error(`réponse RPC illisible (${res.status})`);
  if (body.error) throw new Error(body.error.message ?? 'erreur RPC');
  return body.result;
}

function jsonRes(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-network': 'regtest' },
  });
}

function textRes(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { 'content-type': 'text/plain', 'x-network': 'regtest' } });
}

/** Requête REST Core → réponse traduite ou transférée. */
async function regtestRest(
  cfg: RegtestCfg,
  upstream: string,
  accept: 'json' | 'bin' | 'hex',
  path: string,
): Promise<NextResponse> {
  const url = `http://${cfg.host}:${cfg.port}/rest/${upstream}`;
  const res = await fetch(url, {
    headers: { accept: accept === 'bin' ? 'application/octet-stream' : 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(REST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = accept === 'bin' ? 'bloc indisponible' : (await res.text().catch(() => '')).slice(0, 160);
    return jsonRes({ erreur: `Nœud regtest : ${detail || `REST ${res.status}`}` }, res.status === 404 ? 404 : 502);
  }
  if (accept === 'bin') {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return new NextResponse(bytes, { status: 200, headers: { 'content-type': 'application/octet-stream', 'x-network': 'regtest' } });
  }
  const text = (await res.text()).trim();
  if (accept === 'hex') return textRes(text);

  const json: unknown = text ? JSON.parse(text) : null;

  // Chemins « brut de texte » : hauteur/hash du tip, hash par hauteur, en-tête.
  if (path === 'blocks/tip/height') {
    const h = chainInfoToTipHeight(json as { blocks?: unknown });
    return h === null ? jsonRes({ erreur: 'chaininfo illisible' }, 502) : textRes(String(h));
  }
  if (path === 'blocks/tip/hash') {
    const h = chainInfoToTipHash(json as { bestblockhash?: unknown });
    return h === null ? jsonRes({ erreur: 'chaininfo illisible' }, 502) : textRes(h);
  }
  if (/^block-height\/\d+$/.test(path)) {
    const h = blockHashByHeight(json);
    return h === null ? jsonRes({ erreur: `aucun bloc à cette hauteur` }, 404) : textRes(h);
  }
  if (/^block\/[0-9a-f]{64}\/header$/i.test(path)) {
    const header = headersToFirstHeader(json);
    return header === null ? jsonRes({ erreur: 'en-tête indisponible' }, 502) : textRes(header);
  }
  if (/^tx\/[0-9a-f]{64}$/i.test(path)) {
    return jsonRes(coreTxToEsplora(json, path.slice(3).toLowerCase()));
  }
  if (path === 'mempool') return jsonRes(mempoolInfoToStats(json));
  if (path === 'mempool/recent') return jsonRes(mempoolContentsToRecent(json));

  // v1/blocks : parcours des 10 derniers blocs via les previousblockhash.
  if (path === 'v1/blocks' || /^v1\/blocks\/\d{1,2}$/.test(path)) {
    const wanted = Number(path.split('/')[2] ?? 10) || 10;
    const tipHash = chainInfoToTipHash(json as { bestblockhash?: unknown });
    if (!tipHash) return jsonRes({ erreur: 'chaininfo illisible' }, 502);
    const summaries: unknown[] = [];
    let hash: string | null = tipHash;
    for (let i = 0; i < Math.min(wanted, 10) && hash !== null; i++) {
      const current: string = hash;
      const blockRes = await fetch(`http://${cfg.host}:${cfg.port}/rest/block/${current}.json`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(REST_TIMEOUT_MS),
      });
      if (!blockRes.ok) break;
      const block = (await blockRes.json().catch(() => null)) as { previousblockhash?: unknown } | null;
      const summary = coreBlockToSummary(block);
      if (!summary) break;
      summaries.push(summary);
      const prev = block?.previousblockhash;
      hash = typeof prev === 'string' && /^[0-9a-f]{64}$/i.test(prev) ? prev : null;
    }
    return jsonRes(summaries);
  }

  return jsonRes({ erreur: 'chemin regtest non traduit' }, 400);
}

/** GET regtest : dispatch statique / REST / RPC. */
async function regtestGet(path: string, cfg: RegtestCfg | null): Promise<NextResponse> {
  const plan = planRegtestRequest(path);
  switch (plan.kind) {
    case 'static':
      return jsonRes(plan.body);
    case 'empty':
      return jsonRes([]);
    case 'unsupported':
      return jsonRes({ erreur: 'Chemin API non autorisé.' }, 400);
    case 'rest':
      if (!cfg) return jsonRes({ erreur: 'Regtest : hôte du nœud local non configuré (carte Réglages du module Portefeuille).' }, 400);
      return regtestRest(cfg, plan.upstream, plan.accept, path);
    case 'rpc':
      if (!cfg) return jsonRes({ erreur: 'Regtest : hôte du nœud local non configuré (carte Réglages du module Portefeuille).' }, 400);
      if (!cfg.user) {
        return jsonRes(
          { erreur: 'Regtest : identifiants RPC requis (rpcuser/rpcpass de bitcoin.conf — carte Réglages du module Portefeuille).' },
          400,
        );
      }
      try {
        const result = await regtestRpc(cfg, 'scantxoutset', ['start', [`addr(${plan.address})`]]);
        if (path.toLowerCase().endsWith('/utxo')) return jsonRes(scantxoutsetToUtxos(result));
        return jsonRes(scantxoutsetToAddressInfo(result, plan.address));
      } catch (err) {
        return jsonRes({ erreur: `RPC scantxoutset : ${(err as Error).message}` }, 502);
      }
  }
}

/* ───────────────────────── Route principale ───────────────────────── */

/** Cache mémoire court (60 s) par réseau pour limiter la charge sur les nœuds publics. */
const cache = new Map<string, { at: number; body: string; status: number }>();
const TTL = 60_000;
/**
 * Plafond mémoire : les adresses explorées ne doivent jamais faire croître
 * le cache indéfiniment (processus serveur long-vivant). Au-delà de MAX,
 * on purge d'abord les entrées expirées, puis on évince les plus anciennes.
 */
const MAX_CACHE_ENTRIES = 300;

function evictCache(): void {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (cache.size <= MAX_CACHE_ENTRIES) break;
    if (now - entry.at >= TTL) cache.delete(key);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function GET(req: NextRequest) {
  const path = sanitizePath(req.nextUrl.searchParams.get('path'));
  if (!path) {
    return NextResponse.json({ erreur: 'Chemin API non autorisé.' }, { status: 400 });
  }
  const net = sanitizeNet(req.nextUrl.searchParams.get('network'));

  // Regtest : moteur embarqué par défaut — nœud externe si l'en-tête de
  // configuration est présent (mode avancé de la carte Réglages).
  if (net === 'regtest') {
    const cfg = safeRegtestCfg(req);
    if (cfg) {
      try {
        return await regtestGet(path, cfg);
      } catch {
        return NextResponse.json({ erreur: 'Nœud regtest injoignable — vérifiez que Bitcoin Core tourne avec -rest=1.' }, { status: 502 });
      }
    }
    // Moteur embarqué : aucune configuration, aucune installation requise.
    try {
      const chain = await getRegtestChain();
      const result = handleEsploraPath(chain, path);
      if (result.type === 'bin') {
        return new NextResponse(result.body as unknown as BodyInit, {
          status: result.status,
          headers: { 'content-type': 'application/octet-stream', 'x-network': 'regtest', 'x-engine': 'embedded' },
        });
      }
      const textBody = result.type === 'json' ? JSON.stringify(result.body) : String(result.body);
      return new NextResponse(textBody, {
        status: result.status,
        headers: { 'content-type': result.type === 'json' ? 'application/json' : 'text/plain', 'x-network': 'regtest', 'x-engine': 'embedded' },
      });
    } catch (err) {
      return NextResponse.json({ erreur: `Moteur regtest embarqué : ${(err as Error).message}` }, { status: 500 });
    }
  }

  const cacheKey = `${net}:${path}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) {
    return new NextResponse(hit.body, {
      status: hit.status,
      headers: { 'content-type': 'application/json', 'x-cache': 'hit', 'x-network': net },
    });
  }
  try {
    if (RAW_BLOCK.test(path)) {
      // Un bloc complet peut dépasser 1 Mo : transfert binaire sans cache.
      const upstream = await fetch(`${UPSTREAMS[net]}/${path}`, {
        headers: { accept: 'application/octet-stream' },
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok) {
        return NextResponse.json({ erreur: `Bloc indisponible sur ${net}.` }, { status: upstream.status });
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      return new NextResponse(bytes, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', 'x-network': net },
      });
    }
    const upstream = await fetch(`${UPSTREAMS[net]}/${path}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    const body = await upstream.text();
    if (upstream.ok) {
      cache.set(cacheKey, { at: Date.now(), body, status: upstream.status });
      evictCache();
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'x-cache': 'miss',
        'x-network': net,
      },
    });
  } catch {
    return NextResponse.json({ erreur: `Nœud ${net} injoignable depuis le proxy.` }, { status: 502 });
  }
}

/** Diffusion d'une transaction brute signée (POST /tx) sur le réseau choisi. */
export async function POST(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (path !== 'tx') {
    return NextResponse.json({ erreur: 'Seule la diffusion de transaction (path=tx) est autorisée.' }, { status: 400 });
  }
  const net = sanitizeNet(req.nextUrl.searchParams.get('network'));
  const raw = (await req.text()).trim();
  if (!/^[0-9a-fA-F]{120,}$/.test(raw)) {
    return NextResponse.json({ erreur: 'Transaction brute hexadécimale invalide.' }, { status: 400 });
  }

  // Regtest : moteur embarqué par défaut (acceptation mempool réelle) —
  // ou diffusion via RPC sendrawtransaction si un nœud externe est configuré.
  if (net === 'regtest') {
    const cfg = safeRegtestCfg(req);
    if (cfg) {
      if (!cfg.user) return NextResponse.json({ erreur: 'Regtest : identifiants RPC requis pour diffuser une transaction.' }, { status: 400 });
      try {
        const txid = await regtestRpc(cfg, 'sendrawtransaction', [raw]);
        const id = typeof txid === 'string' ? txid.replace(/"/g, '').trim() : '';
        if (!/^[0-9a-f]{64}$/i.test(id)) throw new Error('réponse inattendue');
        return new NextResponse(id, { status: 200, headers: { 'content-type': 'text/plain', 'x-network': net } });
      } catch (err) {
        return NextResponse.json({ erreur: `Diffusion regtest refusée : ${(err as Error).message}` }, { status: 400 });
      }
    }
    try {
      const chain = await getRegtestChain();
      const { txid } = chain.acceptTx(raw);
      await persist(chain);
      return new NextResponse(txid, { status: 200, headers: { 'content-type': 'text/plain', 'x-network': net, 'x-engine': 'embedded' } });
    } catch (err) {
      return NextResponse.json({ erreur: `Diffusion regtest refusée : ${(err as Error).message}` }, { status: 400 });
    }
  }

  try {
    const upstream = await fetch(`${UPSTREAMS[net]}/tx`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: raw,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.text();
    return new NextResponse(body, { status: upstream.status, headers: { 'content-type': 'text/plain', 'x-network': net } });
  } catch {
    return NextResponse.json({ erreur: `Nœud ${net} injoignable pour la diffusion.` }, { status: 502 });
  }
}
