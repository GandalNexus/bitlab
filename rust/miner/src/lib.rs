//! BitLab — SHA-256d mining engine for WebAssembly.
//!
//! A minimal solo miner for Testnet4 minimum-difficulty windows (BIP 94):
//! when a block arrives >20 minutes after the previous one, the next block
//! is valid at `nBits = 0x1d00ffff` — roughly 2^32 double-SHA256 hashes,
//! within browser reach.
//!
//! The 80-byte header is split as:
//!   - `header76` (76 bytes): version, previous hash, merkle root,
//!     timestamp, nBits — invariant during nonce scanning;
//!   - `nonce` (4 bytes): only field that changes.
//!
//! Midstate optimization: the first inner SHA-256 block (first 64 bytes
//! of header) is compressed once per batch. Each nonce then costs
//! 3 compressions instead of 6 (1 inner SHA finish + 2 outer SHA).
//! Same trick used by native miners.
//!
//! No hash dependency: SHA-256 is local, derivable block-by-block,
//! and covered by self-tests (FIPS 180-4 vectors + real Testnet4 genesis).

use wasm_bindgen::prelude::*;

/* ─────────────────────────── SHA-256 (local) ─────────────────────────── */

/// FIPS 180-4 K constants.
const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const IV: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

fn compress(state: &mut [u32; 8], block: &[u8]) {
    let mut w = [0u32; 64];
    for i in 0..16 {
        w[i] = u32::from_be_bytes([block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]]);
    }
    for i in 16..64 {
        let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
        let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16]
            .wrapping_add(s0)
            .wrapping_add(w[i - 7])
            .wrapping_add(s1);
    }
    let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = *state;
    for i in 0..64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ (!e & g);
        let t1 = h
            .wrapping_add(s1)
            .wrapping_add(ch)
            .wrapping_add(K[i])
            .wrapping_add(w[i]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = s0.wrapping_add(maj);
        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(t1);
        d = c;
        c = b;
        b = a;
        a = t1.wrapping_add(t2);
    }
    let next = [state[0].wrapping_add(a), state[1].wrapping_add(b), state[2].wrapping_add(c), state[3].wrapping_add(d), state[4].wrapping_add(e), state[5].wrapping_add(f), state[6].wrapping_add(g), state[7].wrapping_add(h)];
    *state = next;
}


fn final_blocks(len_total: usize) -> Vec<u8> {
    let mut pad = Vec::with_capacity(128);
    pad.push(0x80);
    while (len_total + pad.len()) % 64 != 56 {
        pad.push(0);
    }
    pad.extend_from_slice(&((len_total as u64) * 8).to_be_bytes());
    pad
}

fn sha256(msg: &[u8]) -> [u8; 32] {
    let mut state = IV;
    let mut chunks = msg.chunks_exact(64);
    for block in &mut chunks {
        compress(&mut state, block);
    }
    let mut tail = chunks.remainder().to_vec();
    tail.extend_from_slice(&final_blocks(msg.len()));
    for block in tail.chunks_exact(64) {
        compress(&mut state, block);
    }
    let mut out = [0u8; 32];
    for (i, word) in state.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

/* ───────────────────────────── Helpers ───────────────────────────── */

fn decode_hex(s: &str) -> Result<Vec<u8>, JsValue> {
    let s = s.trim();
    if s.len() % 2 != 0 || !s.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(JsValue::from_str("invalid hex"));
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();
    let nibble = |b: u8| -> u8 {
        match b {
            b'0'..=b'9' => b - b'0',
            _ => (b | 0x20) - b'a' + 10,
        }
    };
    for pair in bytes.chunks(2) {
        out.push((nibble(pair[0]) << 4) | nibble(pair[1]));
    }
    Ok(out)
}

fn le256(a: &[u8; 32], b: &[u8; 32]) -> bool {
    for i in 0..32 {
        match a[i].cmp(&b[i]) {
            std::cmp::Ordering::Less => return true,
            std::cmp::Ordering::Greater => return false,
            _ => {}
        }
    }
    true
}

/* ─────────────────────────── WebAssembly API ─────────────────────────── */

#[wasm_bindgen]
pub fn self_test() -> Result<(), JsValue> {
    let empty = sha256(b"");
    if hex(&empty) != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" {
        return Err(JsValue::from_str("self-test: invalid SHA-256(\"\")"));
    }
    let abc = sha256(b"abc");
    if hex(&abc) != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" {
        return Err(JsValue::from_str("self-test: invalid SHA-256(\"abc\")"));
    }

    const GENESIS: &str = "0100000000000000000000000000000000000000000000000000000000000000000000004e7b2b9128fe0291db0693af2ae418b767e657cd407e80cb1434221eaea7a07a046f3566ffff001dbb0c7817";
    let header = decode_hex(GENESIS)?;
    let expected = decode_hex("00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043")?;
    if !sha256d_meets(&header, expected.as_slice()) {
        return Err(JsValue::from_str("self-test: Testnet4 genesis mismatch"));
    }

    let target = target_from_bits_hex("ffff001d")?;
    let prefix = &header[..76];
    let prefix_hex = hex(prefix);
    let found = mine_batch(&prefix_hex, &target, 393743547, 1)?;
    if found != 393743547 {
        return Err(JsValue::from_str("self-test: genesis nonce not found"));
    }
    Ok(())
}


