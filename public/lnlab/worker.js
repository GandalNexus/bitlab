import initWasm, { LnLab } from './lnlab.js';

const PROXY = '/api/bitcoin';
const TICK_MS = 1000;
const CHAIN_POLL_MS = 10000;
const FEES_POLL_MS = 300000;
const MAX_CATCHUP_BLOCKS = 50;
const HEX_CHUNK = 2;
const HEX_BYTE_BASE = 16;
const HEX_PAD = 2;
const BROADCAST_DETAIL_MAX = 120;
const CHAIN_BOOT_DELAY_MS = 1500;

let net = null;
let lab = null;
let best = null;
let timers = [];
let stopping = false;
let booting = false;
let regtestHeader = '';
let bridge = false;
let bridgeSeq = 0;
const bridgePending = new Map();

function extraHeaders() {
  return regtestHeader ? { 'x-regtest-cfg': regtestHeader } : {};
}

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

function log(node, line) {
  post({ type: 'log', node, line });
}

function askBridge(payload) {
  return new Promise((resolve, reject) => {
    const id = `lnb-${++bridgeSeq}`;
    bridgePending.set(id, { resolve, reject });
    post({ type: 'chainBridgeRequest', id, ...payload });
  });
}

async function bridgeJson(path) {
  const res = await askBridge({ path });
  if (!res.ok) throw new Error(`chaîne ${path} -> ${res.status}`);
  return res.body;
}

async function bridgeBlockHex(hash) {
  const res = await askBridge({ path: `block/${hash}/raw`, binary: true });
  if (!res.ok) throw new Error(`bloc ${hash.slice(0, 12)} indisponible (${res.status})`);
  const bytes = res.body instanceof Uint8Array ? res.body : new Uint8Array(res.body ?? []);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(HEX_BYTE_BASE).padStart(HEX_PAD, '0');
  return hex;
}

async function bridgeBroadcast(txHex) {
  const res = await askBridge({ path: 'tx', tx: txHex });
  return { ok: Boolean(res.ok), detail: res.ok ? '' : String(res.detail ?? '').slice(0, BROADCAST_DETAIL_MAX) };
}

