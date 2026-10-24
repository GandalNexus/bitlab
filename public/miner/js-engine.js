/* ───────────────────────── SHA-256 (local) ───────────────────────── */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const W = new Uint32Array(64);

export function compress(state, block, offset = 0) {
  for (let i = 0; i < 16; i++) {
    const j = offset + 4 * i;
    W[i] = ((block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]) >>> 0;
  }
  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15];
    const w2 = W[i - 2];
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g; g = f; f = e;
    e = (d + t1) | 0;
    d = c; c = b; b = a;
    a = (t1 + t2) | 0;
  }
  state[0] = (state[0] + a) | 0;
  state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0;
  state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0;
  state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0;
  state[7] = (state[7] + h) | 0;
}

export function digestMeetsTarget(digest, targetBE) {
  for (let i = 0; i < 32; i++) {
    const hb = digest[31 - i];
    const tb = targetBE[i];
    if (hb < tb) return true;
    if (hb > tb) return false;
  }
  return true;
}

/* ───────────────────────── API engine JS ───────────────────────── */

export function mineBatchJS(header76, targetBE, startNonce, iters) {
  const midstate = Uint32Array.from(IV);
  compress(midstate, header76, 0);

  const block2 = new Uint8Array(64);
  block2.set(header76.subarray(64, 76), 0);
  block2[16] = 0x80;
  new DataView(block2.buffer).setBigUint64(56, 640n, false);

  const outer = new Uint8Array(64);
  outer[32] = 0x80;
  new DataView(outer.buffer).setBigUint64(56, 256n, false);

  let nonce = startNonce >>> 0;
  const inner = new Uint32Array(8);
  const outerState = new Uint32Array(8);
  const digest = new Uint8Array(32);

  for (let i = 0; i < iters; i++) {
    block2[12] = nonce & 0xff;
    block2[13] = (nonce >>> 8) & 0xff;
    block2[14] = (nonce >>> 16) & 0xff;
    block2[15] = (nonce >>> 24) & 0xff;

    inner.set(midstate);
    compress(inner, block2, 0);

    for (let k = 0; k < 8; k++) {
      const v = inner[k];
      outer[4 * k] = (v >>> 24) & 0xff;
      outer[4 * k + 1] = (v >>> 16) & 0xff;
      outer[4 * k + 2] = (v >>> 8) & 0xff;
      outer[4 * k + 3] = v & 0xff;
    }
    outerState.set(IV);
    compress(outerState, outer, 0);
    for (let k = 0; k < 8; k++) {
      const v = outerState[k];
      digest[4 * k] = (v >>> 24) & 0xff;
      digest[4 * k + 1] = (v >>> 16) & 0xff;
      digest[4 * k + 2] = (v >>> 8) & 0xff;
      digest[4 * k + 3] = v & 0xff;
    }

    if (digestMeetsTarget(digest, targetBE)) return nonce;
    nonce = (nonce + 1) >>> 0;
  }
  return -1;
}


export function sha256dJS(msg) {
  const state = Uint32Array.from(IV);
  const full = Math.ceil((msg.length + 9) / 64) * 64;
  const padded = new Uint8Array(full);
  padded.set(msg);
  padded[msg.length] = 0x80;
  new DataView(padded.buffer).setBigUint64(full - 8, BigInt(msg.length) * 8n, false);
  for (let off = 0; off < full; off += 64) compress(state, padded, off);
  const out = new Uint8Array(32);
  for (let k = 0; k < 8; k++) {
    const v = state[k];
    out[4 * k] = (v >>> 24) & 0xff;
    out[4 * k + 1] = (v >>> 16) & 0xff;
    out[4 * k + 2] = (v >>> 8) & 0xff;
    out[4 * k + 3] = v & 0xff;
  }
  const once = out;
  const s2 = Uint32Array.from(IV);
  const b2 = new Uint8Array(64);
  b2.set(once);
  b2[32] = 0x80;
  new DataView(b2.buffer).setBigUint64(56, 256n, false);
  compress(s2, b2, 0);
  const out2 = new Uint8Array(32);
  for (let k = 0; k < 8; k++) {
    const v = s2[k];
    out2[4 * k] = (v >>> 24) & 0xff;
    out2[4 * k + 1] = (v >>> 16) & 0xff;
    out2[4 * k + 2] = (v >>> 8) & 0xff;
    out2[4 * k + 3] = v & 0xff;
  }
  return out2;
}
