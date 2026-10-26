/**
 * BitLab — Lightning lab worker (plain JS, intentionally outside the bundler).
 *
 * Hosts one LnLab WASM instance (two real LDK nodes A and B connected through
 * an in-memory socket pair). Responsibilities:
 *   - drive the LDK event loop and the chain feed (Esplora via /api/bitcoin);
 *   - broadcast LDK transactions through the same-origin proxy;
 *   - hand pending KV writes to the main thread (IndexedDB lives there);
 *   - surface events/logs/status to the UI.
 *
 * Message protocol (main -> worker): boot, connect, openChannel, fundingTx,
 * createInvoice, payInvoice, createOffer, payOffer, decodeOffer, closeChannel,
 * status, stop.
 * (worker -> main): ready, status, events, log, kv, broadcast, error, stopped.
 */

import initWasm, { LnLab } from './lnlab.js';

const PROXY = '/api/bitcoin';
const TICK_MS = 1000;
const CHAIN_POLL_MS = 10000;
const FEES_POLL_MS = 300000;
const MAX_CATCHUP_BLOCKS = 50;

let net = null;
let lab = null;
let best = null; // { height: number, hash: string }
let timers = [];
let stopping = false;
let regtestHeader = '';

function extraHeaders() {
  return regtestHeader ? { 'x-regtest-cfg': regtestHeader } : {};
}

function post(msg) {
  self.postMessage(msg);
}

function log(node, line) {
  post({ type: 'log', node, line });
}

/* ────────────────────────── Proxy helpers ────────────────────────── */

async function proxyJson(path) {
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}&network=${net}`, { headers: extraHeaders() });
  if (!res.ok) throw new Error(`proxy ${path} -> ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.trim();
  }
}

