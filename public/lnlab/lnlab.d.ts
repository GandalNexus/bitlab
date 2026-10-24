/* tslint:disable */
/* eslint-disable */
export class LnLab {
  private constructor();
  free(): void;
  /**
   * Current chain position of the lab (both nodes share the feed).
   */
  best_block(): any;
  /**
   * Boots two fresh nodes whose chain view starts at the current tip.
   */
  static boot_fresh(network: string, seed_a: Uint8Array, seed_b: Uint8Array, tip_height: number, tip_hash: string, now_secs: number): LnLab;
  /**
   * Opens the in-memory P2P link A -> B (real noise handshake).
   */
  connect_ab(): void;
  /**
   * Processes one chain block (hex) for both nodes; returns emitted events.
   */
  chain_block(height: number, block_hex: string): Array<any>;
  /**
   * Pays a BOLT11 invoice over the direct channel (real HTLC, real routing).
   */
  pay_invoice(node: number, invoice: string, amount_msat_override?: bigint | null): void;
  /**
   * Boots two nodes from IndexedDB-backed state (KV entries + manager bytes).
   */
  static boot_restore(network: string, seed_a: Uint8Array, seed_b: Uint8Array, now_secs: number, kv_a: Array<any>, kv_b: Array<any>): LnLab;
  /**
   * Creates a real BOLT12 offer (lno1…) on the selected node. The offer
   * carries a one-hop blinded message path back to the issuing node, so
   * any peer of that node can request an invoice through onion messages.
   */
  create_offer(node: number, amount_msat: bigint | null | undefined, description: string): string;
  /**
   * Decodes a BOLT12 offer without touching any node state (static).
   */
  static decode_offer(offer: string): any;
  /**
   * True while the in-memory P2P link is up.
   */
  is_connected(): boolean;
  /**
   * Closes a channel cooperatively from the selected node.
   */
  close_channel(node: number, channel_id_hex: string): void;
  /**
   * Channel summary for the selected node.
   */
  list_channels(node: number): Array<any>;
  /**
   * Opens a channel from A to B. The funding transaction is built and signed
   * by the lab wallet in the main thread when `funding_generation_ready`
   * arrives, then handed back via `funding_transaction_generated`.
   */
  create_channel(value_sats: bigint, push_msat: bigint, user_channel_id: bigint): void;
  /**
   * Creates and signs a real BOLT11 invoice on the selected node.
   */
  create_invoice(node: number, amount_msat: bigint | null | undefined, description: string, expiry_secs: number, now_secs: number): string;
  /**
   * Decodes a BOLT11 invoice without touching any node state (static).
   */
  static decode_invoice(invoice: string): any;
  /**
   * Feeds back the funding transaction built by the lab wallet.
   */
  funding_transaction_generated(user_channel_id: bigint, tx_hex: string): void;
  /**
   * Recent LDK log lines for the selected node (bounded tail).
   */
  logs(node: number): Array<any>;
  /**
   * Drives the protocol: message pump + pending events + persistence.
   * Returns the events emitted during this tick.
   */
  tick(): Array<any>;
  /**
   * Compressed public key (node id) of the selected node, hex-encoded.
   */
  node_id(node: number): string;
  /**
   * Drains pending KV writes for both nodes: entries of
   * [nodeLabel, primary, secondary, key, Uint8Array | null].
   */
  kv_dirty(): Array<any>;
  /**
   * Pushes fee rates (sat/kwu) converted from Esplora sat/vB by the worker.
   */
  set_fees(fast: number, normal: number, slow: number): void;
  /**
   * Pays a BOLT12 offer from the selected node: sends an invoice request
   * over onion messages, then pays the returned invoice over the direct
   * channel. The result surfaces later as normal payment events.
   */
  pay_offer(node: number, offer: string, amount_msat?: bigint | null, payer_note?: string | null): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_lnlab_free: (a: number, b: number) => void;
  readonly lnlab_best_block: (a: number) => any;
  readonly lnlab_boot_fresh: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
  readonly lnlab_boot_restore: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: any, i: any) => [number, number, number];
  readonly lnlab_chain_block: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly lnlab_close_channel: (a: number, b: number, c: number, d: number) => [number, number];
  readonly lnlab_connect_ab: (a: number) => [number, number];
  readonly lnlab_create_channel: (a: number, b: bigint, c: bigint, d: bigint) => [number, number];
  readonly lnlab_create_invoice: (a: number, b: number, c: number, d: bigint, e: number, f: number, g: number, h: number) => [number, number, number, number];
  readonly lnlab_create_offer: (a: number, b: number, c: number, d: bigint, e: number, f: number) => [number, number, number, number];
  readonly lnlab_decode_invoice: (a: number, b: number) => [number, number, number];
  readonly lnlab_decode_offer: (a: number, b: number) => [number, number, number];
  readonly lnlab_funding_transaction_generated: (a: number, b: bigint, c: number, d: number) => [number, number];
  readonly lnlab_is_connected: (a: number) => number;
  readonly lnlab_kv_dirty: (a: number) => any;
  readonly lnlab_list_channels: (a: number, b: number) => [number, number, number];
  readonly lnlab_logs: (a: number, b: number) => [number, number, number];
  readonly lnlab_node_id: (a: number, b: number) => [number, number, number, number];
  readonly lnlab_pay_invoice: (a: number, b: number, c: number, d: number, e: number, f: bigint) => [number, number];
  readonly lnlab_pay_offer: (a: number, b: number, c: number, d: number, e: number, f: bigint, g: number, h: number) => [number, number];
  readonly lnlab_set_fees: (a: number, b: number, c: number, d: number) => void;
  readonly lnlab_tick: (a: number) => [number, number, number];
  readonly rustsecp256k1_v0_10_0_context_create: (a: number) => number;
  readonly rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
  readonly rustsecp256k1_v0_10_0_default_error_callback_fn: (a: number, b: number) => void;
  readonly rustsecp256k1_v0_10_0_default_illegal_callback_fn: (a: number, b: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
