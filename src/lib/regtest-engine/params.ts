import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';

export const REGTEST_BITS = 0x207fffff;

export const REGTEST_GENESIS_HEADER_HEX =
  '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4adae5494dffff7f2002000000';

<<<<<<< HEAD
export const REGTEST_GENESIS_HASH = '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206';
=======
/** Hash du bloc de genèse regtest (affichage big-endian). */
export const REGTEST_GENESIS_HASH =
  '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206';
>>>>>>> 92c54ba (style: prettier-format repo)

export const REGTEST_GENESIS_TX_HEX =
  '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';

export const BASE_SUBSIDY_SATS = 5_000_000_000;
export const HALVING_INTERVAL = 150;
export const COINBASE_MATURITY = 100;
export const MAX_BLOCK_WEIGHT = 4_000_000;
export const MAX_STD_TX_WEIGHT = 400_000;
export const MIN_RELAY_FEE_PER_WEIGHT_NUM = 1;
export const MIN_RELAY_FEE_PER_WEIGHT_DEN = 4;
export const MAX_FUTURE_TIME_SEC = 7_200;

export const MAX_RETAINED_BLOCKS = 2048;
export const MAX_MEMPOOL_TXS = 1_000;
export const MAX_INDEXED_ADDRESSES = 2_000;
export const FAUCET_PREMINE_BLOCKS = 101;
export const FAUCET_MAX_SATS = 5_000_000_000;
export const FAUCET_DEFAULT_SATS = 100_000_000;

export function blockSubsidy(height: number): number {
  if (height <= 0) return 0;
  const halvings = Math.floor(height / HALVING_INTERVAL);
  if (halvings >= 64) return 0;
  return Math.floor(BASE_SUBSIDY_SATS / 2 ** halvings);
}

export function minRelayFee(weight: number): number {
  return Math.ceil((weight * MIN_RELAY_FEE_PER_WEIGHT_NUM) / MIN_RELAY_FEE_PER_WEIGHT_DEN);
}

export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

export function reverseHex(h: string): string {
  const b = hex.decode(h);
  return hex.encode(b.reverse());
}
