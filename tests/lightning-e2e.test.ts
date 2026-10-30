/**
 * BitLab — test e2e du labo Lightning (Vitest, 100 % hors-ligne).
 *
 * Charge le vrai binaire WASM `lnlab` (deux nœuds LDK 0.2 complets, artefact
 * commité sous public/lnlab/) dans Node et exécute le scénario complet du
 * laboratoire sur la chaîne regtest embarquée du serveur (RegtestChain —
 * vraie PoW, vraie vérification de signatures) :
 *
 *   1. boot_fresh + handshake Noise réel A↔B (connect_ab, auto-réparateur) ;
 *   2. ouverture de canal : create_channel → event funding_generation_ready →
 *      construction de la transaction de financement par le VRAI constructeur
 *      du labo (buildSignedTx) → acceptTx → funding_transaction_generated ;
 *   3. confirmation : 8 blocs minés puis nourris aux deux nœuds (chain_block)
 *      → channel_ready ;
 *   4. BOLT11 : facture signée par B (préfixe lncrt), décodée par le décodeur
 *      WASM statique, payée par A (HTLC réel) → payment_sent / payment_claimed
 *      et capacités du canal mises à jour ;
 *   5. BOLT12 : offer créée par B, décodée, payée par A via onion messages
 *      (demande de facture + paiement HTLC) ;
 *   6. fermeture coopérative : close_channel → transaction de fermeture
 *      broadcastée vers la chaîne (via l'hôte) → channel_closed ;
 *   7. persistance : drain du KV (contrat [nœud, primaire, secondaire, clé,
 *      octets]) puis boot_restore → mêmes identités de nœuds, re-handshake.
 *
 * La persistance JS (IndexedDB) est simulée par une Map — même contrat que
 * flushKv côté contrôleur (src/lib/lightning.ts).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { hex } from '@scure/base';
import { RegtestChain } from '../src/lib/regtest-engine/chain';
import { registerNetGetter } from '../src/lib/networks';
import { deriveForType } from '../src/lib/bitcoin/keys';
import { buildSignedTx, scriptToAddressOn } from '../src/lib/bitcoin/tx';

registerNetGetter(() => 'regtest');

const LNLWASM = path.resolve(__dirname, '../public/lnlab');

/* ───────────── Chaîne regtest embarquée (moteur du serveur) ───────────── */

const chain = new RegtestChain();

/** Journal des broadcasts LDK (transactions remises à l'hôte via WASM). */
const broadcasts: { network: string; txHex: string; ok: boolean; detail?: string }[] = [];

/* ───────────── Hôte WASM (même contrat que public/lnlab/worker.js) ───────────── */

(globalThis as Record<string, unknown>).lnlabHost = {
  hostLog(_level: number | string, message: string) {
    if (/erreur|panic|échec|refus/i.test(message)) throw new Error(`hostLog: ${message}`);
  },
  hostBroadcast(network: string, txHex: string) {
    try {
      chain.acceptTx(txHex);
      broadcasts.push({ network, txHex, ok: true });
    } catch (err) {
      const detail = String(err);
      // Un nœud LDK vivant re-diffuse ses transactions à l'annonce et aux
      // reconnexions : « transaction déjà connue » est un succès idempotent
      // (mempool.space répond exactement pareil aux doublons).
      const duplicate = /déjà connue|already/.test(detail);
      broadcasts.push({ network, txHex, ok: duplicate, detail: duplicate ? undefined : detail });
    }
  },
};

/* ───────────── Chargement du glue wasm-bindgen (artefact réel) ───────────── */

type WasmEvent = { node: string; type: string; [field: string]: string | undefined };

let LnLabClass: (typeof import('../public/lnlab/lnlab').LnLab) | null = null;
let lab: any = null;

beforeAll(async () => {
  const glue = await import(pathToFileURL(path.join(LNLWASM, 'lnlab_bg.js')).href);
  const init = glue.default as typeof import('../public/lnlab/lnlab').default;
  // Le Buffer est un Uint8Array : le glue le passe à WebAssembly.instantiate
  // directement (aucun fetch, aucun serveur requis).
  await init(readFileSync(path.join(LNLWASM, 'lnlab_bg.wasm')));
  LnLabClass = init.LnLab as typeof LnLabClass;
  expect(LnLabClass).toBeDefined();
});

/* ───────────── Aides (reproduisent le rôle du worker + du contrôleur) ───────────── */

