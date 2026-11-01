declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	export class LnLab {
	  private constructor();
	  free(): void;
	  best_block(): any;
	  static boot_fresh(network: string, seed_a: Uint8Array, seed_b: Uint8Array, tip_height: number, tip_hash: string, now_secs: number): LnLab;
	  connect_ab(): void;
	  chain_block(height: number, block_hex: string): Array<any>;
	  pay_invoice(node: number, invoice: string, amount_msat_override?: bigint | null): void;
	  static boot_restore(network: string, seed_a: Uint8Array, seed_b: Uint8Array, now_secs: number, kv_a: Array<any>, kv_b: Array<any>): LnLab;
	  create_offer(node: number, amount_msat: bigint | null | undefined, description: string): string;
	  static decode_offer(offer: string): any;
	  is_connected(): boolean;
	  close_channel(node: number, channel_id_hex: string): void;
	  list_channels(node: number): Array<any>;
	  create_channel(value_sats: bigint, push_msat: bigint, user_channel_id: bigint): void;
	  create_invoice(node: number, amount_msat: bigint | null | undefined, description: string, expiry_secs: number, now_secs: number): string;
	  static decode_invoice(invoice: string): any;
	  funding_transaction_generated(user_channel_id: bigint, tx_hex: string): void;
	  logs(node: number): Array<any>;
	  tick(): Array<any>;
	  node_id(node: number): string;
	  kv_dirty(): Array<any>;
	  set_fees(fast: number, normal: number, slow: number): void;
	  pay_offer(node: number, offer: string, amount_msat?: bigint | null, payer_note?: string | null): void;
	}
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
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

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