async function proxyJson(path) {
  if (bridge) return bridgeJson(path);
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
  if (bridge) return bridgeBlockHex(hash);
  const res = await fetch(`${PROXY}?path=${encodeURIComponent(`block/${hash}/raw`)}&network=${net}`, { headers: extraHeaders() });
  if (!res.ok) throw new Error(`bloc ${hash.slice(0, 12)} indisponible (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(HEX_BYTE_BASE).padStart(HEX_PAD, '0');
  return hex;
}

async function broadcastTx(network, txHex) {
  if (bridge) {
    try {
      const res = await bridgeBroadcast(txHex);
      post({ type: 'broadcast', ok: res.ok, detail: res.detail });
    } catch (err) {
      post({ type: 'broadcast', ok: false, detail: String(err) });
    }
    return;
  }
  try {
    const res = await fetch(`${PROXY}?path=tx&network=${network}`, {
      method: 'POST',
      headers: extraHeaders(),
      body: txHex,
    });
    const body = await res.text();
    post({ type: 'broadcast', ok: res.ok, detail: body.slice(0, BROADCAST_DETAIL_MAX) });
  } catch (err) {
    post({ type: 'broadcast', ok: false, detail: String(err) });
  }
}

self.lnlabHost = {
  hostLog(level, message) {
    log('sys', message);
  },
  hostBroadcast(network, txHex) {
    broadcastTx(network, txHex);
  },
};

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
  pollFees();
  setTimeout(pollChain, CHAIN_BOOT_DELAY_MS);
}

function stopTimers() {
  timers.forEach((id) => clearInterval(id));
  timers = [];
}

async function loadWasmResponse() {
  const url = new URL('lnlab_bg.wasm', import.meta.url);
  if (typeof caches === 'undefined') return { res: await fetch(url), cached: false };
  try {
    const cache = await caches.open('lnlab-wasm-v1');
    const hit = await cache.match(url);
    const meta = await cache.match(`${url.href}#meta`);
    if (hit && meta) {
      const { etag } = await meta.json();
      const head = await fetch(url, { method: 'HEAD' });
      if (head.ok && (head.headers.get('etag') ?? '') === etag) {
        return { res: hit, cached: true };
      }
    }
    const res = await fetch(url);
    if (!res.ok) return { res, cached: false };
    await cache.put(url, res.clone());
    await cache.put(
      `${url.href}#meta`,
      new Response(JSON.stringify({ etag: res.headers.get('etag') ?? '' }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    return { res, cached: false };
  } catch {
    return { res: await fetch(url), cached: false };
  }
}

async function boot(msg) {
  if (lab || booting) return;
  booting = true;
  net = msg.network;
  bridge = msg.chainBridge === true;
  regtestHeader = typeof msg.regtestHeader === 'string' ? msg.regtestHeader : '';
  stopping = false;
  log('sys', `chargement du module WASM (${net})…`);
  try {
    const { res, cached } = await loadWasmResponse();
    await initWasm({ module_or_path: res });
    log('sys', cached ? 'module WASM chargé depuis le cache local' : 'module WASM chargé');
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
  } finally {
    booting = false;
  }
}

function fail(requestId, message) {
  post({ type: 'error', message, ...(requestId !== undefined ? { requestId } : {}) });
}

const handlers = {
  async boot(msg) {
    try {
      await boot(msg);
    } catch (err) {
      fail(undefined, `démarrage: ${err.message || err}`);
    }
  },

  connect() {
    try {
      lab.connect_ab();
      runTick();
    } catch (err) {
      fail(undefined, `liaison A-B: ${err.message || err}`);
    }
  },

  openChannel(msg) {
    try {
      lab.create_channel(BigInt(msg.valueSats), BigInt(msg.pushMsat), BigInt(msg.userChannelId));
      runTick();
      post({ type: 'channelRequested', userChannelId: msg.userChannelId });
    } catch (err) {
      fail(msg.userChannelId, `canal: ${err.message || err}`);
    }
  },

  fundingTx(msg) {
    try {
      lab.funding_transaction_generated(BigInt(msg.userChannelId), msg.hex);
      runTick();
      post({ type: 'fundingSubmitted', userChannelId: msg.userChannelId });
    } catch (err) {
      fail(msg.userChannelId, `financement: ${err.message || err}`);
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
      fail(msg.id, `facture: ${err.message || err}`);
    }
  },

  payInvoice(msg) {
    try {
      lab.pay_invoice(msg.node, msg.invoice, msg.amountMsat == null ? null : BigInt(msg.amountMsat));
      runTick();
      post({ type: 'paymentInitiated', requestId: msg.requestId });
    } catch (err) {
      fail(msg.requestId, `paiement: ${err.message || err}`);
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
      fail(msg.id, `offer: ${err.message || err}`);
    }
  },

  payOffer(msg) {
    try {
      lab.pay_offer(
        msg.node, msg.offer, msg.amountMsat == null ? null : BigInt(msg.amountMsat),
        msg.payerNote == null ? null : msg.payerNote,
      );
      runTick();
      post({ type: 'offerPaymentInitiated', requestId: msg.requestId });
    } catch (err) {
      fail(msg.requestId, `paiement offer: ${err.message || err}`);
    }
  },

  decodeOffer(msg) {
    try {
      post({ type: 'offerInfo', id: msg.id, info: LnLab.decode_offer(msg.offer) });
    } catch (err) {
      fail(msg.id, `offer: ${err.message || err}`);
    }
  },

  closeChannel(msg) {
    try {
      lab.close_channel(msg.node, msg.channelId);
      runTick();
    } catch (err) {
      fail(undefined, `fermeture: ${err.message || err}`);
    }
  },

  stop() {
    stopping = true;
    try {
      if (lab) {
        drainKv();
        lab.free();
      }
    } catch {
      lab = null;
    }
    lab = null;
    stopTimers();
    post({ type: 'stopped' });
    self.close();
  },
};

self.onmessage = (event) => {
  const msg = event.data;
  if (msg?.type === 'chainBridgeReply') {
    const pending = bridgePending.get(String(msg.id));
    if (!pending) return;
    bridgePending.delete(String(msg.id));
    if (msg.ok) pending.resolve({ ok: true, body: msg.body, detail: msg.detail });
    else pending.reject(new Error(`pont chaîne: ${msg.detail ?? 'requête refusée'}`));
    return;
  }
  const handler = handlers[msg.type];
  if (handler) handler(msg);
};