/** Drains pending events : plusieurs rounds, comme le tick du worker (1 s). */
function drain(lab: any, rounds = 12): WasmEvent[] {
  const out: WasmEvent[] = [];
  for (let i = 0; i < rounds; i += 1) out.push(...(Array.from(lab.tick()) as WasmEvent[]));
  return out;
}

/** Mines `n` blocs (vraie PoW) puis les nourrit aux deux nœuds LDK. */
function mineAndFeed(lab: any, count: number): WasmEvent[] {
  const start = chain.tipHeight();
  chain.mineTo(null, count);
  const events: WasmEvent[] = [];
  for (let h = start + 1; h <= chain.tipHeight(); h += 1) {
    const hash = chain.blockHashAtHeight(h);
    if (!hash) throw new Error(`bloc ${h} introuvable`);
    // Format consensus (en-tête + compteur de txs) : le stockage interne
    // omet le compteur, LDK le refuse sinon (« bloc non décodable »).
    const blockHex = chain.consensusBlockByHash(hash);
    if (!blockHex) throw new Error(`bloc consensus ${h} indisponible`);
    events.push(...(Array.from(lab.chain_block(h, blockHex)) as WasmEvent[]));
  }
  return events;
}

/** Persistance simulée (même contrat que flushKv : 5-tuples → Map + IDB). */
const kvStore = new Map<string, Uint8Array>();
function flushKv(node: any): number {
  let n = 0;
  for (const entry of Array.from(node.kv_dirty()) as [string, string, string, string, Uint8Array | null][]) {
    const [label, primary, secondary, key, value] = entry;
    const composite = `${label}|${primary}|${secondary}|${key}`;
    if (value === null || value === undefined) kvStore.delete(composite);
    else kvStore.set(composite, value);
    n += 1;
  }
  return n;
}

/** 4-tuples [primaire, secondaire, clé, octets] du nœud (contrat boot_restore). */
function kvOf(nodeLabel: 'A' | 'B'): Array<[string, string, string, Uint8Array]> {
  const out: Array<[string, string, string, Uint8Array]> = [];
  for (const [composite, value] of kvStore) {
    if (!composite.startsWith(`${nodeLabel}|`)) continue;
    const [, primary, secondary, key] = composite.split('|');
    out.push([primary, secondary, key, value]);
  }
  return out;
}

/** Normalise le booléen du WASM : "true"/"false" (chaînes) ou booléen natif. */
function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true';
  return Boolean(v);
}

/** Portefeuille déterministe (clé dérivée via le code réel du labo). */
function makeWallet(seed: number) {
  const priv = hex.decode(seed.toString(16).padStart(64, '0'));
  const { address } = deriveForType(priv, 'segwit', 'regtest');
  return { address, privateKeyHex: hex.encode(priv), type: 'segwit' as const };
}

const CHANNEL_SATS = 1_000_000n; // 0.01 tBTC de capacité
const BOLT11_MSAT = 21_000_000n; // 21 000 sats payés via facture BOLT11
const BOLT12_MSAT = 15_000_000n; // 15 000 sats payés via offer BOLT12

/* ─────────────────────────────  Le scénario e2e  ───────────────────────────── */