#[wasm_bindgen]
pub fn mine_batch(header76_hex: &str, target_hex: &str, start_nonce: u32, iters: u32) -> Result<i64, JsValue> {
    let prefix = decode_hex(header76_hex)?;
    if prefix.len() != 76 {
        return Err(JsValue::from_str("header must be 76 bytes (80 - nonce)"));
    }
    let target = decode_hex(target_hex)?;
    if target.len() != 32 {
        return Err(JsValue::from_str("target must be 32 bytes"));
    }
    let target: [u8; 32] = target.try_into().unwrap();

    let mut midstate = IV;
    compress(&mut midstate, &prefix[..64]);

    let mut block2 = [0u8; 64];
    block2[..12].copy_from_slice(&prefix[64..76]);
    block2[12] = 0x00;
    block2[12..16].copy_from_slice(&start_nonce.to_le_bytes());
    block2[16] = 0x80;
    block2[56..64].copy_from_slice(&640u64.to_be_bytes());

    let mut outer_block = [0u8; 64];
    outer_block[32] = 0x80;
    outer_block[56..64].copy_from_slice(&256u64.to_be_bytes());

    let mut nonce = start_nonce;
    for _ in 0..iters {
        block2[12..16].copy_from_slice(&nonce.to_le_bytes());

        let mut inner = midstate;
        compress(&mut inner, &block2);

        let mut outer = IV;
        let mut ob = outer_block;
        for (i, word) in inner.iter().enumerate() {
            ob[4 * i..4 * i + 4].copy_from_slice(&word.to_be_bytes());
        }
        compress(&mut outer, &ob);

        let mut candidate = [0u8; 32];
        for (i, word) in outer.iter().enumerate() {
            candidate[4 * i..4 * i + 4].copy_from_slice(&word.to_be_bytes());
        }
        candidate.reverse();
        if le256(&candidate, &target) {
            return Ok(nonce as i64);
        }

        nonce = nonce.wrapping_add(1);
    }
    Ok(-1)
}

#[wasm_bindgen]
pub fn sha256d_hex(msg_hex: &str) -> Result<String, JsValue> {
    let msg = decode_hex(msg_hex)?;
    let once = sha256(&msg);
    let twice = sha256(&once);
    Ok(hex(&twice))
}

#[wasm_bindgen]
pub fn target_from_bits_hex(bits_hex: &str) -> Result<String, JsValue> {
    let bits_le = decode_hex(bits_hex)?;
    if bits_le.len() != 4 {
        return Err(JsValue::from_str("nBits must be 4 bytes"));
    }

    let bits = u32::from_be_bytes([bits_le[3], bits_le[2], bits_le[1], bits_le[0]]);
    let exponent = (bits >> 24) as usize;
    let mantissa = (bits & 0x007f_ffff) as u64;
    if exponent < 3 || exponent > 32 + 3 {
        return Err(JsValue::from_str("nBits exponent out of range"));
    }
    let byte_pos = (exponent - 3) as i64; 
    let mut target = [0u8; 32];
   
    for k in 0..3usize {
        let byte = ((mantissa >> (8 * (2 - k))) & 0xff) as u8;
        let pos = byte_pos + k as i64;
        if pos >= 0 && pos < 32 {
            target[(31 - pos) as usize] = byte;
        }
    }
    Ok(hex(&target))
}

fn sha256d_meets(msg: &[u8], target: &[u8]) -> bool {
    if msg.len() != 80 || target.len() != 32 {
        return false;
    }
    let once = sha256(msg);
    let twice = sha256(&once);
    let mut candidate = [0u8; 32];
    candidate.copy_from_slice(&twice);
    candidate.reverse();
    let mut t = [0u8; 32];
    t.copy_from_slice(target);
    le256(&candidate, &t)
}

fn hex(bytes: &[u8]) -> String {
    const TABLE: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(TABLE[(b >> 4) as usize] as char);
        out.push(TABLE[(b & 0x0f) as usize] as char);
    }
    out
}
