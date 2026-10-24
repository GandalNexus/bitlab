/* tslint:disable */
/* eslint-disable */
/**
 * Self-test run once at worker startup:
 *   - FIPS 180-4 SHA-256 vectors (empty string, "abc");
 *   - real Testnet4 genesis header → double-SHA256 = official block-0 hash
 *     (network data, not an invented vector);
 *   - mine_batch must recover the genesis nonce (393743547) in 1 iteration.
 */
export function self_test(): void;
/**
 * Sweeps `iters` consecutive nonces (from `start_nonce`, with modulo 2^32
 * wrap) against a `header76_hex` header (76 bytes) and a `target_hex`
 * target (32 bytes big-endian). Returns the winning nonce, or -1 when no
 * candidate lands in the batch.
 */
export function mine_batch(header76_hex: string, target_hex: string, start_nonce: number, iters: number): bigint;
/**
 * Double-SHA256 of a hex message (diagnostics and cross-checks against
 * node:crypto). Returns the final digest as hex.
 */
export function sha256d_hex(msg_hex: string): string;
/**
 * Decodes a compact nBits (Bitcoin format, e.g. 0x1d00ffff) and returns
 * the 32-byte big-endian target as hex — computed host-side once per
 * window, not per nonce.
 */
export function target_from_bits_hex(bits_hex: string): string;