describe('labo Lightning e2e — deux nœuds LDK réels sur la chaîne regtest embarquée', () => {
  const seedA = crypto.getRandomValues(new Uint8Array(32));
  const seedB = crypto.getRandomValues(new Uint8Array(32));
  const now = Math.floor(Date.now() / 1000);
  const wallet = makeWallet(0x77);
  let bolt11 = '';
  let offer = '';
  let channelId = '';
  let nodeIdA = '';
  let nodeIdB = '';
  let resFundingTxid = '';

  it('boot_fresh crée deux nœuds distincts et les connecte (handshake Noise réel)', () => {
    chain.faucetSend(wallet.address, 500_000_000); // 5 tBTC, tx confirmée sous 1 bloc
    lab = LnLabClass!.boot_fresh('regtest', seedA, seedB, chain.tipHeight(), chain.tipHash(), now);

    nodeIdA = lab.node_id(0);
    nodeIdB = lab.node_id(1);
    expect(nodeIdA).toMatch(/^[0-9a-f]{66}$/);
    expect(nodeIdB).toMatch(/^[0-9a-f]{66}$/);
    expect(nodeIdA).not.toBe(nodeIdB);
    // connect_ab est appelé par boot_fresh : le lien P2P est établi.
    expect(lab.is_connected()).toBe(true);
    // Même point de départ que la chaîne embarquée.
    const best = lab.best_block();
    expect(Number(best.height)).toBe(chain.tipHeight());
    expect(String(best.hash)).toBe(chain.tipHash());
  });

  it('ouverture de canal : funding_generation_ready → tx signée par le labo → LDK accepte', () => {
    lab.create_channel(CHANNEL_SATS, 0n, 1n);
    const events = drain(lab);
    const fgr = events.find((e) => e.type === 'funding_generation_ready');
    expect(fgr, 'funding_generation_ready attendu après create_channel').toBeDefined();
    expect(fgr!.valueSats).toBe('1000000');
    expect(fgr!.userChannelId).toBe('1');
    expect(fgr!.counterparty).toBe(nodeIdB);
    expect(fgr!.outputScript).toMatch(/^[0-9a-f]{68}$/); // P2WSH 2-de-2 (34 octets = 68 hex)

    // La transaction de financement est construite et signée par le VRAI
    // constructeur de transactions du labo (comme la FundingBridge de l'UI).
    const script = hex.decode(fgr!.outputScript!);
    const address = scriptToAddressOn(script, 'regtest');
    expect(address).toMatch(/^bcrt1q/);
    const res = buildSignedTx({
      utxos: chain.addressUtxos(wallet.address),
      outputs: [{ address: address!, amountSats: Number(CHANNEL_SATS) }],
      feeRateSatVb: 1,
      changeAddress: wallet.address,
      privateKeyHex: wallet.privateKeyHex,
      inputAddress: wallet.address,
      inputType: wallet.type,
    });
    const accepted = chain.acceptTx(res.hex);
    expect(accepted.txid).toBe(res.txid);
    resFundingTxid = res.txid;

    // LDK prend la transaction en charge (l'UI l'envoie via worker fundingTx).
    expect(() => lab.funding_transaction_generated(1n, res.hex)).not.toThrow();
    drain(lab);
  });

  it('confirmation : 8 blocs minés → channel_ready à 6 confirmations', () => {
    const events = mineAndFeed(lab, 8);
    expect(events.some((e) => e.type === 'channel_ready')).toBe(true);

    const channels = Array.from(lab.list_channels(0));
    expect(channels).toHaveLength(1);
    const ch = channels[0];
    expect(asBool(ch.isReady)).toBe(true);
    expect(asBool(ch.isUsable)).toBe(true);
    expect(asBool(ch.isOutbound)).toBe(true);
    expect(String(ch.counterparty)).toBe(nodeIdB);
    expect(String(ch.valueSats)).toBe('1000000');
    channelId = String(ch.channelId);
    expect(channelId).toMatch(/^[0-9a-f]{64}$/);
    // La sortie de financement suivie par LDK est bien notre transaction
    // (vout 0 = sortie du canal, avant le change).
    expect(String(ch.fundingTxo)).toBe(`${resFundingTxid}:0`);
    expect(Number(ch.confirmations)).toBeGreaterThanOrEqual(6);
    expect(Number(ch.confirmationsRequired)).toBe(6);
    // A a toute la capacité moins la réserve LDK du receveur (1 % = 10 000 sats).
    expect(String(ch.outboundMsat)).toBe('990000000');
    expect(String(ch.inboundMsat)).toBe('0');
    expect(flushKv(lab)).toBeGreaterThan(0);
  });

  it('BOLT11 : facture lnbcrt signée par B, décodée par le WASM, payée par A (HTLC réel)', () => {
    bolt11 = lab.create_invoice(1, BOLT11_MSAT, 'facture e2e', 3600, Math.floor(Date.now() / 1000));
    expect(bolt11.startsWith('lnbcrt')).toBe(true); // hrp regtest (Currency::Regtest → lnbcrt…)

    // Le décodeur statique du WASM (exposé au worker) retrouve les champs.
    const decoded = LnLabClass!.decode_invoice(bolt11);
    expect(String(decoded.currency)).toBe('Regtest');
    expect(String(decoded.payee)).toBe(nodeIdB);
    expect(String(decoded.amountMsat)).toBe('21000000');
    expect(String(decoded.description)).toBe('facture e2e');

    const before = Array.from(lab.list_channels(0))[0];
    lab.pay_invoice(0, bolt11, null);
    const events = drain(lab, 16);
    const sent = events.find((e) => e.type === 'payment_sent' && e.node === 'A');
    const claimed = events.find((e) => e.type === 'payment_claimed' && e.node === 'B');
    expect(sent, 'payment_sent attendu côté A').toBeDefined();
    expect(String(sent!.amountMsat)).toBe('21000000');
    expect(claimed, 'payment_claimed attendu côté B').toBeDefined();
    expect(String(claimed!.amountMsat)).toBe('21000000');
    expect(events.some((e) => e.type === 'payment_path_failed' || e.type === 'htlc_handling_failed')).toBe(false);

    // Les capacités du canal reflètent le paiement (moins les frais de base).
    const after = Array.from(lab.list_channels(0))[0];
    expect(BigInt(String(after.outboundMsat))).toBeLessThan(BigInt(String(before.outboundMsat)));
    expect(BigInt(String(after.inboundMsat))).toBeGreaterThan(BigInt(String(before.inboundMsat)));
    expect(flushKv(lab)).toBeGreaterThan(0);
  });

  it('BOLT12 : offer lno1 de B, décodée, payée par A via onion messages', () => {
    offer = lab.create_offer(1, BOLT12_MSAT, 'offer e2e');
    expect(offer.startsWith('lno1')).toBe(true);
    const info = LnLabClass!.decode_offer(offer);
    expect(String(info.description)).toBe('offer e2e');
    expect(String(info.amountMsat)).toBe('15000000');
    expect(String(info.signingPubkey)).toMatch(/^[0-9a-f]{66}$/); // clé de signature LDK (interne au nœud)

    const before = Array.from(lab.list_channels(0))[0];
    lab.pay_offer(0, offer, null, 'note e2e');
    // La demande de facture, la réponse signée et le HTLC final occupent
    // plusieurs ticks (onion messages + random forward delay de LDK).
    const events = drain(lab, 40);
    // Le paiement BOLT12 : demande de facture par onion messages, facture
    // signée par B, HTLC payé par A — exactement le chemin réel d'une offer.
    const bolt12Sent = events.find(
      (e) => e.type === 'payment_sent' && e.node === 'A' && e.amountMsat === '15000000',
    );
    expect(bolt12Sent, 'payment BOLT12 de 15000000 msat attendu').toBeDefined();
    // Route 1 hop à travers un path aveugle : aucun fee intermédiaire ajouté
    // (le régression du HTLC doublé — 15 000 msat payés 30 000 — est ici).
    expect(String(bolt12Sent!.feeMsat ?? '0')).toBe('0');
    expect(bolt12Sent!.preimage).toMatch(/^[0-9a-f]{64}$/);
    const claimed = events.filter((e) => e.type === 'payment_claimed' && e.node === 'B');
    expect(claimed.some((e) => e.amountMsat === '15000000')).toBe(true);
    expect(events.some((e) => e.type === 'payment_path_failed' || e.type === 'htlc_handling_failed')).toBe(false);
    const after = Array.from(lab.list_channels(0))[0];
    expect(BigInt(String(after.outboundMsat))).toBeLessThan(BigInt(String(before.outboundMsat)));
    expect(flushKv(lab)).toBeGreaterThan(0);
  });

  it('fermeture coopérative : tx de fermeture broadcastée à la chaîne → channel_closed', () => {
    expect(() => lab.close_channel(0, channelId)).not.toThrow();
    const events = drain(lab, 12);
    expect(events.some((e) => e.type === 'channel_closed')).toBe(true);
    // La transaction de fermeture a été remise à l'hôte et acceptée par la
    // chaîne (broadcast réel via hostBroadcast → acceptTx).
    expect(broadcasts.length).toBeGreaterThan(0);
    expect(broadcasts.every((b) => b.ok)).toBe(true);
    // Le canal quitte la liste des canaux ouverts (éventuellement au tick
    // suivant).
    const remaining = Array.from(lab.list_channels(0)).length;
    expect(remaining).toBe(0);
    flushKv(lab);
  });

  it('persistance : boot_restore restaure les deux nœuds avec leurs identités', () => {
    const idA = lab.node_id(0);
    const idB = lab.node_id(1);
    const kvA = kvOf('A');
    const kvB = kvOf('B');
    expect(kvA.length).toBeGreaterThan(0);
    expect(kvB.length).toBeGreaterThan(0);
    lab.free();

    const restored = LnLabClass!.boot_restore('regtest', seedA, seedB, now + 120, kvA, kvB);
    expect(restored.node_id(0)).toBe(idA);
    expect(restored.node_id(1)).toBe(idB);
    expect(restored.is_connected()).toBe(true);
    // Le canal fermé ne réapparaît pas comme canal ouvert.
    expect(Array.from(restored.list_channels(0))).toHaveLength(0);
    restored.free();
  });
});
