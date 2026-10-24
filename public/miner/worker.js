
import initWasm, { mine_batch, self_test } from './miner.js';
import { mineBatchJS } from './js-engine.js';
import { hexToBytes } from './bytes.js';

const BATCH = 250_000;          
const PROGRESS_EVERY_MS = 2_000; 

let engine = null;              
let running = false;
let job = null;                 
let hashesTotal = 0;
let lastReport = 0;

function post(msg) {
  self.postMessage(msg);
}

async function boot() {
  if (engine) {
    post({ type: 'ready', engine });
    return;
  }
  try {
    await initWasm('./miner_bg.wasm');
    self_test(); 
    engine = 'wasm';
  } catch (err) {
    console.warn('miner: WASM indisponible, repli JavaScript', err);
    engine = 'js';
  }
  post({ type: 'ready', engine });
}

async function runJob(j) {
  const { header76Hex, targetHex, startNonce, endNonce } = j.params;
  const batch = engine === 'wasm' ? BATCH : BATCH / 2; 
  let nonce = startNonce >>> 0;

  while (running && j.id === job?.id) {
    const remaining = endNonce - nonce;
    if (remaining <= 0) {
      post({ type: 'exhausted', job: j.id, nonce }); 
      return;
    }
    const iters = Math.min(batch, remaining);
    let found = -1;
    if (engine === 'wasm') {
      found = Number(mine_batch(header76Hex, targetHex, nonce, iters)); // i64 → BigInt
    } else {
      found = mineBatchJS(hexToBytes(header76Hex), hexToBytes(targetHex), nonce, iters);
    }
    hashesTotal += iters;

    if (found >= 0) {
      post({ type: 'found', job: j.id, nonce: found >>> 0 });
      return;
    }
    nonce = (nonce + iters) >>> 0;

    const now = performance.now();
    if (now - lastReport >= PROGRESS_EVERY_MS) {
      post({ type: 'progress', job: j.id, hashes: hashesTotal, ms: Math.round(now - j.t0) });
      lastReport = now;
    } else {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

self.onmessage = (event) => {
  const msg = event.data;
  switch (msg.cmd) {
    case 'boot':
      void boot();
      break;
    case 'job':
      job = {
        id: msg.job,
        params: msg,
        t0: performance.now(),
      };
      hashesTotal = 0;
      lastReport = performance.now();
      running = true;
      void runJob(job);
      break;
    case 'stop':
      running = false;
      job = null;
      break;
    default:
      break;
  }
};