async function proxyBlockHex(hash) {
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(`block/${hash}/raw`)}&network=${net}`, { headers: extraHeaders() });
  if (!res.ok) throw new Error(`bloc ${hash.slice(0, 12)} indisponible (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

async function broadcastTx(network, txHex) {
  try {
    const res = await fetch(`${PROXY}?path=tx&network=${network}`, {
      method: 'POST',
      headers: extraHeaders(),
      body: txHex,
    });
    const body = await res.text();
    post({ type: 'broadcast', ok: res.ok, detail: body.slice(0, 120) });
  } catch (err) {
    post({ type: 'broadcast', ok: false, detail: String(err) });
  }
}

/* Host functions imported by the WASM module (see rust/lnlab/src/chainio.rs). */
self.lnlabHost = {
  hostLog(level, message) {
    log('sys', message);
  },
  hostBroadcast(network, txHex) {
    broadcastTx(network, txHex);
  },
};

/* ────────────────────────── Status / events ────────────────────────── */

function emitStatus() {
  if (!lab) return;
  try {
    post({
      type: 'status',
      connected: lab.is_connected(),
      best,
      channelsA: lab.list_channels(0),
      channelsB: lab.list_channels(1),
    });
  } catch (err) {
    log('sys', `status error: ${err}`);
  }
}

function emitEvents(events) {
  const list = Array.from(events || []);
  if (list.length > 0) post({ type: 'events', events: list });
}

function drainKv() {
  if (!lab) return;
  try {
    const entries = Array.from(lab.kv_dirty());
    if (entries.length > 0) post({ type: 'kv', entries });
  } catch (err) {
    log('sys', `kv drain error: ${err}`);
  }
}

function runTick() {
  if (!lab || stopping) return;
  try {
    emitEvents(lab.tick());
    emitStatus();
    drainKv();
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
}

/* ────────────────────────── Chain feed ────────────────────────── */

async function pollChain() {
  if (!lab || stopping || !best) return;
  try {
    const tip = Number(await proxyJson('blocks/tip/height'));
    if (tip <= best.height) return;
    const missing = Math.min(tip - best.height, MAX_CATCHUP_BLOCKS);
    for (let h = best.height + 1; h <= best.height + missing; h += 1) {
      const hash = await proxyJson(`block-height/${h}`);
      const hex = await proxyBlockHex(hash);
      emitEvents(lab.chain_block(h, hex));
      best = { height: h, hash };
      drainKv();
    }
    if (tip - best.height > 0) {
      log('sys', `${tip - best.height} bloc(s) restants à synchroniser`);
    }
  } catch (err) {
    log('sys', `chaîne: ${err.message || err}`);
  }
}

async function pollFees() {
  if (!lab || stopping) return;
  try {
    const fees = await proxyJson('v1/fees/recommended');
    // sat/vB -> sat/kwu (1 vB = 4 weight units, 1 sat/vB = 250 sat/kwu).
    const fast = Math.max(253, Math.round(Number(fees.fastestFee) * 250));
    const normal = Math.max(253, Math.round(Number(fees.hourFee) * 250));
    const slow = Math.max(253, Math.round(Number(fees.economyFee) * 250));
    lab.set_fees(fast, normal, slow);
  } catch (err) {
    log('sys', `frais: ${err.message || err}`);
  }
}

function startTimers() {
  timers.push(setInterval(runTick, TICK_MS));
  timers.push(setInterval(pollChain, CHAIN_POLL_MS));
  timers.push(setInterval(pollFees, FEES_POLL_MS));
  // Prime fees immediately, then poll the chain shortly after boot.
  pollFees();
  setTimeout(pollChain, 1500);
}

function stopTimers() {
  timers.forEach((id) => clearInterval(id));
  timers = [];
}

/* ────────────────────────── Boot ────────────────────────── */

async function boot(msg) {
  net = msg.network;
  regtestHeader = typeof msg.regtestHeader === 'string' ? msg.regtestHeader : '';
  stopping = false;
  log('sys', `chargement du module WASM (${net})…`);
  await initWasm({ module_or_path: new URL('lnlab_bg.wasm', import.meta.url) });
  const now = Math.floor(Date.now() / 1000);
  if (msg.mode === 'restore') {
    lab = LnLab.boot_restore(net, msg.seeds.a, msg.seeds.b, now, msg.kv.a, msg.kv.b);
    log('sys', 'nœuds restaurés depuis le stockage local');
  } else {
    const tip = Number(await proxyJson('blocks/tip/height'));
    const hash = await proxyJson(`block-height/${tip}`);
    lab = LnLab.boot_fresh(net, msg.seeds.a, msg.seeds.b, tip, hash, now);
    log('sys', `nouveaux nœuds créés au bloc ${tip}`);
  }
  best = lab.best_block();
  best = { height: Number(best.height), hash: best.hash };
  startTimers();
  post({
    type: 'ready',
    nodeA: lab.node_id(0),
    nodeB: lab.node_id(1),
    best,
  });
  emitStatus();
  runTick();
}

/* ────────────────────────── Message handlers ────────────────────────── */

const handlers = {
  async boot(msg) {
    try {
      await boot(msg);
    } catch (err) {
      post({ type: 'error', message: `démarrage: ${err.message || err}` });
    }
  },

  connect() {
    try {
      lab.connect_ab();
      runTick();
    } catch (err) {
      post({ type: 'error', message: `liaison A-B: ${err.message || err}` });
    }
  },

  openChannel(msg) {
    try {
      lab.create_channel(BigInt(msg.valueSats), BigInt(msg.pushMsat), BigInt(msg.userChannelId));
      runTick();
      // Explicit ack so the main thread can resolve its request — LDK errors
      // below surface as a rejected promise instead of a silent no-op.
      post({ type: 'channelRequested', userChannelId: msg.userChannelId });
    } catch (err) {
      post({ type: 'error', message: `canal: ${err.message || err}` });
    }
  },

  fundingTx(msg) {
    try {
      lab.funding_transaction_generated(BigInt(msg.userChannelId), msg.hex);
      runTick();
    } catch (err) {
      post({ type: 'error', message: `financement: ${err.message || err}` });
    }
  },

  createInvoice(msg) {
    try {
      const bolt11 = lab.create_invoice(
        msg.node, msg.amountMsat == null ? null : BigInt(msg.amountMsat),
        msg.description || 'BitLab', msg.expirySecs || 3600,
        Math.floor(Date.now() / 1000),
      );
      post({ type: 'invoice', id: msg.id, bolt11 });
    } catch (err) {
      post({ type: 'error', message: `facture: ${err.message || err}` });
    }
  },

  payInvoice(msg) {
    try {
      lab.pay_invoice(msg.node, msg.invoice, msg.amountMsat == null ? null : BigInt(msg.amountMsat));
      runTick();
    } catch (err) {
      post({ type: 'error', message: `paiement: ${err.message || err}` });
    }
  },

  createOffer(msg) {
    try {
      const offer = lab.create_offer(
        msg.node, msg.amountMsat == null ? null : BigInt(msg.amountMsat),
        msg.description || 'BitLab',
      );
      post({ type: 'offer', id: msg.id, offer });
    } catch (err) {
      post({ type: 'error', message: `offer: ${err.message || err}` });
    }
  },

  payOffer(msg) {
    try {
      lab.pay_offer(
        msg.node, msg.offer, msg.amountMsat == null ? null : BigInt(msg.amountMsat),
        msg.payerNote == null ? null : msg.payerNote,
      );
      runTick();
    } catch (err) {
      post({ type: 'error', message: `paiement offer: ${err.message || err}` });
    }
  },

  decodeOffer(msg) {
    try {
      // decode_offer is a static wasm-bindgen method — call it on the class.
      post({ type: 'offerInfo', id: msg.id, info: LnLab.decode_offer(msg.offer) });
    } catch (err) {
      post({ type: 'error', message: `offer: ${err.message || err}` });
    }
  },

  closeChannel(msg) {
    try {
      lab.close_channel(msg.node, msg.channelId);
      runTick();
    } catch (err) {
      post({ type: 'error', message: `fermeture: ${err.message || err}` });
    }
  },

  logs() {
    if (!lab) return;
    try {
      post({ type: 'logs', a: Array.from(lab.logs(0)), b: Array.from(lab.logs(1)) });
    } catch (err) {
      log('sys', `logs: ${err.message || err}`);
    }
  },

  stop() {
    stopping = true;
    try {
      if (lab) {
        drainKv();
        lab.free();
      }
    } catch (err) {
      /* best effort */
    }
    lab = null;
    stopTimers();
    post({ type: 'stopped' });
    self.close();
  },
};

self.onmessage = (event) => {
  const msg = event.data;
  const handler = handlers[msg.type];
  if (handler) handler(msg);
};
