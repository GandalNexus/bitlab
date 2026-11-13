/**
 * BitLab regtest chain worker.
 *
 * Runs the full RegtestChain engine inside a browser Web Worker so the
 * embedded regtest chain works on serverless platforms (Vercel, Netlify, …)
 * where there is no persistent Node.js process.
 *
 * Persistence: chain state is serialized to JSON and sent to the main thread
 * via postMessage type='persist' so the main thread can store it in IndexedDB
 * (IndexedDB is not accessible from Workers).
 *
 * Message protocol (main → worker):
 *   { type:'load',   kv: SerializedChain | null }
 *   { type:'query',  id, path }          Esplora-style GET path
 *   { type:'tx',     id, hex }           broadcast raw transaction
 *   { type:'faucet', id, address, sats }
 *   { type:'mine',   id, blocks, address? }
 *   { type:'submit', id, blockHex }      PoW block from browser miner
 *   { type:'info',   id }
 *   { type:'reset',  id }
 *
 * Message protocol (worker → main):
 *   { type:'ready' }
 *   { type:'reply',   id, ok, body }
 *   { type:'error',   id, message }
 *   { type:'persist', data }             main thread must save this to IndexedDB
 */

import { RegtestChain, addressToScriptBcrt, handleEsploraPath } from '/regtest/engine.js?v=7dc83d46d655';

let chain = null;

function post(msg) {
  self.postMessage(msg);
}

function reply(id, ok, body) {
  post({ type: 'reply', id, ok, body });
}

function fail(id, e) {
  post({ type: 'error', id, message: String(e?.message ?? e) });
}

function dirty() {
  post({ type: 'persist', data: chain.serialize() });
}

const handlers = {
  load(msg) {
    try {
      chain = msg.kv ? new RegtestChain(msg.kv) : new RegtestChain();
    } catch {
      chain = new RegtestChain();
    }
    post({ type: 'ready' });
  },

  query(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      const result = handleEsploraPath(chain, msg.path);
      reply(msg.id, result.status < 400, result.body);
    } catch (e) {
      fail(msg.id, e);
    }
  },

  tx(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      const result = chain.acceptTx(msg.hex);
      dirty();
      reply(msg.id, true, result);
    } catch (e) {
      fail(msg.id, e);
    }
  },

  faucet(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      const result = chain.faucetSend(msg.address, msg.sats);
      dirty();
      reply(msg.id, true, result);
    } catch (e) {
      fail(msg.id, e);
    }
  },

  mine(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      const payScript = msg.address ? addressToScriptBcrt(msg.address) : null;
      const mined = chain.mineTo(payScript, msg.blocks ?? 1);
      dirty();
      reply(msg.id, true, {
        mined: mined.map((m) => ({ hash: m.hash, height: m.height, txCount: m.txCount })),
        tip: { height: chain.tipHeight(), hash: chain.tipHash() },
        poolSats: chain.faucetBalance().matureSats,
      });
    } catch (e) {
      fail(msg.id, e);
    }
  },

  submit(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      const mined = chain.connectRawBlock(msg.blockHex);
      dirty();
      reply(msg.id, true, { height: mined.height, hash: mined.hash });
    } catch (e) {
      fail(msg.id, e);
    }
  },

  info(msg) {
    if (!chain) return fail(msg.id, 'chain not loaded');
    try {
      reply(msg.id, true, { engine: 'browser', ...chain.info() });
    } catch (e) {
      fail(msg.id, e);
    }
  },

  reset(msg) {
    try {
      chain = new RegtestChain();
      dirty();
      reply(msg.id, true, { engine: 'browser', ...chain.info() });
    } catch (e) {
      fail(msg.id, e);
    }
  },
};

self.onmessage = (event) => {
  const msg = event.data;
  const handler = handlers[msg?.type];
  if (handler) handler(msg);
};
